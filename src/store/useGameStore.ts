import { create } from 'zustand'
import { applyDamage, applyEndTurnStatus, calculateDamage } from '../battle/damage'
import { calculateCatchChance, rollCatch } from '../battle/capture'
import type { BattleCommand, BattleSnapshot, Battler } from '../battle/types'
import { createStarterMonster, createWildEnemy, expForNextLevel, grantBattleExp, type PartyMonster } from '../progression/leveling'
import { ko } from '../i18n/ko'

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

type NearbyNpc = 'shop' | 'pc' | null

type PersistedState = Pick<GameState, 'playerTile' | 'lastEncounter' | 'party' | 'badges' | 'defeatedTrainers' | 'money' | 'potions'>

type GameState = {
  sceneReady: boolean
  debugMoveRange: boolean
  playerTile: { x: number; y: number }
  lastEncounter: Encounter | null
  battle: BattleSnapshot & { active: boolean; turn: number; trainerBattle: TrainerBattle | null }
  party: PartyMonster[]
  badges: string[]
  defeatedTrainers: string[]
  money: number
  potions: number
  virtualInput: DirectionalInput
  nearbyNpc: NearbyNpc
  interactionNonce: number
  setSceneReady: (ready: boolean) => void
  toggleDebugMoveRange: () => void
  setPlayerTile: (x: number, y: number) => void
  triggerEncounter: (x: number, y: number) => void
  triggerTrainerBattle: (trainer: TrainerBattle) => void
  chooseBattleCommand: (command: BattleCommand) => void
  setVirtualInput: (direction: keyof DirectionalInput, active: boolean) => void
  setNearbyNpc: (target: NearbyNpc) => void
  requestNpcInteract: () => void
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
    name: ko.trainers.juniorMia,
    badgeReward: ko.trainers.sproutPin,
    enemy: { name: 'Sparko', level: 6, hp: 34, maxHp: 34, attack: 14, defense: 12, speed: 12, type: 'electric', status: 'none' },
  },
  {
    id: 'ace-ryu',
    name: ko.trainers.aceRyu,
    badgeReward: ko.trainers.tideCrest,
    enemy: { name: 'Aquava', level: 7, hp: 38, maxHp: 38, attack: 15, defense: 12, speed: 13, type: 'water', status: 'none' },
  },
  {
    id: 'leader-nova',
    name: ko.trainers.leaderNova,
    badgeReward: ko.trainers.flareEmblem,
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
  message: ko.store.walkHint,
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

function toCaughtPartyMonster(enemy: Battler): PartyMonster {
  return {
    ...enemy,
    id: `${enemy.name.toLowerCase()}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    exp: 0,
    nextLevelExp: expForNextLevel(enemy.level),
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
  debugMoveRange: false,
  playerTile: bootState.playerTile,
  lastEncounter: bootState.lastEncounter,
  battle: initialBattleState(bootState.party),
  party: bootState.party,
  badges: bootState.badges,
  defeatedTrainers: bootState.defeatedTrainers,
  money: bootState.money,
  potions: bootState.potions,
  virtualInput: initialVirtualInput,
  nearbyNpc: null,
  interactionNonce: 0,
  setSceneReady: (ready) => set({ sceneReady: ready }),
  toggleDebugMoveRange: () => set((state) => ({ debugMoveRange: !state.debugMoveRange })),
  setPlayerTile: (x, y) => set({ playerTile: { x, y } }),
  setVirtualInput: (direction, active) => {
    set((state) => ({
      virtualInput: {
        ...state.virtualInput,
        [direction]: active,
      },
    }))
  },
  setNearbyNpc: (target) => set({ nearbyNpc: target }),
  requestNpcInteract: () => set((state) => ({ interactionNonce: state.interactionNonce + 1 })),
  healPartyAtPc: () => {
    set((state) => {
      if (state.nearbyNpc !== 'pc') {
        return state
      }

      const healedParty = state.party.map((monster) => ({ ...monster, hp: monster.maxHp, status: 'none' as const }))
      return {
        party: healedParty,
        battle: state.battle.active ? state.battle : { ...state.battle, player: healedParty[0] },
      }
    })
  },
  buyPotion: () => {
    set((state) => {
      if (state.nearbyNpc !== 'shop' || state.money < 20) {
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
      nearbyNpc: null,
      interactionNonce: 0,
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
        message: ko.store.wildAppeared(enemy.name),
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
        message: ko.store.trainerChallenge(trainer.name, trainer.badgeReward),
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
            message: ko.store.trainerNoRun,
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
            message: ko.store.escaped,
          },
        })
        return
      }

      set({
        battle: {
          ...battle,
          phase: 'enemy_turn',
          message: ko.store.failedEscape,
        },
      })
    }

    if (command === 'catch') {
      if (battle.trainerBattle) {
        set({
          battle: {
            ...battle,
            message: ko.store.cannotCatchTrainerMonster,
          },
        })
        return
      }

      const chance = calculateCatchChance(battle.enemy)
      const caught = rollCatch(chance)
      if (caught) {
        const caughtMonster = toCaughtPartyMonster(battle.enemy)
        set((state) => ({
          battle: {
            ...battle,
            phase: 'caught',
            message: ko.store.caught(battle.enemy.name),
          },
          party: [...state.party, caughtMonster],
        }))
        return
      }

      set({
        battle: {
          ...battle,
          phase: 'enemy_turn',
          message: ko.store.brokeFree(battle.enemy.name),
        },
      })
    }

    if (command === 'item') {
      if (get().potions <= 0) {
        set({
          battle: {
            ...battle,
            message: ko.store.noPotion,
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
          message: ko.store.potionUsed(battle.player.name),
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
        message = ko.store.dealtDamage(player.name, damage)
      }

      const enemyAttack = () => {
        const damage = calculateDamage(enemy, player)
        player = applyDamage(player, damage)
        message += ` ${ko.store.dealtDamageBack(enemy.name, damage)}`
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
        const evolutionNote = lead.evolutionRule ? '' : ko.store.evolved(lead.name)
        resolvedMessage += ko.store.victory(lead.name, lead.level, evolutionNote)
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
          message: `${updated.message} ${ko.store.enemyAttack(updated.enemy.name, retaliation)}`,
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
