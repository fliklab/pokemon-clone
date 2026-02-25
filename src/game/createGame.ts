import Phaser from 'phaser'
import { OverworldScene } from './scenes/OverworldScene'
import { BattleScene } from './scenes/BattleScene'

const BASE_WIDTH = 800
const BASE_HEIGHT = 480

export function createGame(parent: string | HTMLElement, onReady: () => void) {
  const overworldScene = new OverworldScene()
  const battleScene = new BattleScene()

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
    scene: [overworldScene, battleScene],
  })

  game.events.once('ready', onReady)

  return game
}
