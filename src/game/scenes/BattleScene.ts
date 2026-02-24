import Phaser from 'phaser'
import { useGameStore } from '../../store/useGameStore'

export class BattleScene extends Phaser.Scene {
  private unsub?: () => void
  private endTimer?: Phaser.Time.TimerEvent
  private playerSprite?: Phaser.GameObjects.Text
  private enemySprite?: Phaser.GameObjects.Text
  private phaseCursor = ''

  constructor() {
    super('battle')
  }

  create() {
    this.cameras.main.setBackgroundColor('#1e293b')

    this.add.rectangle(400, 350, 250, 100, 0x334155)
    this.add.rectangle(650, 130, 180, 80, 0x475569)

    this.playerSprite = this.add.text(300, 320, '🧢', { fontSize: '48px' })
    this.enemySprite = this.add.text(630, 95, '🐾', { fontSize: '42px' })

    this.add.text(40, 30, 'Battle Scene', { color: '#e2e8f0', fontSize: '24px' })

    const messageText = this.add.text(40, 420, '', {
      color: '#f8fafc',
      fontSize: '16px',
      wordWrap: { width: 720 },
    })

    const sync = () => {
      const state = useGameStore.getState()
      const battle = state.battle
      if (!battle.active) {
        this.scene.start('overworld')
        return
      }

      messageText.setText(battle.message)
      this.applyPlaceholders(battle.phase)

      const ended = battle.phase === 'caught' || battle.phase === 'resolved' || battle.phase === 'lost' || battle.phase === 'escaped'
      if (ended && !this.endTimer) {
        this.endTimer = this.time.delayedCall(700, () => {
          useGameStore.getState().endBattle()
          this.endTimer = undefined
        })
      }

      if (!ended && this.endTimer) {
        this.endTimer.remove(false)
        this.endTimer = undefined
      }
    }

    sync()
    this.unsub = useGameStore.subscribe(sync)

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.shutdown()
    })
  }

  private applyPlaceholders(phase: string) {
    if (this.phaseCursor === phase) {
      return
    }

    this.phaseCursor = phase

    if (phase === 'enemy_turn') {
      this.playTone(170)
      this.tweens.add({ targets: this.enemySprite, x: '+=14', yoyo: true, duration: 110, repeat: 1 })
      this.cameras.main.flash(100, 255, 120, 120)
      return
    }

    if (phase === 'resolved' || phase === 'caught') {
      this.playTone(420)
      this.tweens.add({ targets: this.playerSprite, y: '-=8', yoyo: true, duration: 140, repeat: 2 })
      this.cameras.main.flash(140, 120, 255, 160)
      return
    }

    if (phase === 'lost') {
      this.playTone(120)
      this.cameras.main.shake(220, 0.007)
    }
  }

  private playTone(frequency: number) {
    const manager = this.sound as { context?: AudioContext }
    const audioCtx = manager.context
    if (!audioCtx) {
      return
    }

    const oscillator = audioCtx.createOscillator()
    const gain = audioCtx.createGain()

    oscillator.type = 'square'
    oscillator.frequency.value = frequency
    gain.gain.value = 0.02

    oscillator.connect(gain)
    gain.connect(audioCtx.destination)

    oscillator.start()
    oscillator.stop(audioCtx.currentTime + 0.08)
  }

  shutdown() {
    this.unsub?.()
    this.unsub = undefined
    this.endTimer?.remove(false)
    this.endTimer = undefined
  }
}
