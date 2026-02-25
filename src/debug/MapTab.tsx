import { useEffect, useMemo, useRef, useState } from 'react'
import { createFpsMeter, drawWireframe } from '../debug'

type TileLayer = {
  name: string
  width: number
  height: number
  data: number[]
}

type TiledMap = {
  width: number
  height: number
  tilewidth: number
  tileheight: number
  layers: Array<{
    name: string
    width?: number
    height?: number
    data?: number[]
  }>
}

const mapUrl = `${import.meta.env.BASE_URL}maps/overworld.json`
const tilesUrl = `${import.meta.env.BASE_URL}maps/overworld-tiles.png`

export function MapTab() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [mapData, setMapData] = useState<TiledMap | null>(null)
  const [tileImage, setTileImage] = useState<HTMLImageElement | null>(null)
  const [visible, setVisible] = useState<Record<string, boolean>>({})
  const [showCollision, setShowCollision] = useState(true)
  const [showNpc, setShowNpc] = useState(true)
  const [showWireframe, setShowWireframe] = useState(false)
  const [fps, setFps] = useState(0)
  const [tileAssetReady, setTileAssetReady] = useState(false)

  useEffect(() => {
    let active = true

    void fetch(mapUrl)
      .then((response) => response.json() as Promise<TiledMap>)
      .then((json) => {
        if (!active) {
          return
        }

        setMapData(json)
        const nextVisible: Record<string, boolean> = {}
        json.layers.forEach((layer) => {
          nextVisible[layer.name] = true
        })
        setVisible(nextVisible)
      })

    const image = new Image()
    image.onload = () => {
      if (!active) {
        return
      }

      const hasRenderableSize = image.width > 0 && image.height > 0
      if (!hasRenderableSize) {
        console.warn('[debug-map] tileset loaded but image dimensions are invalid. drawImage will be skipped with placeholder.', {
          src: tilesUrl,
          width: image.width,
          height: image.height,
        })
        setTileAssetReady(false)
        setTileImage(null)
        return
      }

      setTileAssetReady(true)
      setTileImage(image)
    }
    image.onerror = () => {
      if (!active) {
        return
      }

      console.warn('[debug-map] tileset image preload failed. drawImage will use placeholder tiles.', {
        src: tilesUrl,
      })
      setTileAssetReady(false)
      setTileImage(null)
    }
    image.src = tilesUrl

    const meter = createFpsMeter()
    const interval = window.setInterval(() => setFps(meter.read()), 250)

    return () => {
      active = false
      meter.destroy()
      window.clearInterval(interval)
    }
  }, [])

  const tileLayers = useMemo(() => {
    if (!mapData) {
      return [] as TileLayer[]
    }

    return mapData.layers.flatMap((layer) => {
      if (!Array.isArray(layer.data) || typeof layer.width !== 'number' || typeof layer.height !== 'number') {
        return []
      }

      return [{
        name: layer.name,
        width: layer.width,
        height: layer.height,
        data: layer.data,
      }]
    })
  }, [mapData])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !mapData) {
      return
    }

    const tileSize = mapData.tilewidth
    const context = canvas.getContext('2d')
    if (!context) {
      return
    }

    canvas.width = mapData.width * tileSize
    canvas.height = mapData.height * tileSize

    context.clearRect(0, 0, canvas.width, canvas.height)
    context.imageSmoothingEnabled = false

    const imageReady = Boolean(tileImage && tileImage.width > 0 && tileImage.height > 0)
    const columns = imageReady ? Math.max(1, Math.floor((tileImage?.width ?? 0) / tileSize)) : 1

    tileLayers.forEach((layer) => {
      if (!visible[layer.name]) {
        return
      }

      for (let y = 0; y < layer.height; y += 1) {
        for (let x = 0; x < layer.width; x += 1) {
          const index = layer.data[y * layer.width + x]
          if (!index || index < 1) {
            continue
          }

          const targetX = x * tileSize
          const targetY = y * tileSize

          if (!imageReady || !tileImage) {
            context.fillStyle = '#334155'
            context.fillRect(targetX, targetY, tileSize, tileSize)
            context.fillStyle = '#fbbf24'
            context.fillText('?', targetX + Math.floor(tileSize * 0.35), targetY + Math.floor(tileSize * 0.72))
            continue
          }

          const spriteIndex = index - 1
          const sx = (spriteIndex % columns) * tileSize
          const sy = Math.floor(spriteIndex / columns) * tileSize
          const sourceInBounds = sx + tileSize <= tileImage.width && sy + tileSize <= tileImage.height

          if (!sourceInBounds) {
            context.fillStyle = '#475569'
            context.fillRect(targetX, targetY, tileSize, tileSize)
            context.fillStyle = '#fca5a5'
            context.fillText('!', targetX + Math.floor(tileSize * 0.35), targetY + Math.floor(tileSize * 0.72))
            continue
          }

          context.drawImage(tileImage, sx, sy, tileSize, tileSize, targetX, targetY, tileSize, tileSize)
        }
      }
    })

    const blockedLayer = tileLayers.find((layer) => layer.name.toLowerCase().includes('blocked'))
    if (showCollision && blockedLayer) {
      context.fillStyle = 'rgba(239, 68, 68, 0.32)'
      blockedLayer.data.forEach((value, index) => {
        if (value <= 0) {
          return
        }

        const x = (index % blockedLayer.width) * tileSize
        const y = Math.floor(index / blockedLayer.width) * tileSize
        context.fillRect(x, y, tileSize, tileSize)
      })
    }

    const npcLayer = tileLayers.find((layer) => layer.name.toLowerCase().includes('npc'))
    if (showNpc && npcLayer) {
      context.fillStyle = 'rgba(250, 204, 21, 0.35)'
      context.font = '10px monospace'
      npcLayer.data.forEach((value, index) => {
        if (value <= 0) {
          return
        }

        const x = (index % npcLayer.width) * tileSize
        const y = Math.floor(index / npcLayer.width) * tileSize
        context.fillRect(x, y, tileSize, tileSize)
        context.fillStyle = '#fef08a'
        context.fillText(String(value), x + 3, y + 11)
        context.fillStyle = 'rgba(250, 204, 21, 0.35)'
      })
    }

    if (showWireframe) {
      drawWireframe(context, canvas.width, canvas.height, tileSize)
    }
  }, [mapData, showCollision, showNpc, showWireframe, tileImage, tileLayers, visible])

  const exportJson = () => {
    if (!mapData) {
      return
    }

    const npcLayer = tileLayers.find((layer) => layer.name.toLowerCase().includes('npc'))
    const npcTiles = npcLayer
      ? npcLayer.data
        .map((value, index) => {
          if (value <= 0) {
            return null
          }

          return {
            tileId: value,
            x: index % npcLayer.width,
            y: Math.floor(index / npcLayer.width),
          }
        })
        .filter((entry): entry is { tileId: number; x: number; y: number } => entry !== null)
      : []

    const payload = {
      map: { width: mapData.width, height: mapData.height, tileSize: mapData.tilewidth },
      visibleLayers: visible,
      collisionEnabled: showCollision,
      npcTiles,
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'debug-map-export.json'
    link.click()
    URL.revokeObjectURL(link.href)
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center text-sm">
        {tileLayers.map((layer) => (
          <label key={layer.name} className="rounded border border-slate-700 px-2 py-1 bg-slate-900">
            <input
              type="checkbox"
              checked={visible[layer.name] ?? false}
              onChange={(event) => setVisible((prev) => ({ ...prev, [layer.name]: event.target.checked }))}
            />
            <span className="ml-2">{layer.name}</span>
          </label>
        ))}
        <label className="rounded border border-slate-700 px-2 py-1 bg-slate-900">
          <input type="checkbox" checked={showCollision} onChange={(event) => setShowCollision(event.target.checked)} />
          <span className="ml-2">Collision</span>
        </label>
        <label className="rounded border border-slate-700 px-2 py-1 bg-slate-900">
          <input type="checkbox" checked={showNpc} onChange={(event) => setShowNpc(event.target.checked)} />
          <span className="ml-2">NPC overlay</span>
        </label>
        <label className="rounded border border-slate-700 px-2 py-1 bg-slate-900">
          <input type="checkbox" checked={showWireframe} onChange={(event) => setShowWireframe(event.target.checked)} />
          <span className="ml-2">Wireframe</span>
        </label>
        <button className="rounded bg-cyan-700 px-3 py-1 text-sm" onClick={exportJson}>Export JSON</button>
        <p className="text-cyan-200">FPS {fps.toFixed(1)}</p>
        <p className="text-xs text-slate-300">Tileset: {tileAssetReady ? 'ready' : 'placeholder'}</p>
      </div>

      <div className="overflow-auto rounded border border-slate-700 bg-slate-950 p-2">
        <canvas ref={canvasRef} style={{ imageRendering: 'pixelated' }} />
      </div>
    </section>
  )
}
