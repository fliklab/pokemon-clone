import { create } from 'zustand'

type Encounter = {
  x: number
  y: number
  at: number
}

type GameState = {
  sceneReady: boolean
  playerTile: { x: number; y: number }
  lastEncounter: Encounter | null
  setSceneReady: (ready: boolean) => void
  setPlayerTile: (x: number, y: number) => void
  triggerEncounter: (x: number, y: number) => void
}

export const useGameStore = create<GameState>((set) => ({
  sceneReady: false,
  playerTile: { x: 0, y: 0 },
  lastEncounter: null,
  setSceneReady: (ready) => set({ sceneReady: ready }),
  setPlayerTile: (x, y) => set({ playerTile: { x, y } }),
  triggerEncounter: (x, y) =>
    set({
      lastEncounter: {
        x,
        y,
        at: Date.now(),
      },
    }),
}))
