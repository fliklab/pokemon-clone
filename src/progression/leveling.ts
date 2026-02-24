import type { Battler, ElementType } from '../battle/types'

export type EvolutionRule = {
  level: number
  toName: string
  toType?: ElementType
  attackBonus: number
  defenseBonus: number
  speedBonus: number
  hpBonus: number
}

export type PartyMonster = Battler & {
  id: string
  exp: number
  nextLevelExp: number
  evolutionRule?: EvolutionRule
}

export type ProgressionResult = {
  monster: PartyMonster
  leveledUp: boolean
  evolved: boolean
}

const NEXT_EXP_BASE = 18

export function expForNextLevel(level: number): number {
  return NEXT_EXP_BASE + level * 6
}

export function createStarterMonster(): PartyMonster {
  return {
    id: 'sproutle-1',
    name: 'Sproutle',
    level: 5,
    hp: 34,
    maxHp: 34,
    attack: 13,
    defense: 11,
    speed: 12,
    type: 'grass',
    status: 'none',
    exp: 0,
    nextLevelExp: expForNextLevel(5),
    evolutionRule: {
      level: 8,
      toName: 'Florabram',
      toType: 'grass',
      attackBonus: 4,
      defenseBonus: 3,
      speedBonus: 2,
      hpBonus: 8,
    },
  }
}

export function createWildEnemy(): Battler {
  return {
    name: Math.random() > 0.5 ? 'Flameling' : 'Aquava',
    level: 4,
    hp: 28,
    maxHp: 28,
    attack: 11,
    defense: 10,
    speed: 10,
    type: Math.random() > 0.5 ? 'fire' : 'water',
    status: 'none',
  }
}

export function grantBattleExp(monster: PartyMonster, foeLevel: number, trainerBattle: boolean): ProgressionResult {
  const bonus = trainerBattle ? 8 : 0
  const earned = Math.max(6, foeLevel * 4 + bonus)
  let updated: PartyMonster = { ...monster, exp: monster.exp + earned }
  let leveledUp = false

  while (updated.exp >= updated.nextLevelExp) {
    updated = levelUp(updated)
    leveledUp = true
  }

  const { monster: evolvedMonster, evolved } = maybeEvolve(updated)
  return { monster: evolvedMonster, leveledUp, evolved }
}

function levelUp(monster: PartyMonster): PartyMonster {
  const nextLevel = monster.level + 1
  const remainingExp = monster.exp - monster.nextLevelExp
  return {
    ...monster,
    level: nextLevel,
    exp: Math.max(0, remainingExp),
    nextLevelExp: expForNextLevel(nextLevel),
    maxHp: monster.maxHp + 3,
    hp: monster.maxHp + 3,
    attack: monster.attack + 2,
    defense: monster.defense + 2,
    speed: monster.speed + 1,
  }
}

export function maybeEvolve(monster: PartyMonster): { monster: PartyMonster; evolved: boolean } {
  const rule = monster.evolutionRule
  if (!rule || monster.level < rule.level) {
    return { monster, evolved: false }
  }

  return {
    evolved: true,
    monster: {
      ...monster,
      name: rule.toName,
      type: rule.toType ?? monster.type,
      maxHp: monster.maxHp + rule.hpBonus,
      hp: monster.maxHp + rule.hpBonus,
      attack: monster.attack + rule.attackBonus,
      defense: monster.defense + rule.defenseBonus,
      speed: monster.speed + rule.speedBonus,
      evolutionRule: undefined,
    },
  }
}
