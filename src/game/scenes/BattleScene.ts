import Phaser from 'phaser'
import { useGameStore } from '../../store/useGameStore'

export class BattleScene extends Phaser.Scene {
  private unsub?: () => void
  private endTimer?: Phaser.Time.TimerEvent

  constructor() {
    super('battle')
  }

  create() {
    this.cameras.main.setBackgroundColor('#1e293b')

    this.add.rectangle(400, 350, 250, 100, 0x334155)
    this.add.rectangle(650, 130, 180, 80, 0x475569)

    this.add.text(300, 320, '🧢', { fontSize: '48px' })
    this.add.text(630, 95, '🐾', { fontSize: '42px' })

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

  shutdown() {
    this.unsub?.()
    this.unsub = undefined
    this.endTimer?.remove(false)
    this.endTimer = undefined
  }
}
