import { useEffect, useMemo, useRef } from 'react'
import type Phaser from 'phaser'
import { createGame } from './game/createGame'
import { ko } from './i18n/ko'
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
      return ko.app.noEncounter
    }

    return ko.app.encounterAt(lastEncounter.x, lastEncounter.y)
  }, [lastEncounter])

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center p-3 md:p-6 gap-4">
      <h1 className="text-2xl md:text-3xl font-bold">{ko.app.title}</h1>
      <p className="text-slate-300 text-sm md:text-base">{ko.app.sceneReady}: {sceneReady ? ko.app.ready : ko.app.loading}</p>
      <p className="text-slate-300 text-sm md:text-base">{ko.app.playerTile}: ({playerTile.x}, {playerTile.y})</p>
      <p className="text-emerald-300 text-sm md:text-base">{encounterText}</p>

      <section className="w-full max-w-5xl grid md:grid-cols-3 gap-3">
        <div className="rounded border border-slate-700 p-3 bg-slate-900/70">
          <h2 className="font-semibold mb-2">{ko.app.party}</h2>
          {party.map((monster) => (
            <div key={monster.id} className="text-sm flex justify-between border-b border-slate-800 py-1">
              <span>{monster.name} Lv.{monster.level}</span>
              <span>EXP {monster.exp}/{monster.nextLevelExp}</span>
            </div>
          ))}
        </div>

        <div className="rounded border border-slate-700 p-3 bg-slate-900/70">
          <h2 className="font-semibold mb-2">{ko.app.gymTrainers}</h2>
          <p className="text-sm text-slate-300">{ko.app.defeated}: {defeatedTrainers.length}/3</p>
          <p className="text-sm text-amber-300">{ko.app.badges}: {badges.length > 0 ? badges.join(', ') : ko.app.noneYet}</p>
        </div>

        <div className="rounded border border-slate-700 p-3 bg-slate-900/70 space-y-2">
          <h2 className="font-semibold">{ko.app.townServices}</h2>
          <p className="text-sm text-emerald-300">₽ {money} · Potions {potions}</p>
          <p className="text-xs text-slate-400">{ko.app.serviceHint}</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <button className="bg-sky-700 p-2 rounded" onClick={buyPotion}>{ko.app.buyPotion}</button>
            <button className="bg-teal-700 p-2 rounded" onClick={healPartyAtPc}>{ko.app.pcHeal}</button>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button className="bg-slate-700 p-2 rounded" onClick={saveGame}>{ko.app.save}</button>
            <button className="bg-slate-700 p-2 rounded" onClick={loadGame}>{ko.app.load}</button>
          </div>
        </div>
      </section>

      <div id="game-root" className="border border-slate-700 rounded overflow-hidden w-full max-w-5xl aspect-[5/3]" />

      <section className="md:hidden w-full max-w-sm bg-slate-900 border border-slate-700 rounded p-3 select-none" style={{ touchAction: 'none' }}>
        <p className="text-xs text-slate-300 mb-2">{ko.app.joystick}</p>
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
            <p>{battle.player.name} {ko.app.battle.hp}: {battle.player.hp}/{battle.player.maxHp}</p>
            <p>{battle.enemy.name} {ko.app.battle.hp}: {battle.enemy.hp}/{battle.enemy.maxHp}</p>
          </div>
          <p className="text-amber-300">{battle.message}</p>

          {battle.phase === 'player_turn' && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <button className="bg-emerald-700 p-2 rounded" onClick={() => chooseBattleCommand('fight')}>{ko.app.battle.fight}</button>
              <button className="bg-cyan-700 p-2 rounded" onClick={() => chooseBattleCommand('item')}>{ko.app.battle.item(potions)}</button>
              <button className="bg-indigo-700 p-2 rounded" onClick={() => chooseBattleCommand('catch')}>{ko.app.battle.catch}</button>
              <button className="bg-rose-700 p-2 rounded" onClick={() => chooseBattleCommand('run')}>{ko.app.battle.run}</button>
            </div>
          )}

          {battle.phase !== 'player_turn' && (
            <button className="bg-slate-700 p-2 rounded" onClick={endBattle}>{ko.app.battle.return}</button>
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
      className="h-14 rounded bg-slate-800 text-xl select-none"
      style={{ touchAction: 'none' }}
      onPointerDown={(event) => {
        event.preventDefault()
        onInput(direction, true)
      }}
      onPointerUp={(event) => {
        event.preventDefault()
        onInput(direction, false)
      }}
      onPointerCancel={() => onInput(direction, false)}
      onPointerLeave={() => onInput(direction, false)}
      onContextMenu={(event) => event.preventDefault()}
    >
      {label}
    </button>
  )
}

export default App
