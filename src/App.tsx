import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react'
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type Phaser from 'phaser'
import { resolveSkillSlots } from './battle/skills'
import type { ItemId } from './battle/types'
import { createGame } from './game/createGame'
import { ko } from './i18n/ko'
import { useGameStore } from './store/useGameStore'

type ModalType = 'menu' | 'party' | 'inventory' | 'shop' | 'pc' | 'save' | 'save-confirm' | 'new-game-confirm' | 'oak-intro' | null

function App() {
  const gameRef = useRef<Phaser.Game | null>(null)
  const gameCanvasContainerRef = useRef<HTMLDivElement | null>(null)
  const [activeModal, setActiveModal] = useState<ModalType>(null)
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null)
  const lastEncounter = useGameStore((state) => state.lastEncounter)
  const battle = useGameStore((state) => state.battle)
  const nearbyNpc = useGameStore((state) => state.nearbyNpc)
  const interactionNonce = useGameStore((state) => state.interactionNonce)
  const party = useGameStore((state) => state.party)
  const money = useGameStore((state) => state.money)
  const itemBag = useGameStore((state) => state.itemBag)
  const oakIntroSeen = useGameStore((state) => state.oakIntroSeen)
  const setSceneReady = useGameStore((state) => state.setSceneReady)
  const chooseBattleCommand = useGameStore((state) => state.chooseBattleCommand)
  const switchBattleMonster = useGameStore((state) => state.switchBattleMonster)
  const healPartyAtPc = useGameStore((state) => state.healPartyAtPc)
  const buyPotion = useGameStore((state) => state.buyPotion)
  const consumeBagItem = useGameStore((state) => state.consumeBagItem)
  const markOakIntroSeen = useGameStore((state) => state.markOakIntroSeen)
  const resetGame = useGameStore((state) => state.resetGame)
  const saveGame = useGameStore((state) => state.saveGame)
  const loadGame = useGameStore((state) => state.loadGame)
  const endBattle = useGameStore((state) => state.endBattle)
  const setVirtualInput = useGameStore((state) => state.setVirtualInput)
  const requestNpcInteract = useGameStore((state) => state.requestNpcInteract)
  const debugMoveRange = useGameStore((state) => state.debugMoveRange)
  const toggleDebugMoveRange = useGameStore((state) => state.toggleDebugMoveRange)

  const focusGameCanvas = useCallback(() => {
    gameCanvasContainerRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!gameRef.current) {
      gameRef.current = createGame('game-root', () => setSceneReady(true))
    }

    const frame = window.requestAnimationFrame(() => {
      focusGameCanvas()
    })

    return () => {
      window.cancelAnimationFrame(frame)
      gameRef.current?.destroy(true)
      gameRef.current = null
      setSceneReady(false)
    }
  }, [focusGameCanvas, setSceneReady])

  const encounterText = useMemo(() => {
    if (!lastEncounter) {
      return ko.app.noEncounter
    }

    return ko.app.encounterAt(lastEncounter.x, lastEncounter.y)
  }, [lastEncounter])

  const openModal = (modal: Exclude<ModalType, null>) => setActiveModal(modal)
  const closeModal = () => {
    setActiveModal(null)
    window.requestAnimationFrame(() => {
      focusGameCanvas()
    })
  }

  const returnToOverworldInput = useCallback(() => {
    setVirtualInput('up', false)
    setVirtualInput('down', false)
    setVirtualInput('left', false)
    setVirtualInput('right', false)

    if (!gameRef.current) {
      return
    }

    if (!gameRef.current.scene.isActive('overworld')) {
      gameRef.current.scene.start('overworld')
    } else {
      gameRef.current.scene.resume('overworld')
      gameRef.current.scene.wake('overworld')
    }

    window.requestAnimationFrame(() => {
      focusGameCanvas()
    })
  }, [focusGameCanvas, setVirtualInput])

  const endedBattle = battle.phase === 'caught' || battle.phase === 'resolved' || battle.phase === 'lost' || battle.phase === 'escaped'
  const canOpenShop = nearbyNpc === 'shop'
  const canOpenPc = nearbyNpc === 'pc'
  const selectedPartyMonster = party.find((monster) => monster.id === selectedPartyId) ?? party[0]
  const skillSlots = useMemo(() => resolveSkillSlots(battle.player), [battle.player])
  const bagEntries = useMemo(() => (
    [
      { id: 'potion' as ItemId, label: ko.app.items.potion },
      { id: 'superPotion' as ItemId, label: ko.app.items.superPotion },
      { id: 'antidote' as ItemId, label: ko.app.items.antidote },
    ]
  ), [])

  useEffect(() => {
    if (oakIntroSeen) {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      setActiveModal('oak-intro')
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [oakIntroSeen])

  useEffect(() => {
    if (interactionNonce === 0) {
      return
    }

    const modal = nearbyNpc === 'shop' ? 'shop' : nearbyNpc === 'pc' ? 'pc' : nearbyNpc === 'oak' ? 'oak-intro' : null
    if (!modal) {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      setActiveModal(modal)
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [interactionNonce, nearbyNpc, oakIntroSeen])

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center p-3 md:p-6 gap-4">
      <div className="w-full max-w-5xl flex items-center justify-between">
        <h1 className="text-xl md:text-2xl font-bold">{ko.app.title}</h1>
        <button
          className="h-10 w-10 rounded-full bg-slate-800 border border-slate-600 text-xl leading-none hover:bg-slate-700 active:bg-slate-700"
          onClick={() => openModal('menu')}
          aria-label="설정 메뉴 열기"
        >
          ⚙
        </button>
      </div>

      <p className="text-emerald-300 text-sm md:text-base">{encounterText}</p>

      <div
        ref={gameCanvasContainerRef}
        tabIndex={0}
        className="border border-slate-700 rounded overflow-hidden w-full max-w-5xl aspect-[5/3] focus:outline-none focus:ring-2 focus:ring-violet-500"
        style={{ touchAction: 'none' }}
        aria-label="게임 화면"
      >
        <div id="game-root" className="w-full h-full" />
      </div>

      <section className="md:hidden w-full max-w-sm bg-slate-900 border border-slate-700 rounded p-3 select-none" style={{ touchAction: 'none' }}>
        <p className="text-xs text-slate-300 mb-2">{ko.app.joystick}</p>
        <div className="grid grid-cols-4 gap-2">
          <span />
          <DirectionButton direction="up" label="↑" onInput={setVirtualInput} />
          <span />
          <ActionButton label={ko.app.talkButton} onClick={requestNpcInteract} disabled={!nearbyNpc} />
          <DirectionButton direction="left" label="←" onInput={setVirtualInput} />
          <DirectionButton direction="down" label="↓" onInput={setVirtualInput} />
          <DirectionButton direction="right" label="→" onInput={setVirtualInput} />
          <p className="col-span-1 text-[11px] text-slate-400 self-center text-center">
            {nearbyNpc ? ko.app.talkEnabled : ko.app.talkDisabled}
          </p>
        </div>
      </section>

      <BaseModal open={activeModal === 'menu'} onClose={closeModal} title={ko.app.menu.title}>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <MenuAction label={ko.app.menu.party} onClick={() => openModal('party')} />
          <MenuAction label={ko.app.menu.inventory} onClick={() => openModal('inventory')} />
          <MenuAction
            label={ko.app.menu.debugMoveRange(debugMoveRange)}
            onClick={toggleDebugMoveRange}
            className="col-span-2"
          />
          <MenuAction label={ko.app.menu.save} onClick={() => openModal('save')} className="col-span-2" />
        </div>
      </BaseModal>

      <BaseModal open={activeModal === 'party'} onClose={closeModal} title={ko.app.modal.partyTitle}>
        <div className="space-y-3 text-sm">
          <p className="text-xs text-slate-400">포획한 포켓몬: {party.length}마리</p>
          <div className="max-h-44 overflow-y-auto space-y-2">
            {party.map((monster) => (
              <button
                key={monster.id}
                className={`w-full text-left rounded border p-2 ${selectedPartyMonster?.id === monster.id ? 'border-violet-400 bg-violet-900/30' : 'border-slate-700 bg-slate-800/70'}`}
                onClick={() => setSelectedPartyId(monster.id)}
              >
                <p className="font-semibold">{monster.name} · Lv.{monster.level}</p>
                <p className="text-slate-300">{ko.app.modal.hp(monster.hp, monster.maxHp)}</p>
              </button>
            ))}
          </div>
          {selectedPartyMonster && (
            <div className="rounded border border-slate-700 p-2 bg-slate-900/70 space-y-2">
              <p className="font-semibold">상세 정보</p>
              <p>타입: {selectedPartyMonster.type}</p>
              <p>공격 {selectedPartyMonster.attack} · 방어 {selectedPartyMonster.defense} · 스피드 {selectedPartyMonster.speed}</p>
              <p>EXP {selectedPartyMonster.exp}/{selectedPartyMonster.nextLevelExp}</p>
              {battle.active && battle.phase === 'player_turn' && (
                <button
                  className="w-full rounded bg-violet-700 active:bg-violet-600 p-2 font-semibold disabled:opacity-50"
                  onClick={() => switchBattleMonster(selectedPartyMonster.id)}
                  disabled={selectedPartyMonster.id === battle.player.id || selectedPartyMonster.hp <= 0}
                >
                  이 포켓몬으로 교체
                </button>
              )}
            </div>
          )}
        </div>
      </BaseModal>

      <BaseModal open={activeModal === 'inventory'} onClose={closeModal} title={ko.app.modal.inventoryTitle}>
        <div className="text-sm space-y-2">
          <p className="text-emerald-300">{ko.app.modal.money(money)}</p>
          {bagEntries.some((entry) => itemBag[entry.id] > 0) ? (
            <div className="space-y-2">
              {bagEntries.map((entry) => (
                <div key={entry.id} className="rounded border border-slate-700 p-2 bg-slate-800/70 flex items-center justify-between">
                  <span>{entry.label}</span>
                  <span>{ko.app.modal.itemCount(itemBag[entry.id])}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-400">{ko.app.modal.inventoryEmpty}</p>
          )}
        </div>
      </BaseModal>

      <BaseModal open={activeModal === 'shop'} onClose={closeModal} title={ko.app.modal.shopTitle}>
        <div className="space-y-3 text-sm">
          <p className="text-emerald-300">{ko.app.modal.money(money)}</p>
          {!canOpenShop && <p className="text-amber-300 text-xs">상점 NPC 근처에서 A(말걸기)로 이용할 수 있습니다.</p>}
          <button
            className="w-full rounded bg-sky-700 active:bg-sky-600 p-3 font-semibold disabled:opacity-50"
            onClick={buyPotion}
            disabled={money < 20 || !canOpenShop}
          >
            {ko.app.modal.buyPotion}
          </button>
        </div>
      </BaseModal>

      <BaseModal open={activeModal === 'pc'} onClose={closeModal} title={ko.app.modal.pcTitle}>
        <div className="space-y-2 text-sm">
          {!canOpenPc && <p className="text-amber-300 text-xs">PC NPC 근처에서 A(말걸기)로 이용할 수 있습니다.</p>}
          <button
            className="w-full rounded bg-teal-700 active:bg-teal-600 p-3 font-semibold disabled:opacity-50"
            onClick={healPartyAtPc}
            disabled={!canOpenPc}
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
            <button className="col-span-2 rounded bg-rose-700 active:bg-rose-600 p-3" onClick={() => openModal('new-game-confirm')}>
              {ko.app.modal.newGame}
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

      <BaseModal open={activeModal === 'new-game-confirm'} onClose={() => openModal('save')} title={ko.app.modal.newGameConfirmTitle}>
        <div className="space-y-3 text-sm">
          <p className="text-slate-300">{ko.app.modal.newGameConfirmDesc}</p>
          <div className="grid grid-cols-2 gap-2">
            <button className="rounded bg-rose-700 active:bg-rose-600 p-3" onClick={() => { resetGame(); gameRef.current?.scene.start('overworld'); closeModal() }}>
              {ko.app.modal.confirm}
            </button>
            <button className="rounded bg-slate-700 active:bg-slate-600 p-3" onClick={() => openModal('save')}>
              {ko.app.modal.cancel}
            </button>
          </div>
        </div>
      </BaseModal>

      <BaseModal open={activeModal === 'oak-intro'} onClose={closeModal} title={ko.app.modal.oakTitle}>
        <div className="space-y-3 text-sm">
          <p className="text-slate-200">{ko.app.modal.oakIntro}</p>
          <button
            className="w-full rounded bg-emerald-700 active:bg-emerald-600 p-3 font-semibold"
            onClick={() => {
              markOakIntroSeen()
              closeModal()
              returnToOverworldInput()
            }}
          >
            {ko.app.modal.startAdventure}
          </button>
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
            <div className="space-y-2">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {skillSlots.map((skill) => (
                  <button
                    key={skill.id}
                    className="bg-emerald-700 p-2 rounded"
                    onClick={() => chooseBattleCommand('fight', skill.id)}
                  >
                    {skill.name}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {bagEntries.map((entry) => (
                  <button
                    key={entry.id}
                    className="bg-cyan-700 p-2 rounded disabled:opacity-50"
                    onClick={() => consumeBagItem(entry.id)}
                    disabled={(itemBag[entry.id] ?? 0) <= 0}
                  >
                    {entry.label} x{itemBag[entry.id] ?? 0}
                  </button>
                ))}
                <button className="bg-indigo-700 p-2 rounded" onClick={() => chooseBattleCommand('catch')}>{ko.app.battle.catch}</button>
                <button className="bg-rose-700 p-2 rounded" onClick={() => chooseBattleCommand('run')}>{ko.app.battle.run}</button>
              </div>
            </div>
          )}

          {endedBattle && (
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
      <div className="fixed inset-0 flex items-end md:items-center justify-center p-2 md:p-4" style={{ touchAction: 'none' }}>
        <DialogPanel className="w-full max-w-md rounded-t-2xl md:rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-2xl" style={{ touchAction: 'manipulation' }}>
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
  disabled?: boolean
}

function MenuAction({ label, onClick, className, disabled = false }: MenuActionProps) {
  return (
    <button
      className={`rounded bg-menuPurpleSoft p-3 font-semibold text-menuPurpleSoft-text hover:bg-menuPurpleSoft-hover active:bg-menuPurpleSoft-hover disabled:opacity-50 ${className ?? ''}`}
      onClick={onClick}
      disabled={disabled}
    >
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
        event.currentTarget.setPointerCapture(event.pointerId)
        onInput(direction, true)
      }}
      onPointerUp={(event) => {
        event.preventDefault()
        event.currentTarget.releasePointerCapture(event.pointerId)
        onInput(direction, false)
      }}
      onPointerCancel={(event) => {
        event.currentTarget.releasePointerCapture(event.pointerId)
        onInput(direction, false)
      }}
      onContextMenu={(event) => event.preventDefault()}
    >
      {label}
    </button>
  )
}

type ActionButtonProps = {
  label: string
  onClick: () => void
  disabled?: boolean
}

function ActionButton({ label, onClick, disabled = false }: ActionButtonProps) {
  return (
    <button
      className="h-14 rounded bg-amber-700 text-sm font-semibold disabled:opacity-50"
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  )
}

export default App
