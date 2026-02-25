import { useMemo, useState } from 'react'
import { debugAssetManifest } from './assetManifest'

export function AssetsTab() {
  const [query, setQuery] = useState('')
  const [zoom, setZoom] = useState(2)
  const [failedById, setFailedById] = useState<Record<string, boolean>>({})

  const assets = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) {
      return debugAssetManifest
    }

    return debugAssetManifest.filter((asset) => {
      return `${asset.label} ${asset.group} ${asset.id}`.toLowerCase().includes(keyword)
    })
  }, [query])

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <input
          className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
          placeholder="search sprite/tile"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <label className="text-sm text-slate-300 flex items-center gap-2">
          Zoom
          <input
            type="range"
            min={1}
            max={6}
            step={0.5}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
          />
          <span>{zoom.toFixed(1)}x</span>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {assets.map((asset) => (
          <article key={asset.id} className="rounded border border-slate-700 bg-slate-900/70 p-3 space-y-2">
            <p className="text-sm font-semibold">{asset.label}</p>
            <p className="text-xs text-slate-400">{asset.group}</p>
            <div className="overflow-auto rounded border border-slate-700 bg-slate-950 p-2">
              {failedById[asset.id] ? (
                <div className="flex min-h-20 items-center justify-center text-xs text-rose-300">
                  이미지 로드 실패
                </div>
              ) : (
                <img
                  src={asset.src}
                  alt={asset.label}
                  className="origin-top-left pixelated"
                  style={{ imageRendering: 'pixelated', transform: `scale(${zoom})` }}
                  onError={() => {
                    console.error('[assets-tab] failed to load image', { id: asset.id, src: asset.src })
                    setFailedById((prev) => ({ ...prev, [asset.id]: true }))
                  }}
                />
              )}
            </div>
            <p className="text-[11px] text-slate-500 break-all">{asset.src}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
