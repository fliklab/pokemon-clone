import Phaser from 'phaser'

export function createGame(parent: string | HTMLElement, onReady: () => void) {
  class BootScene extends Phaser.Scene {
    constructor() {
      super('boot')
    }

    create() {
      const { width, height } = this.scale
      this.add.text(width / 2, height / 2, 'Pokemon Clone', {
        color: '#f8fafc',
        fontFamily: 'sans-serif',
        fontSize: '28px',
      }).setOrigin(0.5)

      onReady()
    }
  }

  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 800,
    height: 480,
    backgroundColor: '#0f172a',
    scene: [BootScene],
  })
}
