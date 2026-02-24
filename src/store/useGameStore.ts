import { create } from 'zustand'
import { applyDamage, applyEndTurnStatus, calculateDamage } from '../battle/damage'
import { calculateCatchChance, rollCatch } from '../battle/capture'
import type { BattleCommand, BattleSnapshot, Battler } from '../battle/types'

type Encounter = {
  x: number
  y: number
  at: number
}

type GameState = {
  sceneReady: boolean
  playerTile: { x: number; y: number }
  lastEncounter: Encounter | null
  battle: BattleSnapshot & { active: boolean; turn: number }
  setSceneReady: (ready: boolean) => void
  setPlayerTile: (x: number, y: number) => void
  triggerEncounter: (x: number, y: number) => void
  chooseBattleCommand: (command: BattleCommand) => void
  endBattle: () => void
}

const defaultPlayer: Battler = {
  name: 'Sproutle',
  level: 5,
  hp: 34,
  maxHp: 34,
  attack: 13,
  defense: 11,
  speed: 12,
  type: 'grass',
  status: 'none',
}

const randomEnemy = (): Battler => ({
  name: Math.random() > 0.5 ? 'Flameling' : 'Aquava',
  level: 4,
  hp: 28,
  maxHp: 28,
  attack: 11,
  defense: 10,
  speed: 10,
  type: Math.random() > 0.5 ? 'fire' : 'water',
  status: 'none',
})

const initialBattleState = (): GameState['battle'] => ({
  active: false,
  phase: 'idle',
  player: defaultPlayer,
  enemy: randomEnemy(),
  message: 'Walk in grass to encounter a wild monster.',
  lastDamage: 0,
  turn: 0,
})

export const useGameStore = create<GameState>((set, get) => ({
  sceneReady: false,
  playerTile: { x: 0, y: 0 },
  lastEncounter: null,
  battle: initialBattleState(),
  setSceneReady: (ready) => set({ sceneReady: ready }),
  setPlayerTile: (x, y) => set({ playerTile: { x, y } }),
  triggerEncounter: (x, y) => {
    if (get().battle.active) {
      return
    }

    const enemy = randomEnemy()
    set({
      lastEncounter: {
        x,
        y,
        at: Date.now(),
      },
      battle: {
        active: true,
        phase: 'player_turn',
        player: defaultPlayer,
        enemy,
        message: `A wild ${enemy.name} appeared!`,
        lastDamage: 0,
        turn: 1,
      },
    })
  },
  chooseBattleCommand: (command) => {
    const { battle } = get()
    if (!battle.active || battle.phase !== 'player_turn') {
      return
    }

    if (command === 'run') {
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
      const healed = Math.min(battle.player.maxHp, battle.player.hp + 8)
      set({
        battle: {
          ...battle,
          player: { ...battle.player, hp: healed },
          phase: 'enemy_turn',
          message: `${battle.player.name} recovered HP with a potion.`,
        },
      })
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

      set({
        battle: {
          ...battle,
          phase,
          player,
          enemy,
          message,
          lastDamage,
          turn: battle.turn + 1,
        },
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
  endBattle: () => set({ battle: initialBattleState() }),
}))
