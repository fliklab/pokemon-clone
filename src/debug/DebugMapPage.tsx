import { useEffect } from 'react'
import App from '../App'

export default function DebugMapPage() {
  useEffect(() => {
    window.__debugRouteMode = 'map'
    return () => {
      window.__debugRouteMode = null
    }
  }, [])

  return <App />
}
