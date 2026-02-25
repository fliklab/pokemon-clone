import { describe, expect, it, vi } from 'vitest'
import { createStarterMonster, createWildEnemy, grantBattleExp } from './leveling'

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

  it('keeps wild enemy name and type aligned', () => {
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.8)

    const fireEnemy = createWildEnemy(5, 0)
    expect(fireEnemy.name).toBe('Flameling')
    expect(fireEnemy.type).toBe('fire')

    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.2)

    const waterEnemy = createWildEnemy(5, 0)
    expect(waterEnemy.name).toBe('Aquava')
    expect(waterEnemy.type).toBe('water')

    vi.restoreAllMocks()
  })
})
