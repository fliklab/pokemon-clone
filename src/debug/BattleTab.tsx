import { useMemo, useState } from 'react'
import { calculateDamage } from '../battle/damage'
import { getSkillById, resolveSkillSlots } from '../battle/skills'
import type { Battler } from '../battle/types'
import { createStarterMonster, createWildEnemy } from '../progression/leveling'
import { getGymTrainers } from '../store/useGameStore'

function cloneBattler(battler: Battler): Battler {
  return { ...battler }
}

export function BattleTab() {
  const trainers = useMemo(() => getGymTrainers(), [])
  const [trainerId, setTrainerId] = useState(trainers[0]?.id ?? 'wild')
  const [player, setPlayer] = useState<Battler>(() => createStarterMonster())
  const [enemy, setEnemy] = useState<Battler>(() => createWildEnemy(5, 0))
  const [moveId, setMoveId] = useState(resolveSkillSlots(player)[0]?.id ?? 'tackle')
  const [logs, setLogs] = useState<string[]>([])
  const [turn, setTurn] = useState(1)
  const [animTick, setAnimTick] = useState(0)

  const playerMoves = resolveSkillSlots(player)

  const resetBattle = (nextTrainerId: string) => {
    const starter = createStarterMonster()
    const trainer = trainers.find((entry) => entry.id === nextTrainerId)
    const foe = trainer ? trainer.enemy : createWildEnemy(starter.level, 0)

    setTrainerId(nextTrainerId)
    setPlayer(starter)
    setEnemy(cloneBattler(foe))
    setMoveId(resolveSkillSlots(starter)[0]?.id ?? 'tackle')
    setLogs([`[init] ${trainer ? trainer.name : 'Wild battle'} loaded`])
    setTurn(1)
    setAnimTick(0)
  }

  const runTurn = () => {
    if (player.hp <= 0 || enemy.hp <= 0) {
      setLogs((prev) => [`[done] Battle ended`, ...prev])
      return
    }

    const skill = getSkillById(moveId)
    const playerNext = cloneBattler(player)
    const enemyNext = cloneBattler(enemy)

    const playerDamage = calculateDamage(playerNext, enemyNext, skill.power)
    enemyNext.hp = Math.max(0, enemyNext.hp - playerDamage)

    const nextLogs = [`[turn ${turn}] player uses ${skill.name} → ${playerDamage} dmg (enemy hp ${enemyNext.hp})`]

    if (enemyNext.hp > 0) {
      const aiSkill = resolveSkillSlots(enemyNext)[0]
      const retaliation = calculateDamage(enemyNext, playerNext, aiSkill.power)
      playerNext.hp = Math.max(0, playerNext.hp - retaliation)
      nextLogs.push(`[ai] enemy uses ${aiSkill.name} → ${retaliation} dmg (player hp ${playerNext.hp})`)
    } else {
      nextLogs.push('[ai] enemy fainted')
    }

    if (playerNext.hp <= 0) {
      nextLogs.push('[result] player lost')
    }
    if (enemyNext.hp <= 0) {
      nextLogs.push('[result] player win')
    }

    setPlayer(playerNext)
    setEnemy(enemyNext)
    setLogs((prev) => [...nextLogs.reverse(), ...prev].slice(0, 80))
    setTurn((prev) => prev + 1)
    setAnimTick((prev) => prev + 1)
  }

  return (
    <section className="space-y-4">
      <div className="grid gap-2 md:grid-cols-3">
        <label className="text-sm space-y-1">
          <span className="text-slate-300">Trainer</span>
          <select
            className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-2"
            value={trainerId}
            onChange={(event) => resetBattle(event.target.value)}
          >
            <option value="wild">Wild</option>
            {trainers.map((trainer) => (
              <option key={trainer.id} value={trainer.id}>{trainer.name}</option>
            ))}
          </select>
        </label>

        <label className="text-sm space-y-1">
          <span className="text-slate-300">Pokémon Lv</span>
          <input
            type="number"
            min={1}
            max={50}
            value={player.level}
            onChange={(event) => {
              const level = Number(event.target.value)
              const starter = createStarterMonster()
              starter.level = level
              starter.maxHp = 32 + level * 2
              starter.hp = starter.maxHp
              starter.attack = 12 + level
              starter.defense = 10 + Math.floor(level / 2)
              setPlayer(starter)
              setMoveId(resolveSkillSlots(starter)[0]?.id ?? 'tackle')
            }}
            className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-2"
          />
        </label>

        <label className="text-sm space-y-1">
          <span className="text-slate-300">Move</span>
          <select className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-2" value={moveId} onChange={(event) => setMoveId(event.target.value)}>
            {playerMoves.map((move) => (
              <option key={move.id} value={move.id}>{move.name}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded border border-slate-700 bg-slate-900 p-3">
          <p className="font-semibold">Player {player.name}</p>
          <p className="text-sm text-slate-300">HP {player.hp}/{player.maxHp}</p>
          <div className="h-2 mt-2 rounded bg-slate-800 overflow-hidden">
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(player.hp / player.maxHp) * 100}%` }} />
          </div>
        </div>

        <div className="rounded border border-slate-700 bg-slate-900 p-3">
          <p className="font-semibold">Enemy {enemy.name}</p>
          <p className="text-sm text-slate-300">HP {enemy.hp}/{enemy.maxHp}</p>
          <div className="h-2 mt-2 rounded bg-slate-800 overflow-hidden">
            <div
              className={`h-full transition-all ${animTick % 2 === 0 ? 'bg-rose-500' : 'bg-amber-400'}`}
              style={{ width: `${(enemy.hp / enemy.maxHp) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button className="rounded bg-emerald-700 px-3 py-2" onClick={runTurn}>Sim Turn</button>
        <button className="rounded bg-slate-700 px-3 py-2" onClick={() => resetBattle(trainerId)}>Reset</button>
      </div>

      <div className="rounded border border-slate-700 bg-slate-950 p-3">
        <p className="font-semibold mb-2">AI/Battle Logs</p>
        <ul className="space-y-1 max-h-56 overflow-auto text-xs text-slate-300">
          {logs.map((log, index) => (
            <li key={`${index}-${log}`}>{log}</li>
          ))}
        </ul>
      </div>
    </section>
  )
}
