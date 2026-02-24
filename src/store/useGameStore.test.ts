import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useGameStore } from './useGameStore'

function resetStore() {
  useGameStore.setState({
    sceneReady: false,
    playerTile: { x: 0, y: 0 },
    lastEncounter: null,
    battle: {
      active: false,
      phase: 'idle',
      player: useGameStore.getState().party[0],
      enemy: {
        name: 'Wildling',
        level: 3,
        hp: 22,
        maxHp: 22,
        attack: 10,
        defense: 8,
        speed: 9,
        type: 'normal',
        status: 'none',
      },
      message: 'Walk in grass to encounter a wild monster.',
      lastDamage: 0,
      turn: 0,
      trainerBattle: null,
    },
    party: [useGameStore.getState().party[0]],
    badges: [],
    defeatedTrainers: [],
    virtualInput: { up: false, down: false, left: false, right: false },
  })
}

describe('battle flow endings', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    resetStore()
  })

  it('starts battle on encounter and resolves catch flow', () => {
    const store = useGameStore.getState()
    store.triggerEncounter(3, 4)

    expect(useGameStore.getState().battle.active).toBe(true)

    vi.spyOn(Math, 'random').mockReturnValue(0)
    useGameStore.getState().chooseBattleCommand('catch')

    expect(useGameStore.getState().battle.phase).toBe('caught')

    useGameStore.getState().endBattle()
    expect(useGameStore.getState().battle.active).toBe(false)
    expect(useGameStore.getState().battle.phase).toBe('idle')
  })

  it('resolves win flow', () => {
    useGameStore.setState((state) => ({
      battle: {
        ...state.battle,
        active: true,
        phase: 'player_turn',
        player: { ...state.party[0], attack: 999, speed: 999 },
        enemy: { ...state.battle.enemy, hp: 1, maxHp: 1, defense: 1, speed: 1 },
      },
    }))

    useGameStore.getState().chooseBattleCommand('fight')

    expect(useGameStore.getState().battle.phase).toBe('resolved')

    useGameStore.getState().endBattle()
    expect(useGameStore.getState().battle.active).toBe(false)
  })

  it('resolves lose flow', () => {
    useGameStore.setState((state) => ({
      battle: {
        ...state.battle,
        active: true,
        phase: 'player_turn',
        player: { ...state.party[0], hp: 1, maxHp: 20, defense: 1, speed: 1 },
        enemy: { ...state.battle.enemy, attack: 999, speed: 999 },
      },
    }))

    useGameStore.getState().chooseBattleCommand('fight')

    expect(useGameStore.getState().battle.phase).toBe('lost')

    useGameStore.getState().endBattle()
    expect(useGameStore.getState().battle.active).toBe(false)
  })
})
