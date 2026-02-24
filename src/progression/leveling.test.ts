import { describe, expect, it } from 'vitest'
import { createStarterMonster, grantBattleExp } from './leveling'

describe('leveling progression', () => {
  it('levels up and can evolve with enough trainer exp', () => {
    let monster = createStarterMonster()

    for (let i = 0; i < 8; i += 1) {
      monster = grantBattleExp(monster, 8, true).monster
    }

    expect(monster.level).toBeGreaterThanOrEqual(8)
    expect(monster.name).toBe('Florabram')
    expect(monster.evolutionRule).toBeUndefined()
  })
})
