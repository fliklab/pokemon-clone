export type BattleCommand = 'fight' | 'item' | 'catch' | 'run'

export type BattleStatus = 'idle' | 'player_turn' | 'enemy_turn' | 'resolved' | 'escaped' | 'caught' | 'lost'

export type ElementType = 'normal' | 'fire' | 'water' | 'grass' | 'electric'

export type StatusEffect = 'none' | 'burn' | 'poison'

export type Battler = {
  name: string
  level: number
  hp: number
  maxHp: number
  attack: number
  defense: number
  speed: number
  type: ElementType
  status: StatusEffect
}

export type BattleSnapshot = {
  phase: BattleStatus
  player: Battler
  enemy: Battler
  message: string
  lastDamage: number
}
