import { describe, expect, it, vi } from 'vitest'
import { calculateDamage, getTypeMultiplier } from './damage'
import { calculateCatchChance } from './capture'
import type { Battler } from './types'

const attacker: Battler = {
  name: 'A',
  level: 10,
  hp: 30,
  maxHp: 30,
  attack: 14,
  defense: 10,
  speed: 10,
  type: 'fire',
  status: 'none',
}

const defender: Battler = {
  name: 'B',
  level: 10,
  hp: 30,
  maxHp: 30,
  attack: 12,
  defense: 12,
  speed: 9,
  type: 'grass',
  status: 'none',
}

describe('battle formula', () => {
  it('applies type multiplier', () => {
    expect(getTypeMultiplier('fire', 'grass')).toBe(2)
    expect(getTypeMultiplier('fire', 'water')).toBe(0.5)
  })

  it('calculates positive damage', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const damage = calculateDamage(attacker, defender)
    expect(damage).toBeGreaterThan(0)
  })

  it('increases catch chance with low hp', () => {
    const fullHp = calculateCatchChance(defender)
    const lowHp = calculateCatchChance({ ...defender, hp: 3 })
    expect(lowHp).toBeGreaterThan(fullHp)
  })
})
