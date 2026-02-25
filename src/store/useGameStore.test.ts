import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ko } from '../i18n/ko'
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
      lastSkillCast: null,
      turn: 0,
      trainerBattle: null,
    },
    party: [useGameStore.getState().party[0]],
    badges: [],
    defeatedTrainers: [],
    money: 120,
    potions: 1,
    debugMode: false,
    nearbyNpc: null,
    interactionNonce: 0,
    virtualInput: { up: false, down: false, left: false, right: false },
  })
}

describe('battle flow endings', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
    if (typeof window.localStorage.clear === 'function') {
      window.localStorage.clear()
    }
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

  it('switches to selected party monster during battle', () => {
    useGameStore.setState((state) => {
      const ally = {
        ...state.party[0],
        id: 'ally-2',
        name: 'Aquava',
        type: 'water' as const,
        hp: 32,
        maxHp: 32,
        defense: 30,
      }

      return {
        party: [state.party[0], ally],
        battle: {
          ...state.battle,
          active: true,
          phase: 'player_turn',
          player: { ...state.party[0] },
          enemy: { ...state.battle.enemy, attack: 1 },
        },
      }
    })

    vi.spyOn(Math, 'random').mockReturnValue(0)
    useGameStore.getState().switchBattleMonster('ally-2')

    const state = useGameStore.getState()
    expect(state.battle.player.id).toBe('ally-2')
    expect(state.party[0].id).toBe('ally-2')
    expect(state.battle.turn).toBe(1)
  })

  it('prevents catch when party is full at 6', () => {
    useGameStore.setState((state) => {
      const fullParty = Array.from({ length: 6 }, (_, idx) => ({
        ...state.party[0],
        id: `mon-${idx}`,
      }))

      return {
        party: fullParty,
        battle: {
          ...state.battle,
          active: true,
          phase: 'player_turn',
          player: fullParty[0],
        },
      }
    })

    useGameStore.getState().chooseBattleCommand('catch')

    const state = useGameStore.getState()
    expect(state.party).toHaveLength(6)
    expect(state.battle.phase).toBe('player_turn')
    expect(state.battle.message).toBe(ko.store.partyFull)
  })

  it('applies lose penalty and respawns on endBattle', () => {
    useGameStore.setState((state) => ({
      money: 120,
      playerTile: { x: 9, y: 9 },
      battle: {
        ...state.battle,
        active: true,
        phase: 'lost',
      },
      party: [{ ...state.party[0], hp: 1, status: 'poison' as const }],
    }))

    useGameStore.getState().endBattle()

    const state = useGameStore.getState()
    expect(state.money).toBe(90)
    expect(state.playerTile).toEqual({ x: 3, y: 2 })
    expect(state.party[0].hp).toBe(state.party[0].maxHp)
    expect(state.party[0].status).toBe('none')
  })

  it('debounces autosave timing', () => {
    vi.useFakeTimers()
    const originalStorage = window.localStorage
    const setItemSpy = vi.fn()

    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(() => null),
        setItem: setItemSpy,
      },
      configurable: true,
    })

    useGameStore.getState().setPlayerTile(1, 1)
    useGameStore.getState().setPlayerTile(2, 2)
    useGameStore.getState().setPlayerTile(3, 3)

    expect(setItemSpy).not.toHaveBeenCalled()

    vi.advanceTimersByTime(301)

    expect(setItemSpy).toHaveBeenCalledTimes(2)

    Object.defineProperty(window, 'localStorage', {
      value: originalStorage,
      configurable: true,
    })
  })
})
