import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react'
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type Phaser from 'phaser'
import { resolveSkillSlots } from './battle/skills'
import type { ItemId } from './battle/types'
import { createGame } from './game/createGame'
import { ErrorOverlay, type GameErrorPayload } from './game/ErrorOverlay'
import { ko } from './i18n/ko'
import { useGameStore } from './store/useGameStore'

type ModalType = 'menu' | 'party' | 'inventory' | 'shop' | 'pc' | 'save' | 'save-confirm' | 'new-game-confirm' | 'oak-dialog' | null

type SceneSnapshot = {
  key: string
  active: boolean
  visible: boolean
  sleeping: boolean
  paused: boolean
}

type LayerDebugSnapshot = {
  name: string
  exists: boolean
  visible: boolean
  alpha: number
  depth: number
  tint: number
}

type CameraDebugSnapshot = {
  x: number
  y: number
  width: number
  height: number
}

type OverworldDebugSnapshot = {
  mapKey: string
  mapLoaded: boolean
  widthTiles: number
  heightTiles: number
  widthPixels: number
  heightPixels: number
  cameraZoom: number
  cameraScrollX: number
  cameraScrollY: number
  cameraBounds: CameraDebugSnapshot
  layers: LayerDebugSnapshot[]
}

type DebugRuntimeSnapshot = {
  renderer: string
  fps: number
  canvasWidth: number
  canvasHeight: number
  scenes: SceneSnapshot[]
  overworld: OverworldDebugSnapshot | null
}

type DebugRouteMode = 'map' | 'battle' | null

declare global {
  interface Window {
    __oakFlowTrace?: Array<Record<string, unknown>>
    __overworldDebug?: OverworldDebugSnapshot
    __debugRouteMode?: DebugRouteMode
  }
}

function App() {
  const gameRef = useRef<Phaser.Game | null>(null)
  const gameCanvasContainerRef = useRef<HTMLDivElement | null>(null)
  const [activeModal, setActiveModal] = useState<ModalType>(null)
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null)
  const [gameError, setGameError] = useState<GameErrorPayload | null>(null)
  const [errorDismissed, setErrorDismissed] = useState(false)
  const [debugRuntime, setDebugRuntime] = useState<DebugRuntimeSnapshot>({
    renderer: '알 수 없음',
    fps: 0,
    canvasWidth: 0,
    canvasHeight: 0,
    scenes: [],
    overworld: null,
  })
  const lastEncounter = useGameStore((state) => state.lastEncounter)
  const battle = useGameStore((state) => state.battle)
  const nearbyNpc = useGameStore((state) => state.nearbyNpc)
  const interactionNonce = useGameStore((state) => state.interactionNonce)
  const party = useGameStore((state) => state.party)
  const money = useGameStore((state) => state.money)
  const itemBag = useGameStore((state) => state.itemBag)
  const setSceneReady = useGameStore((state) => state.setSceneReady)
  const chooseBattleCommand = useGameStore((state) => state.chooseBattleCommand)
  const switchBattleMonster = useGameStore((state) => state.switchBattleMonster)
  const healPartyAtPc = useGameStore((state) => state.healPartyAtPc)
  const buyPotion = useGameStore((state) => state.buyPotion)
  const consumeBagItem = useGameStore((state) => state.consumeBagItem)
  const resetGame = useGameStore((state) => state.resetGame)
  const saveGame = useGameStore((state) => state.saveGame)
  const loadGame = useGameStore((state) => state.loadGame)
  const endBattle = useGameStore((state) => state.endBattle)
  const triggerEncounter = useGameStore((state) => state.triggerEncounter)
  const setVirtualInput = useGameStore((state) => state.setVirtualInput)
  const requestNpcInteract = useGameStore((state) => state.requestNpcInteract)
  const sceneReady = useGameStore((state) => state.sceneReady)
  const playerTile = useGameStore((state) => state.playerTile)
  const oakIntroSeen = useGameStore((state) => state.oakIntroSeen)
  const debugMode = useGameStore((state) => state.debugMode)
  const toggleDebugMode = useGameStore((state) => state.toggleDebugMode)
  const debugRouteMode: DebugRouteMode = window.__debugRouteMode ?? null

  const focusGameCanvas = useCallback(() => {
    gameCanvasContainerRef.current?.focus()
  }, [])

  const collectSceneSnapshot = useCallback((): SceneSnapshot[] => {
    const game = gameRef.current
    if (!game || !game.scene?.getScenes) {
      return []
    }

    return game.scene.getScenes(false).map((scene) => ({
      key: scene.scene.key,
      active: scene.scene.isActive(),
      visible: scene.scene.isVisible(),
      sleeping: scene.scene.isSleeping(),
      paused: scene.scene.isPaused(),
    }))
  }, [])

  const getRendererLabel = useCallback((rendererType?: number) => {
    if (rendererType === 1) {
      return '캔버스'
    }

    if (rendererType === 2) {
      return 'WebGL'
    }

    return '알 수 없음'
  }, [])

  const traceOakFlow = useCallback((stage: string, details: Record<string, unknown> = {}) => {
    const payload = {
      stage,
      at: new Date().toISOString(),
      renderer: gameRef.current?.renderer?.type,
      sceneSnapshot: collectSceneSnapshot(),
      ...details,
    }

    window.__oakFlowTrace = [...(window.__oakFlowTrace ?? []), payload]
    console.info('[oak-flow]', JSON.stringify(payload))
  }, [collectSceneSnapshot])

  const restoreOverworldRenderer = useCallback(() => {
    const game = gameRef.current
    if (!game) {
      return
    }

    try {
      const manager = game.scene

      if (manager.isActive('battle')) {
        manager.stop('battle')
      }

      if (!manager.isActive('overworld')) {
        manager.start('overworld')
      } else {
        manager.run('overworld')
        manager.wake('overworld')
        manager.resume('overworld')
      }

      manager.bringToTop('overworld')
      game.scale.refresh()

      const canvasBounds = gameCanvasContainerRef.current?.getBoundingClientRect()
      if (canvasBounds && canvasBounds.width > 0 && canvasBounds.height > 0) {
        game.scale.resize(Math.floor(canvasBounds.width), Math.floor(canvasBounds.height))
      }

      game.loop.step(16.67)
      window.requestAnimationFrame(() => {
        game.loop.step(16.67)
        window.requestAnimationFrame(() => {
          game.loop.step(16.67)
        })
      })
    } catch (error) {
      traceOakFlow('restore-failed', {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }, [traceOakFlow])

  useEffect(() => {
    if (!gameRef.current) {
      const mountNode = gameCanvasContainerRef.current

      if (!mountNode) {
        console.error('[game-init] Canvas mount node not found (#game-root)')
        return
      }

      const mountRect = mountNode.getBoundingClientRect()
      if (mountRect.width <= 0 || mountRect.height <= 0) {
        console.error('[game-init] Canvas mount node has invalid size', {
          width: mountRect.width,
          height: mountRect.height,
        })
      }

      try {
        gameRef.current = createGame(
          mountNode,
          () => setSceneReady(true),
          (payload) => {
            setErrorDismissed(false)
            setGameError(payload)
          },
        )
      } catch (error) {
        console.error('[game-init] createGame failed in App', { error })
        return
      }
    }

    const frame = window.requestAnimationFrame(() => {
      focusGameCanvas()
    })

    return () => {
      window.cancelAnimationFrame(frame)
      gameRef.current?.destroy(true)
      gameRef.current = null
      setSceneReady(false)
      setGameError(null)
      setErrorDismissed(false)
    }
  }, [focusGameCanvas, setSceneReady])

  useEffect(() => {
    const updateRuntimeSnapshot = () => {
      const game = gameRef.current
      if (!game) {
        return
      }

      const canvas = game.canvas
      setDebugRuntime({
        renderer: getRendererLabel(game.renderer?.type),
        fps: game.loop?.actualFps ?? 0,
        canvasWidth: Math.round(canvas?.width ?? 0),
        canvasHeight: Math.round(canvas?.height ?? 0),
        scenes: collectSceneSnapshot(),
        overworld: window.__overworldDebug ?? null,
      })
    }

    updateRuntimeSnapshot()
    const interval = window.setInterval(updateRuntimeSnapshot, 250)

    return () => {
      window.clearInterval(interval)
    }
  }, [collectSceneSnapshot, getRendererLabel])

  useEffect(() => {
    if (debugRouteMode !== 'battle' || !sceneReady || battle.active) {
      return
    }

    const spawnX = playerTile.x > 0 ? playerTile.x : 3
    const spawnY = playerTile.y > 0 ? playerTile.y : 2
    triggerEncounter(spawnX, spawnY)
  }, [battle.active, debugRouteMode, playerTile.x, playerTile.y, sceneReady, triggerEncounter])

  const encounterText = useMemo(() => {
    if (battle.active && !battle.trainerBattle) {
      return battle.message
    }

    if (!lastEncounter) {
      return ko.app.noEncounter
    }

    return ko.app.encounterAt(lastEncounter.x, lastEncounter.y)
  }, [battle.active, battle.message, battle.trainerBattle, lastEncounter])

  const openModal = (modal: Exclude<ModalType, null>) => setActiveModal(modal)

  const closeModal = useCallback(() => {
    const wasOakDialog = activeModal === 'oak-dialog'
    if (wasOakDialog) {
      traceOakFlow('oak-close-clicked')
    }

    setActiveModal(null)
    window.requestAnimationFrame(() => {
      focusGameCanvas()
      if (wasOakDialog) {
        restoreOverworldRenderer()
        traceOakFlow('oak-close-restored')
      }
    })
  }, [activeModal, focusGameCanvas, restoreOverworldRenderer, traceOakFlow])

  const endedBattle = battle.phase === 'caught' || battle.phase === 'resolved' || battle.phase === 'lost' || battle.phase === 'escaped'
  const canOpenShop = nearbyNpc === 'shop'
  const canOpenPc = nearbyNpc === 'pc'
  const selectedPartyMonster = party.find((monster) => monster.id === selectedPartyId) ?? party[0]
  const skillSlots = useMemo(() => resolveSkillSlots(battle.player), [battle.player])
  const bagEntries = useMemo(() => (
    [
      { id: 'potion' as ItemId, label: ko.app.items.potion },
      { id: 'superPotion' as ItemId, label: ko.app.items.superPotion },
      { id: 'antidote' as ItemId, label: ko.app.items.antidote },
    ]
  ), [])

  useEffect(() => {
    if (interactionNonce === 0) {
      return
    }

    const modal = nearbyNpc === 'shop' ? 'shop' : nearbyNpc === 'pc' ? 'pc' : nearbyNpc === 'oak' ? 'oak-dialog' : null
    if (!modal) {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      setActiveModal(modal)
      if (modal === 'oak-dialog') {
        traceOakFlow('oak-modal-open')
      }
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [interactionNonce, nearbyNpc, traceOakFlow])

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center p-3 md:p-6 gap-4">
      <div className="w-full max-w-5xl flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl md:text-2xl font-bold">{ko.app.title}</h1>
          {debugMode && (
            <a
              href="/debug.html?debugMode=true"
              className="relative z-10 inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-100 opacity-100 visible md:text-sm hover:bg-slate-700 active:bg-slate-700"
              aria-label="디버그 페이지 열기"
            >
              <span aria-hidden="true">🔧</span>
              <span>debug</span>
            </a>
          )}
        </div>
        <button
          className="h-10 w-10 rounded-full bg-slate-800 border border-slate-600 text-xl leading-none hover:bg-slate-700 active:bg-slate-700"
          onClick={() => openModal('menu')}
          aria-label="설정 메뉴 열기"
        >
          ⚙
        </button>
      </div>

      <p className="text-emerald-300 text-sm md:text-base">{encounterText}</p>

      <div
        ref={gameCanvasContainerRef}
        tabIndex={0}
        className="game-canvas-host relative border border-slate-700 rounded overflow-hidden w-full max-w-5xl aspect-[5/3] focus:outline-none focus:ring-2 focus:ring-violet-500"
        style={{ touchAction: 'none' }}
        aria-label="게임 화면"
      >
        <ErrorOverlay
          error={gameError && !errorDismissed ? gameError : null}
          debugMode={debugMode}
          onConfirm={() => setErrorDismissed(true)}
        />
      </div>

      {debugMode && (
        <section className="w-full max-w-5xl rounded border border-cyan-500/50 bg-slate-900/90 p-3 text-xs md:text-sm space-y-3">
          <p className="font-semibold text-cyan-300">디버그 상태 패널</p>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            <div className="rounded border border-slate-700 bg-slate-950/70 p-2 space-y-1">
              <p className="text-cyan-200 font-semibold">로드 데이터</p>
              <p>씬 준비: {sceneReady ? '완료' : '대기'}</p>
              <p>오박사 튜토리얼: {oakIntroSeen ? '완료' : '미완료'}</p>
              <p>최근 조우: {lastEncounter ? `${lastEncounter.x}, ${lastEncounter.y}` : '없음'}</p>
            </div>

            <div className="rounded border border-slate-700 bg-slate-950/70 p-2 space-y-1">
              <p className="text-cyan-200 font-semibold">맵 데이터</p>
              <p>현재 타일: ({playerTile.x}, {playerTile.y})</p>
              <p>근처 NPC: {nearbyNpc ?? '없음'}</p>
              <p>디버그 모드: {debugMode ? '활성' : '비활성'}</p>
            </div>

            <div className="rounded border border-slate-700 bg-slate-950/70 p-2 space-y-1">
              <p className="text-cyan-200 font-semibold">플레이어 데이터</p>
              <p>리드 포켓몬: {party[0]?.name ?? '없음'} (Lv.{party[0]?.level ?? 0})</p>
              <p>HP: {party[0]?.hp ?? 0}/{party[0]?.maxHp ?? 0}</p>
              <p>소지금: ₽{money}</p>
            </div>

            <div className="rounded border border-slate-700 bg-slate-950/70 p-2 space-y-1">
              <p className="text-cyan-200 font-semibold">렌더 데이터</p>
              <p>렌더러: {debugRuntime.renderer}</p>
              <p>FPS: {debugRuntime.fps.toFixed(1)}</p>
              <p>캔버스: {debugRuntime.canvasWidth}×{debugRuntime.canvasHeight}</p>
            </div>

            <div className="min-w-0 rounded border border-slate-700 bg-slate-950/70 p-2 space-y-1 md:col-span-2 xl:col-span-2">
              <p className="text-cyan-200 font-semibold">맵 렌더 진단</p>
              {debugRuntime.overworld ? (
                <>
                  <p>맵 키: {debugRuntime.overworld.mapKey} ({debugRuntime.overworld.mapLoaded ? '로드됨' : '미로드'})</p>
                  <p>맵 크기: {debugRuntime.overworld.widthTiles}×{debugRuntime.overworld.heightTiles} 타일 ({debugRuntime.overworld.widthPixels}×{debugRuntime.overworld.heightPixels}px)</p>
                  <p>레이어 수: {debugRuntime.overworld.layers.length} (표시 {debugRuntime.overworld.layers.filter((layer) => layer.visible).length} / 숨김 {debugRuntime.overworld.layers.filter((layer) => !layer.visible).length})</p>
                  <p>카메라: zoom {debugRuntime.overworld.cameraZoom.toFixed(2)} · scroll {Math.round(debugRuntime.overworld.cameraScrollX)}, {Math.round(debugRuntime.overworld.cameraScrollY)}</p>
                  <p>카메라 bounds: {Math.round(debugRuntime.overworld.cameraBounds.x)}, {Math.round(debugRuntime.overworld.cameraBounds.y)} / {Math.round(debugRuntime.overworld.cameraBounds.width)}×{Math.round(debugRuntime.overworld.cameraBounds.height)}</p>
                  <div className="space-y-1">
                    {debugRuntime.overworld.layers.map((layer) => (
                      <p key={layer.name} className="flex flex-wrap gap-x-2 gap-y-0.5">
                        <span className="break-all">{layer.name}</span>
                        <span>exists:{layer.exists ? 'Y' : 'N'}</span>
                        <span>visible:{layer.visible ? 'Y' : 'N'}</span>
                        <span>alpha:{layer.alpha.toFixed(2)}</span>
                        <span>depth:{layer.depth}</span>
                        <span>tint:#{layer.tint.toString(16).padStart(6, '0')}</span>
                      </p>
                    ))}
                  </div>
                </>
              ) : (
                <p>오버월드 맵 진단 데이터 없음</p>
              )}
            </div>

            <div className="rounded border border-slate-700 bg-slate-950/70 p-2 space-y-1 md:col-span-2 xl:col-span-1">
              <p className="text-cyan-200 font-semibold">상태 데이터</p>
              <p>활성 모달: {activeModal ?? '없음'}</p>
              <p>배틀 상태: {battle.active ? battle.phase : '필드 탐험 중'}</p>
              <p>상호작용 nonce: {interactionNonce}</p>
            </div>

            <div className="min-w-0 rounded border border-slate-700 bg-slate-950/70 p-2 space-y-1 md:col-span-2 xl:col-span-2">
              <p className="text-cyan-200 font-semibold">씬 스냅샷</p>
              {debugRuntime.scenes.length > 0 ? (
                <div className="space-y-1">
                  {debugRuntime.scenes.map((scene) => (
                    <p key={scene.key} className="flex flex-wrap gap-x-2 gap-y-0.5">
                      <span className="break-all">{scene.key}</span>
                      <span>active:{scene.active ? 'Y' : 'N'}</span>
                      <span>visible:{scene.visible ? 'Y' : 'N'}</span>
                      <span>sleep:{scene.sleeping ? 'Y' : 'N'}</span>
                      <span>pause:{scene.paused ? 'Y' : 'N'}</span>
                    </p>
                  ))}
                </div>
              ) : (
                <p>씬 정보 없음</p>
              )}
            </div>
          </div>
        </section>
      )}

      <section className="md:hidden w-full max-w-sm bg-slate-900 border border-slate-700 rounded p-3 select-none" style={{ touchAction: 'none' }}>
        <p className="text-xs text-slate-300 mb-2">{ko.app.joystick}</p>
        <div className="grid grid-cols-4 gap-2">
          <span />
          <DirectionButton direction="up" label="↑" onInput={setVirtualInput} />
          <span />
          <ActionButton label={ko.app.talkButton} onClick={requestNpcInteract} disabled={!nearbyNpc} />
          <DirectionButton direction="left" label="←" onInput={setVirtualInput} />
          <DirectionButton direction="down" label="↓" onInput={setVirtualInput} />
          <DirectionButton direction="right" label="→" onInput={setVirtualInput} />
          <p className="col-span-1 text-[11px] text-slate-400 self-center text-center">
            {nearbyNpc ? ko.app.talkEnabled : ko.app.talkDisabled}
          </p>
        </div>
      </section>

      <BaseModal open={activeModal === 'menu'} onClose={closeModal} title={ko.app.menu.title}>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <MenuAction label={ko.app.menu.party} onClick={() => openModal('party')} />
          <MenuAction label={ko.app.menu.inventory} onClick={() => openModal('inventory')} />
          <MenuAction
            label={ko.app.menu.debugMode(debugMode)}
            onClick={toggleDebugMode}
            className="col-span-2"
          />
          <MenuAction label={ko.app.menu.save} onClick={() => openModal('save')} className="col-span-2" />
        </div>
      </BaseModal>

      <BaseModal open={activeModal === 'party'} onClose={closeModal} title={ko.app.modal.partyTitle}>
        <div className="space-y-3 text-sm">
          <p className="text-xs text-slate-400">포획한 포켓몬: {party.length}마리</p>
          <div className="max-h-44 overflow-y-auto space-y-2">
            {party.map((monster) => (
              <button
                key={monster.id}
                className={`w-full text-left rounded border p-2 ${selectedPartyMonster?.id === monster.id ? 'border-violet-400 bg-violet-900/30' : 'border-slate-700 bg-slate-800/70'}`}
                onClick={() => setSelectedPartyId(monster.id)}
              >
                <p className="font-semibold">{monster.name} · Lv.{monster.level}</p>
                <p className="text-slate-300">{ko.app.modal.hp(monster.hp, monster.maxHp)}</p>
              </button>
            ))}
          </div>
          {selectedPartyMonster && (
            <div className="rounded border border-slate-700 p-2 bg-slate-900/70 space-y-2">
              <p className="font-semibold">상세 정보</p>
              <p>타입: {selectedPartyMonster.type}</p>
              <p>공격 {selectedPartyMonster.attack} · 방어 {selectedPartyMonster.defense} · 스피드 {selectedPartyMonster.speed}</p>
              <p>EXP {selectedPartyMonster.exp}/{selectedPartyMonster.nextLevelExp}</p>
              {battle.active && battle.phase === 'player_turn' && (
                <button
                  className="w-full rounded bg-violet-700 active:bg-violet-600 p-2 font-semibold disabled:opacity-50"
                  onClick={() => switchBattleMonster(selectedPartyMonster.id)}
                  disabled={selectedPartyMonster.id === battle.player.id || selectedPartyMonster.hp <= 0}
                >
                  이 포켓몬으로 교체
                </button>
              )}
            </div>
          )}
        </div>
      </BaseModal>

      <BaseModal open={activeModal === 'inventory'} onClose={closeModal} title={ko.app.modal.inventoryTitle}>
        <div className="text-sm space-y-2">
          <p className="text-emerald-300">{ko.app.modal.money(money)}</p>
          {bagEntries.some((entry) => itemBag[entry.id] > 0) ? (
            <div className="space-y-2">
              {bagEntries.map((entry) => (
                <div key={entry.id} className="rounded border border-slate-700 p-2 bg-slate-800/70 flex items-center justify-between">
                  <span>{entry.label}</span>
                  <span>{ko.app.modal.itemCount(itemBag[entry.id])}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-400">{ko.app.modal.inventoryEmpty}</p>
          )}
        </div>
      </BaseModal>

      <BaseModal open={activeModal === 'shop'} onClose={closeModal} title={ko.app.modal.shopTitle}>
        <div className="space-y-3 text-sm">
          <p className="text-emerald-300">{ko.app.modal.money(money)}</p>
          {!canOpenShop && <p className="text-amber-300 text-xs">상점 NPC 근처에서 A(말걸기)로 이용할 수 있습니다.</p>}
          <button
            className="w-full rounded bg-sky-700 active:bg-sky-600 p-3 font-semibold disabled:opacity-50"
            onClick={buyPotion}
            disabled={money < 20 || !canOpenShop}
          >
            {ko.app.modal.buyPotion}
          </button>
        </div>
      </BaseModal>

      <BaseModal open={activeModal === 'pc'} onClose={closeModal} title={ko.app.modal.pcTitle}>
        <div className="space-y-2 text-sm">
          {!canOpenPc && <p className="text-amber-300 text-xs">PC NPC 근처에서 A(말걸기)로 이용할 수 있습니다.</p>}
          <button
            className="w-full rounded bg-teal-700 active:bg-teal-600 p-3 font-semibold disabled:opacity-50"
            onClick={healPartyAtPc}
            disabled={!canOpenPc}
          >
            {ko.app.modal.healParty}
          </button>
          <button
            className="w-full rounded bg-indigo-700 active:bg-indigo-600 p-3 font-semibold"
            onClick={() => openModal('party')}
          >
            {ko.app.modal.viewParty}
          </button>
        </div>
      </BaseModal>

      <BaseModal open={activeModal === 'save'} onClose={closeModal} title={ko.app.modal.saveTitle}>
        <div className="space-y-3 text-sm">
          <p className="text-slate-300">{ko.app.modal.saveDesc}</p>
          <div className="grid grid-cols-2 gap-2">
            <button className="rounded bg-slate-700 active:bg-slate-600 p-3" onClick={() => openModal('save-confirm')}>
              {ko.app.modal.saveNow}
            </button>
            <button className="rounded bg-slate-700 active:bg-slate-600 p-3" onClick={loadGame}>
              {ko.app.modal.loadNow}
            </button>
            <button className="col-span-2 rounded bg-rose-700 active:bg-rose-600 p-3" onClick={() => openModal('new-game-confirm')}>
              {ko.app.modal.newGame}
            </button>
          </div>
        </div>
      </BaseModal>

      <BaseModal open={activeModal === 'save-confirm'} onClose={() => openModal('save')} title={ko.app.modal.confirmSaveTitle}>
        <div className="space-y-3 text-sm">
          <p className="text-slate-300">{ko.app.modal.confirmSaveDesc}</p>
          <div className="grid grid-cols-2 gap-2">
            <button className="rounded bg-emerald-700 active:bg-emerald-600 p-3" onClick={() => { saveGame(); closeModal() }}>
              {ko.app.modal.confirm}
            </button>
            <button className="rounded bg-slate-700 active:bg-slate-600 p-3" onClick={() => openModal('save')}>
              {ko.app.modal.cancel}
            </button>
          </div>
        </div>
      </BaseModal>

      <BaseModal open={activeModal === 'new-game-confirm'} onClose={() => openModal('save')} title={ko.app.modal.newGameConfirmTitle}>
        <div className="space-y-3 text-sm">
          <p className="text-slate-300">{ko.app.modal.newGameConfirmDesc}</p>
          <div className="grid grid-cols-2 gap-2">
            <button className="rounded bg-rose-700 active:bg-rose-600 p-3" onClick={() => { resetGame(); gameRef.current?.scene.start('overworld'); closeModal() }}>
              {ko.app.modal.confirm}
            </button>
            <button className="rounded bg-slate-700 active:bg-slate-600 p-3" onClick={() => openModal('save')}>
              {ko.app.modal.cancel}
            </button>
          </div>
        </div>
      </BaseModal>

      <BaseModal open={activeModal === 'oak-dialog'} onClose={closeModal} title={ko.app.modal.oakTitle}>
        <div className="space-y-3 text-sm">
          <p className="text-slate-200">{ko.app.modal.oakIntro}</p>
          <button
            className="w-full rounded bg-emerald-700 active:bg-emerald-600 p-3 font-semibold"
            onClick={closeModal}
          >
            {ko.app.modal.startAdventure}
          </button>
        </div>
      </BaseModal>

      {debugRouteMode !== 'map' && battle.active && (
        <section className="fixed md:static bottom-3 left-1/2 md:left-auto -translate-x-1/2 md:translate-x-0 z-50 w-[calc(100%-1.5rem)] md:w-full max-w-sm md:max-w-5xl bg-slate-900/95 border border-slate-700 rounded p-4 space-y-3 shadow-2xl">
          <div className="flex justify-between text-sm">
            <p>{battle.player.name} {ko.app.battle.hp}: {battle.player.hp}/{battle.player.maxHp}</p>
            <p>{battle.enemy.name} {ko.app.battle.hp}: {battle.enemy.hp}/{battle.enemy.maxHp}</p>
          </div>
          <p className="text-amber-300">{battle.message}</p>

          {battle.phase === 'player_turn' && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {skillSlots.map((skill) => (
                  <button
                    key={skill.id}
                    className="bg-emerald-700 p-2 rounded"
                    onClick={() => chooseBattleCommand('fight', skill.id)}
                  >
                    {skill.name}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {bagEntries.map((entry) => (
                  <button
                    key={entry.id}
                    className="bg-cyan-700 p-2 rounded disabled:opacity-50"
                    onClick={() => consumeBagItem(entry.id)}
                    disabled={(itemBag[entry.id] ?? 0) <= 0}
                  >
                    {entry.label} x{itemBag[entry.id] ?? 0}
                  </button>
                ))}
                <button className="bg-indigo-700 p-2 rounded" onClick={() => chooseBattleCommand('catch')}>{ko.app.battle.catch}</button>
                <button className="bg-rose-700 p-2 rounded" onClick={() => chooseBattleCommand('run')}>{ko.app.battle.run}</button>
              </div>
            </div>
          )}

          {endedBattle && (
            <button className="bg-slate-700 p-2 rounded" onClick={endBattle}>{ko.app.battle.return}</button>
          )}
        </section>
      )}
    </main>
  )
}

type BaseModalProps = {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}

function BaseModal({ open, onClose, title, children }: BaseModalProps) {
  return (
    <Dialog open={open} onClose={onClose} className="relative z-[70]">
      <DialogBackdrop className="fixed inset-0 bg-black/60" />
      <div className="fixed inset-0 flex items-end md:items-center justify-center p-2 md:p-4" style={{ touchAction: 'none' }}>
        <DialogPanel className="w-full max-w-md rounded-t-2xl md:rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-2xl" style={{ touchAction: 'manipulation' }}>
          <div className="flex items-center justify-between mb-3">
            <DialogTitle className="font-semibold">{title}</DialogTitle>
            <button className="text-xs px-2 py-1 rounded bg-slate-700" onClick={onClose}>{ko.app.menu.close}</button>
          </div>
          {children}
        </DialogPanel>
      </div>
    </Dialog>
  )
}

type MenuActionProps = {
  label: string
  onClick: () => void
  className?: string
  disabled?: boolean
}

function MenuAction({ label, onClick, className, disabled = false }: MenuActionProps) {
  return (
    <button
      className={`rounded bg-menuPurpleSoft p-3 font-semibold text-menuPurpleSoft-text hover:bg-menuPurpleSoft-hover active:bg-menuPurpleSoft-hover disabled:opacity-50 ${className ?? ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  )
}

type DirectionButtonProps = {
  direction: 'up' | 'down' | 'left' | 'right'
  label: string
  onInput: (direction: 'up' | 'down' | 'left' | 'right', active: boolean) => void
}

function DirectionButton({ direction, label, onInput }: DirectionButtonProps) {
  return (
    <button
      className="h-14 rounded bg-slate-800 text-xl select-none"
      style={{ touchAction: 'none' }}
      onPointerDown={(event) => {
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
        onInput(direction, true)
      }}
      onPointerUp={(event) => {
        event.preventDefault()
        event.currentTarget.releasePointerCapture(event.pointerId)
        onInput(direction, false)
      }}
      onPointerCancel={(event) => {
        event.currentTarget.releasePointerCapture(event.pointerId)
        onInput(direction, false)
      }}
      onContextMenu={(event) => event.preventDefault()}
    >
      {label}
    </button>
  )
}

type ActionButtonProps = {
  label: string
  onClick: () => void
  disabled?: boolean
}

function ActionButton({ label, onClick, disabled = false }: ActionButtonProps) {
  return (
    <button
      className="h-14 rounded bg-amber-700 text-sm font-semibold disabled:opacity-50"
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  )
}

export default App
