export {}

declare global {
  interface Window {
    __debugRouteMode?: 'map' | 'battle' | null
  }
}
