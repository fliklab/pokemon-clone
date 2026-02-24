import { create } from 'zustand'
import { applyDamage, applyEndTurnStatus, calculateDamage } from '../battle/damage'
import { calculateCatchChance, rollCatch } from '../battle/capture'
import type { BattleCommand, BattleSnapshot, Battler } from '../battle/types'
import { createStarterMonster, createWildEnemy, grantBattleExp, type PartyMonster } from '../progression/leveling'

type Encounter = {
  x: number
  y: number
  at: number
}

type TrainerBattle = {
  id: string
  name: string
  badgeReward: string
  enemy: Battler
}

type DirectionalInput = {
  up: boolean
  down: boolean
  left: boolean
  right: boolean
}

type PersistedState = Pick<GameState, 'playerTile' | 'lastEncounter' | 'party' | 'badges' | 'defeatedTrainers' | 'money' | 'potions'>

type GameState = {
  sceneReady: boolean
  playerTile: { x: number; y: number }
  lastEncounter: Encounter | null
  battle: BattleSnapshot & { active: boolean; turn: number; trainerBattle: TrainerBattle | null }
  party: PartyMonster[]
  badges: string[]
  defeatedTrainers: string[]
  money: number
  potions: number
  virtualInput: DirectionalInput
  setSceneReady: (ready: boolean) => void
  setPlayerTile: (x: number, y: number) => void
  triggerEncounter: (x: number, y: number) => void
  triggerTrainerBattle: (trainer: TrainerBattle) => void
  chooseBattleCommand: (command: BattleCommand) => void
  setVirtualInput: (direction: keyof DirectionalInput, active: boolean) => void
  healPartyAtPc: () => void
  buyPotion: () => void
  saveGame: () => void
  loadGame: () => void
  endBattle: () => void
}

const STORAGE_KEY = 'pokemon-clone-save-v1'

const trainerRoster: TrainerBattle[] = [
  {
    id: 'junior-mia',
    name: 'Junior Mia',
    badgeReward: 'Sprout Pin',
    enemy: { name: 'Sparko', level: 6, hp: 34, maxHp: 34, attack: 14, defense: 12, speed: 12, type: 'electric', status: 'none' },
  },
  {
    id: 'ace-ryu',
    name: 'Ace Ryu',
    badgeReward: 'Tide Crest',
    enemy: { name: 'Aquava', level: 7, hp: 38, maxHp: 38, attack: 15, defense: 12, speed: 13, type: 'water', status: 'none' },
  },
  {
    id: 'leader-nova',
    name: 'Leader Nova',
    badgeReward: 'Flare Emblem',
    enemy: { name: 'Flarex', level: 8, hp: 42, maxHp: 42, attack: 16, defense: 13, speed: 14, type: 'fire', status: 'none' },
  },
]

const initialVirtualInput: DirectionalInput = { up: false, down: false, left: false, right: false }

const initialParty = [createStarterMonster()]

const initialBattleState = (party: PartyMonster[]): GameState['battle'] => ({
  active: false,
  phase: 'idle',
  player: party[0],
  enemy: createWildEnemy(party[0].level, 0),
  message: 'Walk in grass to encounter a wild monster.',
  lastDamage: 0,
  turn: 0,
  trainerBattle: null,
})

function getPersistedState(): PersistedState | null {
  if (typeof window === 'undefined') {
    return null
  }

  if (typeof window.localStorage?.getItem !== 'function') {
    return null
  }

  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as PersistedState
  } catch {
    return null
  }
}

function persistState(state: GameState) {
  if (typeof window === 'undefined') {
    return
  }

  if (typeof window.localStorage?.setItem !== 'function') {
    return
  }

  const payload: PersistedState = {
    playerTile: state.playerTile,
    lastEncounter: state.lastEncounter,
    party: state.party,
    badges: state.badges,
    defeatedTrainers: state.defeatedTrainers,
    money: state.money,
    potions: state.potions,
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}

function applyProgressionAfterWin(state: GameState): Pick<GameState, 'party' | 'badges' | 'money'> {
  const [lead, ...rest] = state.party
  const trainerBattle = state.battle.trainerBattle
  const progression = grantBattleExp(lead, state.battle.enemy.level, Boolean(trainerBattle))

  const badges = trainerBattle && !state.badges.includes(trainerBattle.badgeReward)
    ? [...state.badges, trainerBattle.badgeReward]
    : state.badges

  return {
    party: [progression.monster, ...rest],
    badges,
    money: state.money + (trainerBattle ? 45 : 18),
  }
}

function defaultState(): Pick<GameState, 'playerTile' | 'lastEncounter' | 'party' | 'badges' | 'defeatedTrainers' | 'money' | 'potions'> {
  const saved = getPersistedState()
  return saved ?? {
    playerTile: { x: 0, y: 0 },
    lastEncounter: null,
    party: initialParty,
    badges: [],
    defeatedTrainers: [],
    money: 120,
    potions: 1,
  }
}

const bootState = defaultState()

export const useGameStore = create<GameState>((set, get) => ({
  sceneReady: false,
  playerTile: bootState.playerTile,
  lastEncounter: bootState.lastEncounter,
  battle: initialBattleState(bootState.party),
  party: bootState.party,
  badges: bootState.badges,
  defeatedTrainers: bootState.defeatedTrainers,
  money: bootState.money,
  potions: bootState.potions,
  virtualInput: initialVirtualInput,
  setSceneReady: (ready) => set({ sceneReady: ready }),
  setPlayerTile: (x, y) => set({ playerTile: { x, y } }),
  setVirtualInput: (direction, active) => {
    set((state) => ({
      virtualInput: {
        ...state.virtualInput,
        [direction]: active,
      },
    }))
  },
  healPartyAtPc: () => {
    set((state) => {
      const healedParty = state.party.map((monster) => ({ ...monster, hp: monster.maxHp, status: 'none' as const }))
      return {
        party: healedParty,
        battle: state.battle.active ? state.battle : { ...state.battle, player: healedParty[0] },
      }
    })
  },
  buyPotion: () => {
    set((state) => {
      if (state.money < 20) {
        return state
      }

      return {
        money: state.money - 20,
        potions: state.potions + 1,
      }
    })
  },
  saveGame: () => {
    persistState(get())
  },
  loadGame: () => {
    const saved = getPersistedState()
    if (!saved) {
      return
    }

    set((state) => ({
      ...state,
      ...saved,
      battle: initialBattleState(saved.party),
      virtualInput: initialVirtualInput,
    }))
  },
  triggerEncounter: (x, y) => {
    if (get().battle.active) {
      return
    }

    const leadMonster = get().party[0]
    const enemy = createWildEnemy(leadMonster.level, get().badges.length)

    set({
      lastEncounter: {
        x,
        y,
        at: Date.now(),
      },
      battle: {
        active: true,
        phase: 'player_turn',
        player: { ...leadMonster },
        enemy,
        message: `A wild ${enemy.name} appeared!`,
        lastDamage: 0,
        turn: 1,
        trainerBattle: null,
      },
    })
  },
  triggerTrainerBattle: (trainer) => {
    if (get().battle.active || get().defeatedTrainers.includes(trainer.id)) {
      return
    }

    const leadMonster = get().party[0]

    set({
      battle: {
        active: true,
        phase: 'player_turn',
        player: { ...leadMonster },
        enemy: trainer.enemy,
        message: `${trainer.name} challenges you for the ${trainer.badgeReward}!`,
        lastDamage: 0,
        turn: 1,
        trainerBattle: trainer,
      },
    })
  },
  chooseBattleCommand: (command) => {
    const { battle } = get()
    if (!battle.active || battle.phase !== 'player_turn') {
      return
    }

    if (command === 'run') {
      if (battle.trainerBattle) {
        set({
          battle: {
            ...battle,
            message: 'Trainer battles do not allow running away!',
          },
        })
        return
      }

      const escaped = Math.random() < 0.7
      if (escaped) {
        set({
          battle: {
            ...battle,
            phase: 'escaped',
            message: 'Got away safely!',
          },
        })
        return
      }

      set({
        battle: {
          ...battle,
          phase: 'enemy_turn',
          message: 'Could not escape!',
        },
      })
    }

    if (command === 'catch') {
      if (battle.trainerBattle) {
        set({
          battle: {
            ...battle,
            message: 'You cannot catch another trainer’s monster.',
          },
        })
        return
      }

      const chance = calculateCatchChance(battle.enemy)
      const caught = rollCatch(chance)
      if (caught) {
        set({
          battle: {
            ...battle,
            phase: 'caught',
            message: `You caught ${battle.enemy.name}!`,
          },
        })
        return
      }

      set({
        battle: {
          ...battle,
          phase: 'enemy_turn',
          message: `${battle.enemy.name} broke free!`,
        },
      })
    }

    if (command === 'item') {
      if (get().potions <= 0) {
        set({
          battle: {
            ...battle,
            message: 'No potions left! Visit the shop.',
          },
        })
        return
      }

      const healed = Math.min(battle.player.maxHp, battle.player.hp + 12)
      set((state) => ({
        potions: Math.max(0, state.potions - 1),
        battle: {
          ...battle,
          player: { ...battle.player, hp: healed },
          phase: 'enemy_turn',
          message: `${battle.player.name} recovered HP with a potion.`,
        },
      }))
    }

    if (command === 'fight') {
      const playerFirst = battle.player.speed >= battle.enemy.speed
      let player = battle.player
      let enemy = battle.enemy
      let message = ''
      let lastDamage = 0

      const playerAttack = () => {
        const damage = calculateDamage(player, enemy)
        enemy = applyDamage(enemy, damage)
        lastDamage = damage
        message = `${player.name} dealt ${damage} damage!`
      }

      const enemyAttack = () => {
        const damage = calculateDamage(enemy, player)
        player = applyDamage(player, damage)
        message += ` ${enemy.name} dealt ${damage} damage back!`
      }

      if (playerFirst) {
        playerAttack()
        if (enemy.hp > 0) {
          enemyAttack()
        }
      } else {
        enemyAttack()
        if (player.hp > 0) {
          playerAttack()
        }
      }

      player = applyEndTurnStatus(player)
      enemy = applyEndTurnStatus(enemy)

      const phase = enemy.hp <= 0 ? 'resolved' : player.hp <= 0 ? 'lost' : 'player_turn'

      let resolvedMessage = message
      let party = get().party
      let badges = get().badges
      let defeatedTrainers = get().defeatedTrainers
      let money = get().money

      if (phase === 'resolved') {
        const progression = applyProgressionAfterWin(get())
        party = progression.party
        badges = progression.badges
        money = progression.money

        if (battle.trainerBattle && !defeatedTrainers.includes(battle.trainerBattle.id)) {
          defeatedTrainers = [...defeatedTrainers, battle.trainerBattle.id]
        }

        const lead = party[0]
        const evolutionNote = lead.evolutionRule ? '' : ` ${lead.name} has evolved!`
        resolvedMessage += ` Victory! ${lead.name} is now Lv.${lead.level}.${evolutionNote}`
      }

      set({
        battle: {
          ...battle,
          phase,
          player,
          enemy,
          message: resolvedMessage,
          lastDamage,
          turn: battle.turn + 1,
        },
        party,
        badges,
        defeatedTrainers,
        money,
      })
      return
    }

    const updated = get().battle
    if (updated.phase === 'enemy_turn') {
      const retaliation = calculateDamage(updated.enemy, updated.player, 20)
      const playerAfter = applyDamage(updated.player, retaliation)
      set({
        battle: {
          ...updated,
          player: playerAfter,
          phase: playerAfter.hp <= 0 ? 'lost' : 'player_turn',
          message: `${updated.message} ${updated.enemy.name} attacks for ${retaliation}!`,
          turn: updated.turn + 1,
        },
      })
    }
  },
  endBattle: () => set((state) => ({ battle: initialBattleState(state.party) })),
}))

useGameStore.subscribe((state) => {
  persistState(state)
})

export function getGymTrainers(): TrainerBattle[] {
  return trainerRoster
}
