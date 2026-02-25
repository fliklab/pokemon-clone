import Phaser from 'phaser'

type FallbackData = {
  failedScene?: string
  reason?: string
}

export class FallbackDummyScene extends Phaser.Scene {
  constructor() {
    super('fallback-dummy')
  }

  create(data?: FallbackData) {
    const { width, height } = this.scale
    const failedScene = data?.failedScene ?? 'unknown'
    const reason = data?.reason ?? 'unknown error'

    this.cameras.main.setBackgroundColor('#111827')

    this.add
      .text(width / 2, height / 2 - 40, '⚠️ Scene fallback activated', {
        color: '#f8fafc',
        fontSize: '22px',
        align: 'center',
      })
      .setOrigin(0.5)

    this.add
      .text(width / 2, height / 2 + 4, `failed scene: ${failedScene}`,
      {
        color: '#fbbf24',
        fontSize: '14px',
        align: 'center',
      })
      .setOrigin(0.5)

    this.add
      .text(width / 2, height / 2 + 34, reason, {
        color: '#cbd5e1',
        fontSize: '12px',
        align: 'center',
        wordWrap: { width: Math.max(320, width - 80) },
      })
      .setOrigin(0.5)
  }
}

export default FallbackDummyScene
