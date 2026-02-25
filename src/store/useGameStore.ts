import { create } from 'zustand'
import { applyDamage, applyEndTurnStatus, calculateDamage } from '../battle/damage'
import { calculateCatchChance, rollCatch } from '../battle/capture'
import { chooseSkill, getSkillById, resolveSkillSlots } from '../battle/skills'
import type { BattleCommand, BattleSnapshot, Battler, ItemId } from '../battle/types'
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

type NearbyNpc = 'shop' | 'pc' | 'oak' | null

type ItemBag = Record<ItemId, number>

type PersistedState = Pick<
  GameState,
  'playerTile' | 'lastEncounter' | 'party' | 'badges' | 'defeatedTrainers' | 'money' | 'itemBag' | 'battle' | 'debugMoveRange' | 'oakIntroSeen'
> & {
  version: 3
}

type LegacyPersistedState = Pick<GameState, 'playerTile' | 'lastEncounter' | 'party' | 'badges' | 'defeatedTrainers' | 'money' | 'potions'>

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
  itemBag: ItemBag
  potions: number
  oakIntroSeen: boolean
  virtualInput: DirectionalInput
  nearbyNpc: NearbyNpc
  interactionNonce: number
  setSceneReady: (ready: boolean) => void
  toggleDebugMoveRange: () => void
  setPlayerTile: (x: number, y: number) => void
  triggerEncounter: (x: number, y: number) => void
  triggerTrainerBattle: (trainer: TrainerBattle) => void
  chooseBattleCommand: (command: BattleCommand, skillId?: string) => void
  switchBattleMonster: (monsterId: string) => void
  setVirtualInput: (direction: keyof DirectionalInput, active: boolean) => void
  setNearbyNpc: (target: NearbyNpc) => void
  requestNpcInteract: () => void
  healPartyAtPc: () => void
  buyPotion: () => void
  consumeBagItem: (itemId: ItemId) => void
  markOakIntroSeen: () => void
  resetGame: () => void
  saveGame: () => void
  loadGame: () => void
  endBattle: () => void
}

const STORAGE_KEY = 'pokemon-clone-save-v3'
const LEGACY_STORAGE_KEY = 'pokemon-clone-save-v2'
const PARTY_CAP = 6
const LOSE_PENALTY = 30
const RESPAWN_TILE = { x: 3, y: 2 }
const AUTOSAVE_DELAY_MS = 300

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

const initialItemBag: ItemBag = {
  potion: 2,
  superPotion: 1,
  antidote: 1,
}

const initialParty = [createStarterMonster()]

const initialBattleState = (party: PartyMonster[]): GameState['battle'] => ({
  active: false,
  phase: 'idle',
  player: party[0],
  enemy: createWildEnemy(party[0].level, 0),
  message: ko.store.walkHint,
  lastDamage: 0,
  lastSkillCast: null,
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
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as PersistedState
      if (parsed.version === 3) {
        return parsed
      }
    } catch {
      return null
    }
  }

  const legacyRaw = window.localStorage.getItem(LEGACY_STORAGE_KEY)
  if (!legacyRaw) {
    return null
  }

  try {
    const legacy = JSON.parse(legacyRaw) as LegacyPersistedState
    return {
      ...legacy,
      itemBag: {
        ...initialItemBag,
        potion: legacy.potions,
      },
      battle: initialBattleState(legacy.party),
      debugMoveRange: false,
      oakIntroSeen: false,
      version: 3,
    }
  } catch {
    return null
  }
}

function toPersistedPayload(state: GameState): PersistedState {
  return {
    playerTile: state.playerTile,
    lastEncounter: state.lastEncounter,
    party: state.party,
    badges: state.badges,
    defeatedTrainers: state.defeatedTrainers,
    money: state.money,
    itemBag: state.itemBag,
    battle: state.battle,
    debugMoveRange: state.debugMoveRange,
    oakIntroSeen: state.oakIntroSeen,
    version: 3,
  }
}

function persistState(state: GameState) {
  if (typeof window === 'undefined') {
    return
  }

  if (typeof window.localStorage?.setItem !== 'function') {
    return
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(toPersistedPayload(state)))
}

let autosaveTimer: ReturnType<typeof setTimeout> | undefined
let lastPersistedSnapshot = ''

function scheduleAutosave(state: GameState) {
  if (typeof window === 'undefined') {
    return
  }

  const nextSnapshot = JSON.stringify(toPersistedPayload(state))
  if (nextSnapshot === lastPersistedSnapshot) {
    return
  }

  if (autosaveTimer) {
    window.clearTimeout(autosaveTimer)
  }

  autosaveTimer = window.setTimeout(() => {
    if (typeof window.localStorage?.setItem === 'function') {
      window.localStorage.setItem(STORAGE_KEY, nextSnapshot)
      lastPersistedSnapshot = nextSnapshot
    }
    autosaveTimer = undefined
  }, AUTOSAVE_DELAY_MS)
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

function applyLossPenalty(state: GameState): Pick<GameState, 'party' | 'money' | 'playerTile'> {
  const healedParty = state.party.map((monster) => ({ ...monster, hp: monster.maxHp, status: 'none' as const }))
  return {
    party: healedParty,
    money: Math.max(0, state.money - LOSE_PENALTY),
    playerTile: RESPAWN_TILE,
  }
}

function defaultState(): Pick<
  GameState,
  'playerTile' | 'lastEncounter' | 'party' | 'badges' | 'defeatedTrainers' | 'money' | 'itemBag' | 'battle' | 'debugMoveRange' | 'oakIntroSeen'
> {
  const saved = getPersistedState()
  if (saved) {
    return {
      playerTile: saved.playerTile,
      lastEncounter: saved.lastEncounter,
      party: saved.party,
      badges: saved.badges,
      defeatedTrainers: saved.defeatedTrainers,
      money: saved.money,
      itemBag: saved.itemBag,
      battle: saved.battle,
      debugMoveRange: saved.debugMoveRange,
      oakIntroSeen: saved.oakIntroSeen,
    }
  }

  return {
    playerTile: { x: 0, y: 0 },
    lastEncounter: null,
    party: initialParty,
    badges: [],
    defeatedTrainers: [],
    money: 120,
    itemBag: initialItemBag,
    battle: initialBattleState(initialParty),
    debugMoveRange: false,
    oakIntroSeen: false,
  }
}

const bootState = defaultState()

export const useGameStore = create<GameState>((set, get) => ({
  sceneReady: false,
  debugMoveRange: bootState.debugMoveRange,
  playerTile: bootState.playerTile,
  lastEncounter: bootState.lastEncounter,
  battle: bootState.battle,
  party: bootState.party,
  badges: bootState.badges,
  defeatedTrainers: bootState.defeatedTrainers,
  money: bootState.money,
  itemBag: bootState.itemBag,
  potions: bootState.itemBag.potion,
  oakIntroSeen: bootState.oakIntroSeen,
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

      const nextBag = { ...state.itemBag, potion: state.itemBag.potion + 1 }
      return {
        money: state.money - 20,
        itemBag: nextBag,
        potions: nextBag.potion,
      }
    })
  },
  consumeBagItem: (itemId) => {
    set((state) => {
      const count = state.itemBag[itemId] ?? 0
      if (count <= 0 || !state.battle.active || state.battle.phase !== 'player_turn') {
        return state
      }

      const nextBag = { ...state.itemBag, [itemId]: Math.max(0, count - 1) }
      const battle = state.battle

      if (itemId === 'antidote') {
        return {
          itemBag: nextBag,
          potions: nextBag.potion,
          battle: {
            ...battle,
            player: { ...battle.player, status: 'none' },
            phase: 'enemy_turn',
            message: ko.store.antidoteUsed(battle.player.name),
          },
        }
      }

      const healAmount = itemId === 'superPotion' ? 24 : 12
      const healed = Math.min(battle.player.maxHp, battle.player.hp + healAmount)

      return {
        itemBag: nextBag,
        potions: nextBag.potion,
        battle: {
          ...battle,
          player: { ...battle.player, hp: healed },
          phase: 'enemy_turn',
          message: ko.store.bagItemUsed(itemId, battle.player.name),
        },
      }
    })
  },
  markOakIntroSeen: () => set({ oakIntroSeen: true }),
  resetGame: () => set(() => {
    const freshParty = [createStarterMonster()]
    return {
      sceneReady: true,
      debugMoveRange: false,
      playerTile: { x: 3, y: 2 },
      lastEncounter: null,
      battle: initialBattleState(freshParty),
      party: freshParty,
      badges: [],
      defeatedTrainers: [],
      money: 120,
      itemBag: initialItemBag,
      potions: initialItemBag.potion,
      oakIntroSeen: false,
      virtualInput: initialVirtualInput,
      nearbyNpc: null,
      interactionNonce: 0,
    }
  }),
  saveGame: () => {
    const state = get()
    persistState(state)
    lastPersistedSnapshot = JSON.stringify(toPersistedPayload(state))
  },
  loadGame: () => {
    const saved = getPersistedState()
    if (!saved) {
      return
    }

    set((state) => ({
      ...state,
      ...saved,
      battle: saved.battle,
      debugMoveRange: saved.debugMoveRange,
      potions: saved.itemBag.potion,
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
        lastSkillCast: null,
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
        lastSkillCast: null,
        turn: 1,
        trainerBattle: trainer,
      },
    })
  },
  chooseBattleCommand: (command, skillId) => {
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

      if (get().party.length >= PARTY_CAP) {
        set({
          battle: {
            ...battle,
            message: ko.store.partyFull,
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
      const bag = get().itemBag
      const fallbackItem = bag.superPotion > 0 ? 'superPotion' : bag.potion > 0 ? 'potion' : bag.antidote > 0 ? 'antidote' : null
      if (!fallbackItem) {
        set({
          battle: {
            ...battle,
            message: ko.store.noBagItem,
          },
        })
        return
      }

      get().consumeBagItem(fallbackItem)
      return
    }

    if (command === 'fight') {
      const playerFirst = battle.player.speed >= battle.enemy.speed
      let player = battle.player
      let enemy = battle.enemy
      let message = ''
      let lastDamage = 0
      let lastSkillCast = battle.lastSkillCast

      const playerAttack = () => {
        const allowedSkillIds = resolveSkillSlots(player).map((entry) => entry.id)
        const skill = skillId && allowedSkillIds.includes(skillId) ? getSkillById(skillId) : chooseSkill(player)
        const damage = calculateDamage(player, enemy, skill.power)
        enemy = applyDamage(enemy, damage)
        lastDamage = damage
        lastSkillCast = { by: 'player', skillId: skill.id, nonce: battle.turn * 2 }
        message = `${player.name} ${skill.name}! ${damage} 데미지!`
      }

      const enemyAttack = () => {
        const skill = chooseSkill(enemy)
        const damage = calculateDamage(enemy, player, skill.power)
        player = applyDamage(player, damage)
        lastSkillCast = { by: 'enemy', skillId: skill.id, nonce: battle.turn * 2 + 1 }
        message += ` ${enemy.name} ${skill.name}! ${damage} 데미지!`
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
          lastSkillCast,
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
      const enemySkill = chooseSkill(updated.enemy)
      const retaliation = calculateDamage(updated.enemy, updated.player, enemySkill.power)
      const playerAfter = applyDamage(updated.player, retaliation)
      set({
        battle: {
          ...updated,
          player: playerAfter,
          phase: playerAfter.hp <= 0 ? 'lost' : 'player_turn',
          message: `${updated.message} ${updated.enemy.name} ${enemySkill.name}! ${retaliation} 데미지!`,
          lastSkillCast: { by: 'enemy', skillId: enemySkill.id, nonce: updated.turn * 3 + 1 },
          turn: updated.turn + 1,
        },
      })
    }
  },
  switchBattleMonster: (monsterId) => {
    const state = get()
    const { battle, party } = state
    if (!battle.active || battle.phase !== 'player_turn') {
      return
    }

    const nextMonster = party.find((monster) => monster.id === monsterId)
    if (!nextMonster || nextMonster.hp <= 0 || nextMonster.id === battle.player.id) {
      return
    }

    const reorderedParty = [nextMonster, ...party.filter((monster) => monster.id !== nextMonster.id)]

    const switchedMessage = ko.store.switchedMonster(nextMonster.name)
    const enemySkill = chooseSkill(battle.enemy)
    const retaliation = calculateDamage(battle.enemy, nextMonster, enemySkill.power)
    const playerAfter = applyDamage(nextMonster, retaliation)

    set({
      party: [{ ...playerAfter }, ...reorderedParty.slice(1)],
      battle: {
        ...battle,
        player: { ...playerAfter },
        phase: playerAfter.hp <= 0 ? 'lost' : 'player_turn',
        message: `${switchedMessage} ${battle.enemy.name} ${enemySkill.name}! ${retaliation} 데미지!`,
        lastSkillCast: { by: 'enemy', skillId: enemySkill.id, nonce: battle.turn * 3 + 2 },
        turn: battle.turn + 1,
      },
    })
  },
  endBattle: () => set((state) => {
    if (state.battle.phase === 'lost') {
      const penalized = applyLossPenalty(state)
      return {
        ...penalized,
        battle: initialBattleState(penalized.party),
      }
    }

    return { battle: initialBattleState(state.party) }
  }),
}))

useGameStore.subscribe((state) => {
  scheduleAutosave(state)
})

export function getGymTrainers(): TrainerBattle[] {
  return trainerRoster
}
