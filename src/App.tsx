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
  const setSceneReady = useGameStore((state) => state.setSceneReady)
  const chooseBattleCommand = useGameStore((state) => state.chooseBattleCommand)
  const endBattle = useGameStore((state) => state.endBattle)

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
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center p-6 gap-4">
      <h1 className="text-3xl font-bold">Pokemon Clone Starter</h1>
      <p className="text-slate-300">Scene status: {sceneReady ? 'ready' : 'loading'}</p>
      <p className="text-slate-300">Player tile: ({playerTile.x}, {playerTile.y})</p>
      <p className="text-emerald-300">{encounterText}</p>
      <div id="game-root" className="border border-slate-700 rounded overflow-hidden" />

      {battle.active && (
        <section className="w-[800px] bg-slate-900 border border-slate-700 rounded p-4 space-y-3">
          <div className="flex justify-between text-sm">
            <p>{battle.player.name} HP: {battle.player.hp}/{battle.player.maxHp}</p>
            <p>{battle.enemy.name} HP: {battle.enemy.hp}/{battle.enemy.maxHp}</p>
          </div>
          <p className="text-amber-300">{battle.message}</p>

          {battle.phase === 'player_turn' && (
            <div className="grid grid-cols-4 gap-2">
              <button className="bg-emerald-700 p-2 rounded" onClick={() => chooseBattleCommand('fight')}>Fight</button>
              <button className="bg-cyan-700 p-2 rounded" onClick={() => chooseBattleCommand('item')}>Item</button>
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

export default App
