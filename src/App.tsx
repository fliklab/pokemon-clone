import { useEffect, useMemo, useRef } from 'react'
import type Phaser from 'phaser'
import { createGame } from './game/createGame'
import { useGameStore } from './store/useGameStore'

function App() {
  const gameRef = useRef<Phaser.Game | null>(null)
  const sceneReady = useGameStore((state) => state.sceneReady)
  const playerTile = useGameStore((state) => state.playerTile)
  const lastEncounter = useGameStore((state) => state.lastEncounter)
  const setSceneReady = useGameStore((state) => state.setSceneReady)

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
    </main>
  )
}

export default App
