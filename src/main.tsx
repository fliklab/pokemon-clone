import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import DebugAssetsPage from './debug/DebugAssetsPage'
import DebugMapPage from './debug/DebugMapPage'
import DebugBattlePage from './debug/DebugBattlePage'

const hideSplash = () => {
  const splash = document.getElementById('app-splash')
  if (!splash) {
    return
  }

  if (splash.classList.contains('is-hiding')) {
    return
  }

  splash.classList.add('is-hiding')

  const removeSplash = () => {
    splash.remove()
  }

  splash.addEventListener('transitionend', removeSplash, { once: true })
  window.setTimeout(removeSplash, 400)
}

if (document.readyState === 'complete') {
  hideSplash()
} else {
  window.addEventListener('load', hideSplash, { once: true })
}

const currentPath = window.location.pathname
const Page = currentPath.endsWith('/debug/assets')
  ? DebugAssetsPage
  : currentPath.endsWith('/debug/map')
    ? DebugMapPage
    : currentPath.endsWith('/debug/battle')
      ? DebugBattlePage
      : App

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Page />
  </StrictMode>,
)

window.requestAnimationFrame(hideSplash)
window.setTimeout(hideSplash, 2500)
