import Phaser from 'phaser'
import { OverworldScene } from './scenes/OverworldScene'
import { BattleScene } from './scenes/BattleScene'

class BootScene extends Phaser.Scene {
  private readonly onReady: () => void

  constructor(onReady: () => void) {
    super('boot')
    this.onReady = onReady
  }

  create() {
    this.scene.start('overworld')
    this.onReady()
  }
}

export function createGame(parent: string | HTMLElement, onReady: () => void) {
  const overworldScene = new OverworldScene()
  const battleScene = new BattleScene()

  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 800,
    height: 480,
    backgroundColor: '#0f172a',
    pixelArt: true,
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false,
      },
    },
    scene: [new BootScene(onReady), overworldScene, battleScene],
  })
}
