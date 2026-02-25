import Phaser from 'phaser'
import { getSkillById } from '../../battle/skills'
import { ko } from '../../i18n/ko'
import { useGameStore } from '../../store/useGameStore'

const BASE_GAME_WIDTH = 800
const BASE_GAME_HEIGHT = 480
const BASE_TILE_WIDTH = 32
const TEXT_SCALE_MULTIPLIER = 1.4

type BattleCardUi = {
  container: Phaser.GameObjects.Container
  glow: Phaser.GameObjects.Rectangle
  frame: Phaser.GameObjects.Rectangle
  nameLabel: Phaser.GameObjects.Text
  levelLabel: Phaser.GameObjects.Text
  hpText: Phaser.GameObjects.Text
  expText: Phaser.GameObjects.Text
  hpTrack: Phaser.GameObjects.Rectangle
  hpFill: Phaser.GameObjects.Rectangle
  expTrack: Phaser.GameObjects.Rectangle
  expFill: Phaser.GameObjects.Rectangle
  icon: Phaser.GameObjects.Text
  statusChip: Phaser.GameObjects.Text
  faintOverlay: Phaser.GameObjects.Rectangle
  sparkle: Phaser.GameObjects.Text
  turnBadge: Phaser.GameObjects.Text
}

export class BattleScene extends Phaser.Scene {
  private unsub?: () => void
  private endTimer?: Phaser.Time.TimerEvent
  private typingTimer?: Phaser.Time.TimerEvent
  private playerSprite?: Phaser.GameObjects.Text
  private enemySprite?: Phaser.GameObjects.Text
  private titleText?: Phaser.GameObjects.Text
  private messageText?: Phaser.GameObjects.Text
  private playerCard?: BattleCardUi
  private enemyCard?: BattleCardUi
  private partyContainer?: Phaser.GameObjects.Container
  private phaseCursor = ''
  private currentMessage = ''
  private lastSkillNonce = -1
  private attackParticleTextureKey = 'battle-attack-particle'

  constructor() {
    super('battle')
  }

  create() {
    try {
      this.cameras.main.setBackgroundColor('#1e293b')
      this.createAttackParticleTexture()

    this.add.rectangle(400, 350, 250, 100, 0x334155)
    this.add.rectangle(650, 130, 180, 80, 0x475569)

    this.playerSprite = this.add.text(300, 320, '🧢', { fontSize: '48px' }).setDepth(4)
    this.enemySprite = this.add.text(630, 95, '🐾', { fontSize: '42px' }).setDepth(4)

    this.titleText = this.add.text(40, 30, ko.battleScene.title, { color: '#e2e8f0', fontSize: '24px' })

    this.playerCard = this.createBattleCard(36, 242, true)
    this.enemyCard = this.createBattleCard(482, 26, false)

    this.partyContainer = this.add.container(22, 14)
    const partyFrame = this.add.rectangle(0, 0, 190, 70, 0x0f172a, 0.66).setOrigin(0, 0)
    partyFrame.setStrokeStyle(1, 0x64748b, 0.8)
    const partyTitle = this.add.text(12, 8, '파티 HUD', { color: '#94a3b8', fontSize: '12px' })
    const partyIcon = this.add.text(12, 26, '🎒', { fontSize: '18px' })
    const partyHint = this.add.text(38, 30, '상태 효과/경험치 실시간 반영', { color: '#cbd5e1', fontSize: '11px' })
    this.partyContainer.add([partyFrame, partyTitle, partyIcon, partyHint])
    this.partyContainer.setDepth(8)

    this.messageText = this.add.text(40, 420, '', {
      color: '#f8fafc',
      fontSize: '16px',
      wordWrap: { width: 720 },
    })

    this.applyUiFadeIn()
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
      this.syncBattleCard(this.playerCard, {
        name: battle.player.name,
        level: battle.player.level,
        hp: battle.player.hp,
        maxHp: battle.player.maxHp,
        exp: state.party[0]?.exp ?? 0,
        nextLevelExp: state.party[0]?.nextLevelExp ?? 1,
        status: battle.player.status,
        isTurn: battle.phase === 'player_turn',
        isTrainer: false,
      })
      this.syncBattleCard(this.enemyCard, {
        name: battle.enemy.name,
        level: battle.enemy.level,
        hp: battle.enemy.hp,
        maxHp: battle.enemy.maxHp,
        exp: 0,
        nextLevelExp: 1,
        status: battle.enemy.status,
        isTurn: battle.phase === 'enemy_turn',
        isTrainer: Boolean(battle.trainerBattle),
      })

      this.applyMinorPolishes(battle.phase)
      this.applyPlaceholders(battle.phase)
      this.applySkillCastFx(battle.lastSkillCast)

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
    } catch (error) {
      console.error('[battle] create failed', { error })
      throw error
    }
  }

  private createBattleCard(x: number, y: number, playerSide: boolean): BattleCardUi {
    const container = this.add.container(x, y)
    const glow = this.add.rectangle(0, 0, 296, 128, playerSide ? 0x22c55e : 0x60a5fa, 0.16).setOrigin(0, 0)
    const frame = this.add.rectangle(0, 0, 286, 118, 0x0f172a, 0.88).setOrigin(0, 0)
    frame.setStrokeStyle(2, playerSide ? 0x22c55e : 0x60a5fa, 0.9)
    const icon = this.add.text(12, 10, playerSide ? '🟢' : '🔵', { fontSize: '16px' })
    const nameLabel = this.add.text(36, 10, '-', { color: '#e2e8f0', fontSize: '15px' })
    const levelLabel = this.add.text(224, 10, 'Lv.1', { color: '#fef08a', fontSize: '13px' })
    const hpText = this.add.text(12, 36, 'HP 0/0', { color: '#cbd5e1', fontSize: '12px' })
    const expText = this.add.text(12, 74, 'EXP 0/1', { color: '#93c5fd', fontSize: '12px' })

    const hpTrack = this.add.rectangle(12, 58, 252, 12, 0x1e293b).setOrigin(0, 0.5)
    const hpFill = this.add.rectangle(12, 58, 252, 12, 0x22c55e).setOrigin(0, 0.5)
    const expTrack = this.add.rectangle(12, 96, 252, 8, 0x1e293b).setOrigin(0, 0.5)
    const expFill = this.add.rectangle(12, 96, 252, 8, 0x38bdf8).setOrigin(0, 0.5)

    const statusChip = this.add.text(210, 35, '정상', {
      color: '#0f172a',
      backgroundColor: '#86efac',
      fontSize: '11px',
      padding: { x: 6, y: 2 },
    })

    const faintOverlay = this.add.rectangle(0, 0, 286, 118, 0x020617, 0).setOrigin(0, 0)
    const sparkle = this.add.text(260, 84, '✨', { fontSize: '14px' }).setAlpha(0)
    const turnBadge = this.add.text(228, 84, '턴', {
      color: '#ffffff',
      backgroundColor: '#1d4ed8',
      fontSize: '10px',
      padding: { x: 4, y: 1 },
    }).setAlpha(0.15)

    container.add([
      glow,
      frame,
      icon,
      nameLabel,
      levelLabel,
      hpText,
      hpTrack,
      hpFill,
      expText,
      expTrack,
      expFill,
      statusChip,
      faintOverlay,
      sparkle,
      turnBadge,
    ])

    return {
      container,
      glow,
      frame,
      nameLabel,
      levelLabel,
      hpText,
      expText,
      hpTrack,
      hpFill,
      expTrack,
      expFill,
      icon,
      statusChip,
      faintOverlay,
      sparkle,
      turnBadge,
    }
  }

  private syncBattleCard(
    card: BattleCardUi | undefined,
    model: {
      name: string
      level: number
      hp: number
      maxHp: number
      exp: number
      nextLevelExp: number
      status: 'none' | 'burn' | 'poison'
      isTurn: boolean
      isTrainer: boolean
    },
  ) {
    if (!card) {
      return
    }

    const hpRatio = Phaser.Math.Clamp(model.hp / Math.max(1, model.maxHp), 0, 1)
    const expRatio = Phaser.Math.Clamp(model.exp / Math.max(1, model.nextLevelExp), 0, 1)

    card.nameLabel.setText(model.name)
    card.levelLabel.setText(`Lv.${model.level}`)
    card.hpText.setText(`HP ${model.hp}/${model.maxHp}`)
    card.expText.setText(`EXP ${model.exp}/${model.nextLevelExp}`)

    card.hpFill.width = 252 * hpRatio
    card.expFill.width = 252 * expRatio

    card.hpFill.fillColor = hpRatio > 0.5 ? 0x22c55e : hpRatio > 0.2 ? 0xf59e0b : 0xef4444
    card.frame.setStrokeStyle(2, model.level >= 8 ? 0xfacc15 : model.isTrainer ? 0x93c5fd : 0x22c55e, 0.95)
    card.glow.fillColor = model.isTurn ? 0x38bdf8 : hpRatio <= 0.25 ? 0xef4444 : 0x22c55e
    card.glow.setAlpha(model.isTurn ? 0.32 : hpRatio <= 0.25 ? 0.22 : 0.12)

    const statusUi = this.resolveStatusUi(model.status)
    card.statusChip.setText(statusUi.label)
    card.statusChip.setBackgroundColor(statusUi.bg)
    card.statusChip.setColor(statusUi.color)

    card.faintOverlay.setAlpha(model.hp <= 0 ? 0.7 : 0)
    card.turnBadge.setAlpha(model.isTurn ? 1 : 0.15)

    const sparkleVisible = model.level >= 8 || (model.exp > 0 && expRatio > 0.9)
    card.sparkle.setAlpha(sparkleVisible ? 1 : 0)

    if (sparkleVisible) {
      this.tweens.add({
        targets: card.sparkle,
        y: 84,
        alpha: { from: 0.25, to: 1 },
        duration: 700,
        yoyo: true,
        repeat: 0,
      })
    }

    if (model.isTurn) {
      this.tweens.add({
        targets: card.glow,
        alpha: { from: card.glow.alpha, to: Math.min(0.45, card.glow.alpha + 0.1) },
        duration: 160,
        yoyo: true,
      })
    }
  }

  private resolveStatusUi(status: 'none' | 'burn' | 'poison') {
    if (status === 'burn') {
      return { label: '화상', bg: '#fb7185', color: '#ffffff' }
    }
    if (status === 'poison') {
      return { label: '중독', bg: '#c084fc', color: '#ffffff' }
    }
    return { label: '정상', bg: '#86efac', color: '#0f172a' }
  }

  private applyMinorPolishes(phase: string) {
    if (!this.playerSprite || !this.enemySprite) {
      return
    }

    if (phase === 'player_turn') {
      this.tweens.add({ targets: this.playerSprite, scale: 1.08, yoyo: true, duration: 180 }) // 턴 강조
      return
    }

    if (phase === 'enemy_turn') {
      this.tweens.add({ targets: this.enemySprite, scale: 1.1, yoyo: true, duration: 180 }) // 적 턴 강조
      return
    }

    if (phase === 'lost') {
      this.playerSprite.setTint(0x475569) // 빈사 톤다운
      return
    }

    this.playerSprite.clearTint()
    this.enemySprite.clearTint()
  }

  private getTileWidth() {
    const widthTile = this.scale.width / (BASE_GAME_WIDTH / BASE_TILE_WIDTH)
    const heightTile = this.scale.height / (BASE_GAME_HEIGHT / BASE_TILE_WIDTH)
    return Math.max(16, Math.min(widthTile, heightTile))
  }

  private applyBattleTextScale() {
    const tileWidth = this.getTileWidth()
    this.titleText?.setFontSize(Math.round(tileWidth * 0.6 * TEXT_SCALE_MULTIPLIER))
    this.messageText?.setFontSize(Math.round(tileWidth * 0.55 * TEXT_SCALE_MULTIPLIER))

    const cardFont = Math.max(Math.round(11 * TEXT_SCALE_MULTIPLIER), Math.round(tileWidth * 0.42 * TEXT_SCALE_MULTIPLIER))
    this.playerCard?.nameLabel.setFontSize(cardFont + 2)
    this.enemyCard?.nameLabel.setFontSize(cardFont + 2)
    this.playerCard?.hpText.setFontSize(cardFont)
    this.enemyCard?.hpText.setFontSize(cardFont)
    this.playerCard?.expText.setFontSize(cardFont)
    this.enemyCard?.expText.setFontSize(cardFont)
  }

  private applyUiFadeIn() {
    const uiTargets = [
      this.titleText,
      this.messageText,
      this.playerCard?.container,
      this.enemyCard?.container,
      this.partyContainer,
      this.playerSprite,
      this.enemySprite,
    ].filter(Boolean)

    uiTargets.forEach((target, index) => {
      const gameObject = target as Phaser.GameObjects.GameObject & { setAlpha: (value: number) => unknown }
      gameObject.setAlpha(0)
      this.tweens.add({
        targets: gameObject,
        alpha: 1,
        duration: 220,
        delay: index * 35,
        ease: 'Quad.easeOut',
      })
    })
  }

  private createAttackParticleTexture() {
    if (this.textures.exists(this.attackParticleTextureKey)) {
      return
    }

    const graphics = this.add.graphics({ x: 0, y: 0 })
    graphics.fillStyle(0xffffff)
    graphics.fillCircle(4, 4, 4)
    graphics.generateTexture(this.attackParticleTextureKey, 8, 8)
    graphics.destroy()
  }

  private emitAttackParticles(from: Phaser.GameObjects.Text | undefined, to: Phaser.GameObjects.Text | undefined, hue: number) {
    if (!from || !to) {
      return
    }

    const emitter = this.add.particles(from.x, from.y, this.attackParticleTextureKey, {
      speed: { min: 50, max: 140 },
      lifespan: 260,
      scale: { start: 0.8, end: 0 },
      quantity: 8,
      tint: [hue, 0xffffff],
      blendMode: 'ADD',
      emitting: false,
    })

    emitter.explode(14, from.x, from.y)
    emitter.explode(10, to.x, to.y)

    this.tweens.add({
      targets: emitter,
      x: to.x,
      y: to.y,
      duration: 180,
      onComplete: () => emitter.destroy(),
    })
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
      this.triggerScreenShake('heavy')
    }
  }

  private triggerScreenShake(power: 'light' | 'medium' | 'heavy') {
    const intensity = power === 'heavy' ? 0.012 : power === 'medium' ? 0.007 : 0.003
    const duration = power === 'heavy' ? 220 : power === 'medium' ? 150 : 90
    this.cameras.main.shake(duration, intensity)
  }

  private applySkillCastFx(skillCast: { by: 'player' | 'enemy'; skillId: string; nonce: number } | null) {
    if (!skillCast || skillCast.nonce === this.lastSkillNonce) {
      return
    }

    this.lastSkillNonce = skillCast.nonce
    const skill = getSkillById(skillCast.skillId)
    const attackerSprite = skillCast.by === 'player' ? this.playerSprite : this.enemySprite
    const targetSprite = skillCast.by === 'player' ? this.enemySprite : this.playerSprite

    if (skill.animation === 'wave') {
      this.emitAttackParticles(attackerSprite, targetSprite, 0x38bdf8)
      this.tweens.add({ targets: targetSprite, y: '-=10', yoyo: true, duration: 90, repeat: 1 })
      this.cameras.main.flash(100, 120, 180, 255)
      this.triggerScreenShake('light')
    } else if (skill.animation === 'burst') {
      this.emitAttackParticles(attackerSprite, targetSprite, 0xf97316)
      this.tweens.add({ targets: targetSprite, scale: 1.15, yoyo: true, duration: 120 })
      this.cameras.main.flash(100, 255, 160, 120)
      this.triggerScreenShake('medium')
    } else if (skill.animation === 'spark') {
      this.emitAttackParticles(attackerSprite, targetSprite, 0xfef08a)
      this.tweens.add({ targets: targetSprite, angle: 12, yoyo: true, duration: 60, repeat: 2 })
      this.cameras.main.flash(80, 255, 255, 130)
      this.triggerScreenShake('light')
    } else if (skill.animation === 'whip') {
      this.emitAttackParticles(attackerSprite, targetSprite, 0xa78bfa)
      this.tweens.add({ targets: targetSprite, x: '+=8', yoyo: true, duration: 70, repeat: 2 })
      this.triggerScreenShake('medium')
    } else {
      this.emitAttackParticles(attackerSprite, targetSprite, 0xffffff)
      this.tweens.add({ targets: targetSprite, x: '+=16', yoyo: true, duration: 80 })
      this.triggerScreenShake('light')
    }

    this.playSkillTone(skill.sfx)
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

  private playSkillTone(sfx: 'pluck' | 'flame' | 'splash' | 'zap' | 'hit') {
    if (sfx === 'pluck') {
      this.playTone(280)
      return
    }
    if (sfx === 'flame') {
      this.playTone(360)
      return
    }
    if (sfx === 'splash') {
      this.playTone(240)
      return
    }
    if (sfx === 'zap') {
      this.playTone(520)
      return
    }
    this.playTone(190)
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
    this.messageText = undefined
    this.playerCard = undefined
    this.enemyCard = undefined
    this.partyContainer = undefined
    this.currentMessage = ''
    this.lastSkillNonce = -1
  }
}
