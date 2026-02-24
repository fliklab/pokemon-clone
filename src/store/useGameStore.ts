import { create } from 'zustand'

type GameState = {
  sceneReady: boolean
  setSceneReady: (ready: boolean) => void
}

export const useGameStore = create<GameState>((set) => ({
  sceneReady: false,
  setSceneReady: (ready) => set({ sceneReady: ready }),
}))
