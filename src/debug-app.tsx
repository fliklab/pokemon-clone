import { StrictMode, useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { AssetsTab } from './debug/AssetsTab'
import { BattleTab } from './debug/BattleTab'
import { MapTab } from './debug/MapTab'

type DebugTab = 'assets' | 'map' | 'battle'

function parseTab(value: string | null): DebugTab {
  if (value === 'assets' || value === 'map' || value === 'battle') {
    return value
  }

  return 'assets'
}

function parseDebugMode(value: string | null): boolean {
  const normalized = value?.trim().toLowerCase() ?? ''
  return normalized === 'true' || normalized === '1' || normalized === 'on'
}

export function DebugApp() {
  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const [tab, setTab] = useState<DebugTab>(() => parseTab(params.get('tab')))
  const [debugMode, setDebugMode] = useState(() => {
    const queryValue = params.get('debugMode') ?? params.get('debug')
    const storageValue = window.localStorage.getItem('debugMode') ?? window.localStorage.getItem('debug')
    return parseDebugMode(queryValue) || parseDebugMode(storageValue)
  })

  useEffect(() => {
    const search = new URLSearchParams(window.location.search)
    search.set('tab', tab)
    search.set('debugMode', String(debugMode))
    const next = `${window.location.pathname}?${search.toString()}`
    window.history.replaceState(null, '', next)
    window.localStorage.setItem('debugMode', String(debugMode))
  }, [debugMode, tab])

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6 space-y-4">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">Debug Console</h1>
        <p className="text-sm text-slate-300">/debug.html?tab=assets&debugMode=true</p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {(['assets', 'map', 'battle'] as DebugTab[]).map((name) => (
          <button
            key={name}
            className={`rounded px-3 py-2 text-sm ${tab === name ? 'bg-cyan-700' : 'bg-slate-800'}`}
            onClick={() => setTab(name)}
          >
            {name}
          </button>
        ))}

        <label className="ml-auto text-xs text-slate-300 rounded border border-slate-700 bg-slate-900 px-2 py-1">
          <input
            type="checkbox"
            className="mr-2"
            checked={debugMode}
            onChange={(event) => setDebugMode(event.target.checked)}
          />
          debugMode
        </label>
      </div>

      <div>
        <a
          href="/?debugMode=true"
          className="inline-flex items-center rounded bg-emerald-700 px-3 py-2 text-sm font-semibold hover:bg-emerald-600 active:bg-emerald-600"
        >
          게임으로 돌아가기
        </a>
      </div>

      {tab === 'assets' && <AssetsTab />}
      {tab === 'map' && <MapTab />}
      {tab === 'battle' && <BattleTab />}
    </main>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DebugApp />
  </StrictMode>,
)
