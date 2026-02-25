export type BattleCommand = 'fight' | 'item' | 'catch' | 'run'

export type BattleUiMenu = BattleCommand | null

export type ItemId = 'potion' | 'superPotion' | 'antidote'

export type BattleStatus = 'idle' | 'player_turn' | 'enemy_turn' | 'resolved' | 'escaped' | 'caught' | 'lost'

export type ElementType = 'normal' | 'fire' | 'water' | 'grass' | 'electric'

export type StatusEffect = 'none' | 'burn' | 'poison'

export type Battler = {
  id?: string
  name: string
  level: number
  hp: number
  maxHp: number
  attack: number
  defense: number
  speed: number
  type: ElementType
  status: StatusEffect
  knownSkills?: string[]
}

export type SkillCast = {
  by: 'player' | 'enemy'
  skillId: string
  nonce: number
}

export type BattleSnapshot = {
  phase: BattleStatus
  uiMenu: BattleUiMenu
  player: Battler
  enemy: Battler
  message: string
  lastDamage: number
  lastSkillCast: SkillCast | null
}
