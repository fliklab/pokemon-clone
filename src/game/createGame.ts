import Phaser from 'phaser'
import { PreloaderScene } from './scenes/PreloaderScene'
import { OverworldScene } from './scenes/OverworldScene'
import { BattleScene } from './scenes/BattleScene'
import { FallbackDummyScene } from './scenes/FallbackDummyScene'
import type { GameErrorPayload } from './ErrorOverlay'

const BASE_WIDTH = 800
const BASE_HEIGHT = 480

type SceneLifecycle = 'init' | 'preload' | 'create'

type SceneWithLifecycle = Phaser.Scene & {
  init?: (...args: unknown[]) => unknown
  preload?: () => unknown
  create?: (...args: unknown[]) => unknown
}

function ensureSceneObject(scene: SceneWithLifecycle, label: string): SceneWithLifecycle {
  // ScenePlugin(`scene`) is injected later; at construction time, key lives on sys.settings.
  const isValidScene =
    typeof scene === 'object' && scene !== null && typeof (scene as { sys?: { settings?: { key?: unknown } } }).sys?.settings?.key === 'string'
  if (!isValidScene) {
    throw new Error(`[game-init] ${label} is not a valid Phaser scene object`)
  }
  return scene
}

function toPayload(
  source: GameErrorPayload['source'],
  error: unknown,
  sceneKey?: string,
): GameErrorPayload {
  const normalized = error instanceof Error ? error : new Error(String(error))

  return {
    source,
    sceneKey,
    message: normalized.message,
    stack: normalized.stack,
    at: new Date().toISOString(),
  }
}

function tryStartFallbackScene(scene: SceneWithLifecycle, error: unknown) {
  if (scene.scene?.key === 'fallback-dummy') {
    return
  }

  try {
    scene.scene.start('fallback-dummy', {
      failedScene: scene.scene?.key,
      reason: error instanceof Error ? error.message : String(error),
    })
  } catch {
    // no-op: fallback startup should never throw to caller
  }
}

function wrapSceneLifecycle(
  scene: SceneWithLifecycle,
  method: SceneLifecycle,
  onError: (payload: GameErrorPayload) => void,
) {
  const original = scene[method]
  if (typeof original !== 'function') {
    return
  }

  scene[method] = function wrappedLifecycle(this: SceneWithLifecycle, ...args: unknown[]) {
    try {
      if (method === 'preload') {
        this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
          const identifier = file.src || file.key || 'unknown-file'
          const loadError = new Error(`[${this.scene.key}] asset load failed: ${identifier}`)
          onError(toPayload('scene-load', loadError, this.scene.key))
        })
      }

      const result = original.apply(this, args)
      if (result instanceof Promise) {
        return result.catch((error) => {
          onError(toPayload(`scene-${method}` as GameErrorPayload['source'], error, this.scene.key))
          if (method === 'create') {
            tryStartFallbackScene(this, error)
            return undefined
          }
          throw error
        })
      }

      return result
    } catch (error) {
      onError(toPayload(`scene-${method}` as GameErrorPayload['source'], error, this.scene.key))
      if (method === 'create') {
        tryStartFallbackScene(this, error)
        return
      }
      throw error
    }
  }
}

export function createGame(
  parent: string | HTMLElement,
  onReady: () => void,
  onError: (payload: GameErrorPayload) => void,
) {
  const preloaderScene = ensureSceneObject(new PreloaderScene() as SceneWithLifecycle, 'PreloaderScene')
  const overworldScene = ensureSceneObject(new OverworldScene() as SceneWithLifecycle, 'OverworldScene')
  const battleScene = ensureSceneObject(new BattleScene() as SceneWithLifecycle, 'BattleScene')
  const fallbackScene = ensureSceneObject(new FallbackDummyScene() as SceneWithLifecycle, 'FallbackDummyScene')

  ;([preloaderScene, overworldScene, battleScene, fallbackScene] as SceneWithLifecycle[]).forEach((scene) => {
    wrapSceneLifecycle(scene, 'init', onError)
    wrapSceneLifecycle(scene, 'preload', onError)
    wrapSceneLifecycle(scene, 'create', onError)
  })

  try {
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent,
      width: BASE_WIDTH,
      height: BASE_HEIGHT,
      backgroundColor: '#0f172a',
      pixelArt: true,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: BASE_WIDTH,
        height: BASE_HEIGHT,
        zoom: 1,
      },
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { x: 0, y: 0 },
          debug: false,
        },
      },
      scene: [preloaderScene, overworldScene, battleScene, fallbackScene],
    })

    game.events.once('ready', onReady)

    return game
  } catch (error) {
    const payload = toPayload('phaser-init', error)
    onError(payload)
    console.error('[game-init] Failed to create Phaser game', {
      error,
      parent,
    })
    throw error
  }
}
