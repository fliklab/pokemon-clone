import type { Battler } from './types'

export function calculateCatchChance(enemy: Battler, ballModifier = 1): number {
  const hpFactor = ((3 * enemy.maxHp - 2 * enemy.hp) / (3 * enemy.maxHp))
  const statusBonus = enemy.status === 'none' ? 1 : 1.35
  return Math.max(0.05, Math.min(0.95, hpFactor * ballModifier * statusBonus * 0.55))
}

export function rollCatch(chance: number): boolean {
  return Math.random() < chance
}
