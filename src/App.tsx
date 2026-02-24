import { useEffect, useMemo, useRef } from 'react'
import type Phaser from 'phaser'
import { createGame } from './game/createGame'
import { useGameStore } from './store/useGameStore'

function App() {
  const gameRef = useRef<Phaser.Game | null>(null)
  const sceneReady = useGameStore((state) => state.sceneReady)
  const playerTile = useGameStore((state) => state.playerTile)
  const lastEncounter = useGameStore((state) => state.lastEncounter)
  const battle = useGameStore((state) => state.battle)
  const party = useGameStore((state) => state.party)
  const badges = useGameStore((state) => state.badges)
  const defeatedTrainers = useGameStore((state) => state.defeatedTrainers)
  const money = useGameStore((state) => state.money)
  const potions = useGameStore((state) => state.potions)
  const setSceneReady = useGameStore((state) => state.setSceneReady)
  const chooseBattleCommand = useGameStore((state) => state.chooseBattleCommand)
  const healPartyAtPc = useGameStore((state) => state.healPartyAtPc)
  const buyPotion = useGameStore((state) => state.buyPotion)
  const saveGame = useGameStore((state) => state.saveGame)
  const loadGame = useGameStore((state) => state.loadGame)
  const endBattle = useGameStore((state) => state.endBattle)
  const setVirtualInput = useGameStore((state) => state.setVirtualInput)

  useEffect(() => {
    if (!gameRef.current) {
      gameRef.current = createGame('game-root', () => setSceneReady(true))
    }

    return () => {
      gameRef.current?.destroy(true)
      gameRef.current = null
      setSceneReady(false)
    }
  }, [setSceneReady])

  const encounterText = useMemo(() => {
    if (!lastEncounter) {
      return 'No encounter yet'
    }

    return `Encounter at (${lastEncounter.x}, ${lastEncounter.y})`
  }, [lastEncounter])

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center p-3 md:p-6 gap-4">
      <h1 className="text-2xl md:text-3xl font-bold">Pokemon Clone Starter</h1>
      <p className="text-slate-300 text-sm md:text-base">Scene status: {sceneReady ? 'ready' : 'loading'}</p>
      <p className="text-slate-300 text-sm md:text-base">Player tile: ({playerTile.x}, {playerTile.y})</p>
      <p className="text-emerald-300 text-sm md:text-base">{encounterText}</p>

      <section className="w-full max-w-5xl grid md:grid-cols-3 gap-3">
        <div className="rounded border border-slate-700 p-3 bg-slate-900/70">
          <h2 className="font-semibold mb-2">Party</h2>
          {party.map((monster) => (
            <div key={monster.id} className="text-sm flex justify-between border-b border-slate-800 py-1">
              <span>{monster.name} Lv.{monster.level}</span>
              <span>EXP {monster.exp}/{monster.nextLevelExp}</span>
            </div>
          ))}
        </div>

        <div className="rounded border border-slate-700 p-3 bg-slate-900/70">
          <h2 className="font-semibold mb-2">Gym Trainers</h2>
          <p className="text-sm text-slate-300">Defeated: {defeatedTrainers.length}/3</p>
          <p className="text-sm text-amber-300">Badges: {badges.length > 0 ? badges.join(', ') : 'None yet'}</p>
        </div>

        <div className="rounded border border-slate-700 p-3 bg-slate-900/70 space-y-2">
          <h2 className="font-semibold">Town Services</h2>
          <p className="text-sm text-emerald-300">₽ {money} · Potions {potions}</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <button className="bg-sky-700 p-2 rounded" onClick={buyPotion}>Shop: Buy Potion (₽20)</button>
            <button className="bg-teal-700 p-2 rounded" onClick={healPartyAtPc}>PC Heal</button>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button className="bg-slate-700 p-2 rounded" onClick={saveGame}>Save (localStorage)</button>
            <button className="bg-slate-700 p-2 rounded" onClick={loadGame}>Load Save</button>
          </div>
        </div>
      </section>

      <div id="game-root" className="border border-slate-700 rounded overflow-hidden w-full max-w-5xl aspect-[5/3]" />

      <section className="md:hidden w-full max-w-sm bg-slate-900 border border-slate-700 rounded p-3">
        <p className="text-xs text-slate-300 mb-2">Virtual Joystick</p>
        <div className="grid grid-cols-3 gap-2">
          <span />
          <DirectionButton direction="up" label="↑" onInput={setVirtualInput} />
          <span />
          <DirectionButton direction="left" label="←" onInput={setVirtualInput} />
          <DirectionButton direction="down" label="↓" onInput={setVirtualInput} />
          <DirectionButton direction="right" label="→" onInput={setVirtualInput} />
        </div>
      </section>

      {battle.active && (
        <section className="fixed md:static bottom-3 left-1/2 md:left-auto -translate-x-1/2 md:translate-x-0 z-50 w-[calc(100%-1.5rem)] md:w-full max-w-sm md:max-w-5xl bg-slate-900/95 border border-slate-700 rounded p-4 space-y-3 shadow-2xl">
          <div className="flex justify-between text-sm">
            <p>{battle.player.name} HP: {battle.player.hp}/{battle.player.maxHp}</p>
            <p>{battle.enemy.name} HP: {battle.enemy.hp}/{battle.enemy.maxHp}</p>
          </div>
          <p className="text-amber-300">{battle.message}</p>

          {battle.phase === 'player_turn' && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <button className="bg-emerald-700 p-2 rounded" onClick={() => chooseBattleCommand('fight')}>Fight</button>
              <button className="bg-cyan-700 p-2 rounded" onClick={() => chooseBattleCommand('item')}>Item ({potions})</button>
              <button className="bg-indigo-700 p-2 rounded" onClick={() => chooseBattleCommand('catch')}>Catch</button>
              <button className="bg-rose-700 p-2 rounded" onClick={() => chooseBattleCommand('run')}>Run</button>
            </div>
          )}

          {battle.phase !== 'player_turn' && (
            <button className="bg-slate-700 p-2 rounded" onClick={endBattle}>Return to overworld</button>
          )}
        </section>
      )}
    </main>
  )
}

type DirectionButtonProps = {
  direction: 'up' | 'down' | 'left' | 'right'
  label: string
  onInput: (direction: 'up' | 'down' | 'left' | 'right', active: boolean) => void
}

function DirectionButton({ direction, label, onInput }: DirectionButtonProps) {
  return (
    <button
      className="h-14 rounded bg-slate-800 text-xl"
      onPointerDown={() => onInput(direction, true)}
      onPointerUp={() => onInput(direction, false)}
      onPointerCancel={() => onInput(direction, false)}
      onPointerLeave={() => onInput(direction, false)}
      onContextMenu={(event) => event.preventDefault()}
    >
      {label}
    </button>
  )
}

export default App
