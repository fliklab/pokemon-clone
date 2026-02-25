import Phaser from 'phaser'
import { ko } from '../../i18n/ko'
import { useGameStore } from '../../store/useGameStore'

const BASE_GAME_WIDTH = 800
const BASE_GAME_HEIGHT = 480
const BASE_TILE_WIDTH = 32

export class BattleScene extends Phaser.Scene {
  private unsub?: () => void
  private endTimer?: Phaser.Time.TimerEvent
  private typingTimer?: Phaser.Time.TimerEvent
  private playerSprite?: Phaser.GameObjects.Text
  private enemySprite?: Phaser.GameObjects.Text
  private titleText?: Phaser.GameObjects.Text
  private playerHpLabel?: Phaser.GameObjects.Text
  private enemyHpLabel?: Phaser.GameObjects.Text
  private messageText?: Phaser.GameObjects.Text
  private phaseCursor = ''
  private currentMessage = ''

  constructor() {
    super('battle')
  }

  create() {
    this.cameras.main.setBackgroundColor('#1e293b')

    this.add.rectangle(400, 350, 250, 100, 0x334155)
    this.add.rectangle(650, 130, 180, 80, 0x475569)

    this.playerSprite = this.add.text(300, 320, '🧢', { fontSize: '48px' })
    this.enemySprite = this.add.text(630, 95, '🐾', { fontSize: '42px' })

    this.titleText = this.add.text(40, 30, ko.battleScene.title, { color: '#e2e8f0', fontSize: '24px' })

    this.playerHpLabel = this.add.text(100, 290, '', { color: '#e2e8f0', fontSize: '14px' })
    this.enemyHpLabel = this.add.text(560, 50, '', { color: '#e2e8f0', fontSize: '14px' })

    this.add.rectangle(170, 314, 180, 12, 0x0f172a).setOrigin(0, 0.5)
    this.add.rectangle(560, 74, 180, 12, 0x0f172a).setOrigin(0, 0.5)
    const playerHpFill = this.add.rectangle(170, 314, 180, 12, 0x22c55e).setOrigin(0, 0.5)
    const enemyHpFill = this.add.rectangle(560, 74, 180, 12, 0x22c55e).setOrigin(0, 0.5)

    this.messageText = this.add.text(40, 420, '', {
      color: '#f8fafc',
      fontSize: '16px',
      wordWrap: { width: 720 },
    })

    this.applyBattleTextScale()
    this.scale.on('resize', this.applyBattleTextScale, this)

    this.playBattleStartWarningMusic()

    const sync = () => {
      const state = useGameStore.getState()
      const battle = state.battle
      if (!battle.active) {
        this.scene.start('overworld')
        return
      }

      this.updateTypewriter(battle.message)
      this.playerHpLabel?.setText(`${battle.player.name} HP ${battle.player.hp}/${battle.player.maxHp}`)
      this.enemyHpLabel?.setText(`${battle.enemy.name} HP ${battle.enemy.hp}/${battle.enemy.maxHp}`)

      const playerRatio = Phaser.Math.Clamp(battle.player.hp / battle.player.maxHp, 0, 1)
      const enemyRatio = Phaser.Math.Clamp(battle.enemy.hp / battle.enemy.maxHp, 0, 1)
      playerHpFill.width = 180 * playerRatio
      enemyHpFill.width = 180 * enemyRatio
      playerHpFill.fillColor = playerRatio > 0.5 ? 0x22c55e : playerRatio > 0.2 ? 0xf59e0b : 0xef4444
      enemyHpFill.fillColor = enemyRatio > 0.5 ? 0x22c55e : enemyRatio > 0.2 ? 0xf59e0b : 0xef4444

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

  private getTileWidth() {
    const widthTile = this.scale.width / (BASE_GAME_WIDTH / BASE_TILE_WIDTH)
    const heightTile = this.scale.height / (BASE_GAME_HEIGHT / BASE_TILE_WIDTH)
    return Math.max(16, Math.min(widthTile, heightTile))
  }

  private applyBattleTextScale() {
    const tileWidth = this.getTileWidth()
    this.titleText?.setFontSize(Math.round(tileWidth * 0.6))
    this.playerHpLabel?.setFontSize(Math.round(tileWidth * 0.5))
    this.enemyHpLabel?.setFontSize(Math.round(tileWidth * 0.5))
    this.messageText?.setFontSize(Math.round(tileWidth * 0.55))
  }

  private updateTypewriter(nextMessage: string) {
    if (!this.messageText) {
      return
    }

    if (this.currentMessage === nextMessage) {
      return
    }

    this.currentMessage = nextMessage
    this.typingTimer?.remove(false)
    this.typingTimer = undefined
    this.messageText.setText('')

    const chars = Array.from(nextMessage)
    if (chars.length === 0) {
      return
    }

    let index = 0
    this.typingTimer = this.time.addEvent({
      delay: 28,
      repeat: chars.length - 1,
      callback: () => {
        index += 1
        this.messageText?.setText(chars.slice(0, index).join(''))
      },
      callbackScope: this,
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

    if (phase === 'resolved') {
      this.playTone(420)
      this.tweens.add({ targets: this.playerSprite, y: '-=8', yoyo: true, duration: 140, repeat: 2 })
      this.cameras.main.flash(140, 120, 255, 160)
      return
    }

    if (phase === 'caught') {
      this.playTone(520)
      this.tweens.add({ targets: this.enemySprite, x: '+=12', yoyo: true, duration: 90, repeat: 3 })
      this.cameras.main.flash(140, 120, 255, 160)
      return
    }

    if (phase === 'lost') {
      this.playTone(120)
      this.cameras.main.shake(220, 0.007)
    }
  }

  private playBattleStartWarningMusic() {
    const manager = this.sound as { context?: AudioContext }
    const audioCtx = manager.context
    if (!audioCtx) {
      return
    }

    const now = audioCtx.currentTime
    const gain = audioCtx.createGain()
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.035, now + 0.08)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9)
    gain.connect(audioCtx.destination)

    const notes = [740, 660, 820, 620]
    notes.forEach((frequency, idx) => {
      const osc = audioCtx.createOscillator()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(frequency, now + idx * 0.18)
      osc.connect(gain)
      osc.start(now + idx * 0.18)
      osc.stop(now + idx * 0.18 + 0.16)
    })
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
    this.scale.off('resize', this.applyBattleTextScale, this)
    this.unsub?.()
    this.unsub = undefined
    this.endTimer?.remove(false)
    this.endTimer = undefined
    this.typingTimer?.remove(false)
    this.typingTimer = undefined
    this.titleText = undefined
    this.playerHpLabel = undefined
    this.enemyHpLabel = undefined
    this.messageText = undefined
    this.currentMessage = ''
  }
}
