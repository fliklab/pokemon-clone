import { useEffect, useMemo, useState } from 'react'
import { assetGroupLabel, assetGroupOrder, debugAssetManifest, type AssetEntry } from './assetManifest'

type AssetStatus = 'loading' | 'ok' | 'error'

type MapProbe = {
  jsonOk: boolean
  imageOk: boolean
  width: number
  height: number
  layers: string[]
  error: string | null
}

function loadImage(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve()
    image.onerror = () => reject(new Error(`failed to load: ${src}`))
    image.src = src
  })
}

export default function DebugAssetsPage() {
  const [statusById, setStatusById] = useState<Record<string, AssetStatus>>({})
  const [mapProbe, setMapProbe] = useState<MapProbe>({
    jsonOk: false,
    imageOk: false,
    width: 0,
    height: 0,
    layers: [],
    error: null,
  })

  useEffect(() => {
    let cancelled = false

    debugAssetManifest.forEach((asset) => {
      setStatusById((prev) => ({ ...prev, [asset.id]: 'loading' }))
      loadImage(asset.src)
        .then(() => {
          if (cancelled) return
          setStatusById((prev) => ({ ...prev, [asset.id]: 'ok' }))
        })
        .catch(() => {
          if (cancelled) return
          setStatusById((prev) => ({ ...prev, [asset.id]: 'error' }))
        })
    })

    const probeMap = async () => {
      try {
        const jsonUrl = `${import.meta.env.BASE_URL}maps/overworld.json`
        const imageUrl = `${import.meta.env.BASE_URL}maps/overworld-tiles.png`

        const response = await fetch(jsonUrl)
        if (!response.ok) {
          throw new Error(`map json load failed: ${response.status}`)
        }

        const map = await response.json() as {
          width: number
          height: number
          layers?: Array<{ name?: string }>
        }

        await loadImage(imageUrl)

        if (!cancelled) {
          setMapProbe({
            jsonOk: true,
            imageOk: true,
            width: map.width ?? 0,
            height: map.height ?? 0,
            layers: (map.layers ?? []).map((layer) => layer.name ?? 'unnamed'),
            error: null,
          })
        }
      } catch (error) {
        if (!cancelled) {
          setMapProbe((prev) => ({
            ...prev,
            error: error instanceof Error ? error.message : String(error),
          }))
        }
      }
    }

    void probeMap()

    return () => {
      cancelled = true
    }
  }, [])

  const grouped = useMemo(() => {
    const groups: Record<string, AssetEntry[]> = {}
    assetGroupOrder.forEach((group) => {
      groups[group] = debugAssetManifest.filter((entry) => entry.group === group)
    })

    return groups
  }, [])

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">Asset Debug</h1>
        <p className="text-sm text-slate-300">/debug/assets · tiles / char / opening 이미지 상태 확인</p>
      </header>

      <section className="rounded border border-cyan-600/50 bg-slate-900/70 p-4 space-y-2 text-sm">
        <h2 className="font-semibold text-cyan-300">Map load simulation</h2>
        <p>JSON: {mapProbe.jsonOk ? 'OK' : 'PENDING/FAIL'}</p>
        <p>Tileset image: {mapProbe.imageOk ? 'OK' : 'PENDING/FAIL'}</p>
        <p>Map size: {mapProbe.width} × {mapProbe.height}</p>
        <p>Layers: {mapProbe.layers.length > 0 ? mapProbe.layers.join(', ') : '-'}</p>
        {mapProbe.error && <p className="text-rose-300">Error: {mapProbe.error}</p>}
      </section>

      {assetGroupOrder.map((group) => (
        <section key={group} className="space-y-3">
          <h2 className="text-lg font-semibold">{assetGroupLabel[group]}</h2>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
            {grouped[group].map((asset) => {
              const status = statusById[asset.id] ?? 'loading'

              return (
                <article key={asset.id} className="rounded border border-slate-700 bg-slate-900/70 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-sm">{asset.label}</p>
                    <span className={`text-xs px-2 py-0.5 rounded ${status === 'ok' ? 'bg-emerald-800 text-emerald-100' : status === 'error' ? 'bg-rose-800 text-rose-100' : 'bg-slate-700 text-slate-200'}`}>
                      {status.toUpperCase()}
                    </span>
                  </div>
                  <div className="h-28 rounded bg-slate-800 flex items-center justify-center overflow-hidden border border-slate-700">
                    <img src={asset.src} alt={asset.label} className="max-h-full max-w-full object-contain pixelated" />
                  </div>
                  <p className="text-xs text-slate-400 break-all">{asset.src}</p>
                  {asset.note && <p className="text-xs text-slate-300">{asset.note}</p>}
                </article>
              )
            })}
          </div>
        </section>
      ))}
    </main>
  )
}
