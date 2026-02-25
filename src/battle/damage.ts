import type { Battler, ElementType } from './types'

const TYPE_CHART: Record<ElementType, Partial<Record<ElementType, number>>> = {
  normal: {},
  fire: { grass: 2, water: 0.5 },
  water: { fire: 2, grass: 0.5 },
  grass: { water: 2, fire: 0.5 },
  electric: { water: 2, grass: 0.5 },
}

export function getTypeMultiplier(moveType: ElementType, targetType: ElementType): number {
  return TYPE_CHART[moveType][targetType] ?? 1
}

export function getStatusMultiplier(status: Battler['status']): number {
  if (status === 'burn') {
    return 0.8
  }
  return 1
}

export function calculateDamage(attacker: Battler, defender: Battler, power = 24): number {
  const base = (((2 * attacker.level) / 5 + 2) * power * (attacker.attack / Math.max(1, defender.defense))) / 50 + 2
  const typeMod = getTypeMultiplier(attacker.type, defender.type)
  const statusMod = getStatusMultiplier(attacker.status)
  const randomFactor = 0.85 + Math.random() * 0.15

  return Math.max(1, Math.floor(base * typeMod * statusMod * randomFactor))
}

export function applyDamage<T extends Battler>(target: T, amount: number): T {
  return {
    ...target,
    hp: Math.max(0, target.hp - amount),
  }
}

export function applyEndTurnStatus<T extends Battler>(target: T): T {
  const chip = target.status === 'poison' || target.status === 'burn' ? Math.max(1, Math.floor(target.maxHp * 0.08)) : 0
  if (chip <= 0) {
    return target
  }

  return {
    ...target,
    hp: Math.max(0, target.hp - chip),
  }
}
