import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react'
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import type Phaser from 'phaser'
import { createGame } from './game/createGame'
import { ko } from './i18n/ko'
import { useGameStore } from './store/useGameStore'

type ModalType = 'menu' | 'party' | 'inventory' | 'shop' | 'pc' | 'save' | 'save-confirm' | null

function App() {
  const gameRef = useRef<Phaser.Game | null>(null)
  const [activeModal, setActiveModal] = useState<ModalType>(null)
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

  const openModal = (modal: Exclude<ModalType, null>) => setActiveModal(modal)
  const closeModal = () => setActiveModal(null)

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
          <button
            className="w-full bg-violet-700 active:bg-violet-600 p-3 rounded text-sm font-semibold"
            onClick={() => openModal('menu')}
          >
            {ko.app.menu.open}
          </button>
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

      <BaseModal open={activeModal === 'menu'} onClose={closeModal} title={ko.app.menu.title}>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <MenuAction label={ko.app.menu.party} onClick={() => openModal('party')} />
          <MenuAction label={ko.app.menu.inventory} onClick={() => openModal('inventory')} />
          <MenuAction label={ko.app.menu.shop} onClick={() => openModal('shop')} />
          <MenuAction label={ko.app.menu.pc} onClick={() => openModal('pc')} />
          <MenuAction label={ko.app.menu.save} onClick={() => openModal('save')} className="col-span-2" />
        </div>
      </BaseModal>

      <BaseModal open={activeModal === 'party'} onClose={closeModal} title={ko.app.modal.partyTitle}>
        <div className="space-y-2 text-sm">
          {party.map((monster) => (
            <div key={monster.id} className="rounded border border-slate-700 p-2 bg-slate-800/70">
              <p className="font-semibold">{monster.name} · Lv.{monster.level}</p>
              <p className="text-slate-300">{ko.app.modal.hp(monster.hp, monster.maxHp)} · EXP {monster.exp}/{monster.nextLevelExp}</p>
            </div>
          ))}
        </div>
      </BaseModal>

      <BaseModal open={activeModal === 'inventory'} onClose={closeModal} title={ko.app.modal.inventoryTitle}>
        <div className="text-sm space-y-2">
          <p className="text-emerald-300">{ko.app.modal.money(money)}</p>
          {potions > 0 ? (
            <div className="rounded border border-slate-700 p-2 bg-slate-800/70 flex items-center justify-between">
              <span>포션</span>
              <span>{ko.app.modal.potions(potions)}</span>
            </div>
          ) : (
            <p className="text-slate-400">{ko.app.modal.inventoryEmpty}</p>
          )}
        </div>
      </BaseModal>

      <BaseModal open={activeModal === 'shop'} onClose={closeModal} title={ko.app.modal.shopTitle}>
        <div className="space-y-3 text-sm">
          <p className="text-emerald-300">{ko.app.modal.money(money)}</p>
          <button
            className="w-full rounded bg-sky-700 active:bg-sky-600 p-3 font-semibold disabled:opacity-50"
            onClick={buyPotion}
            disabled={money < 20}
          >
            {ko.app.modal.buyPotion}
          </button>
        </div>
      </BaseModal>

      <BaseModal open={activeModal === 'pc'} onClose={closeModal} title={ko.app.modal.pcTitle}>
        <div className="space-y-2 text-sm">
          <button
            className="w-full rounded bg-teal-700 active:bg-teal-600 p-3 font-semibold"
            onClick={healPartyAtPc}
          >
            {ko.app.modal.healParty}
          </button>
          <button
            className="w-full rounded bg-indigo-700 active:bg-indigo-600 p-3 font-semibold"
            onClick={() => openModal('party')}
          >
            {ko.app.modal.viewParty}
          </button>
        </div>
      </BaseModal>

      <BaseModal open={activeModal === 'save'} onClose={closeModal} title={ko.app.modal.saveTitle}>
        <div className="space-y-3 text-sm">
          <p className="text-slate-300">{ko.app.modal.saveDesc}</p>
          <div className="grid grid-cols-2 gap-2">
            <button className="rounded bg-slate-700 active:bg-slate-600 p-3" onClick={() => openModal('save-confirm')}>
              {ko.app.modal.saveNow}
            </button>
            <button className="rounded bg-slate-700 active:bg-slate-600 p-3" onClick={loadGame}>
              {ko.app.modal.loadNow}
            </button>
          </div>
        </div>
      </BaseModal>

      <BaseModal open={activeModal === 'save-confirm'} onClose={() => openModal('save')} title={ko.app.modal.confirmSaveTitle}>
        <div className="space-y-3 text-sm">
          <p className="text-slate-300">{ko.app.modal.confirmSaveDesc}</p>
          <div className="grid grid-cols-2 gap-2">
            <button className="rounded bg-emerald-700 active:bg-emerald-600 p-3" onClick={() => { saveGame(); closeModal() }}>
              {ko.app.modal.confirm}
            </button>
            <button className="rounded bg-slate-700 active:bg-slate-600 p-3" onClick={() => openModal('save')}>
              {ko.app.modal.cancel}
            </button>
          </div>
        </div>
      </BaseModal>

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

type BaseModalProps = {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}

function BaseModal({ open, onClose, title, children }: BaseModalProps) {
  return (
    <Dialog open={open} onClose={onClose} className="relative z-[70]">
      <DialogBackdrop className="fixed inset-0 bg-black/60" />
      <div className="fixed inset-0 flex items-end md:items-center justify-center p-2 md:p-4">
        <DialogPanel className="w-full max-w-md rounded-t-2xl md:rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-2xl">
          <div className="flex items-center justify-between mb-3">
            <DialogTitle className="font-semibold">{title}</DialogTitle>
            <button className="text-xs px-2 py-1 rounded bg-slate-700" onClick={onClose}>{ko.app.menu.close}</button>
          </div>
          {children}
        </DialogPanel>
      </div>
    </Dialog>
  )
}

type MenuActionProps = {
  label: string
  onClick: () => void
  className?: string
}

function MenuAction({ label, onClick, className }: MenuActionProps) {
  return (
    <button className={`rounded bg-violet-700 active:bg-violet-600 p-3 font-semibold ${className ?? ''}`} onClick={onClick}>
      {label}
    </button>
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
