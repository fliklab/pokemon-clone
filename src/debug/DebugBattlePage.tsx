import { useEffect } from 'react'
import App from '../App'

export default function DebugBattlePage() {
  useEffect(() => {
    window.__debugRouteMode = 'battle'
    return () => {
      window.__debugRouteMode = null
    }
  }, [])

  return <App />
}
