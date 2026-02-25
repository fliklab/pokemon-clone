import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

window.requestAnimationFrame(hideSplash)
window.setTimeout(hideSplash, 2500)
