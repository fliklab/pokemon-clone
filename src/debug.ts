export type FpsMeter = {
  read: () => number
  destroy: () => void
}

export function createFpsMeter(sampleWindow = 24): FpsMeter {
  let rafId = 0
  let running = true
  let last = performance.now()
  let fps = 0
  const samples: number[] = []

  const tick = (now: number) => {
    if (!running) {
      return
    }

    const delta = Math.max(1, now - last)
    last = now
    samples.push(1000 / delta)

    if (samples.length > sampleWindow) {
      samples.shift()
    }

    const total = samples.reduce((sum, value) => sum + value, 0)
    fps = samples.length > 0 ? total / samples.length : 0
    rafId = window.requestAnimationFrame(tick)
  }

  rafId = window.requestAnimationFrame(tick)

  return {
    read: () => fps,
    destroy: () => {
      running = false
      window.cancelAnimationFrame(rafId)
    },
  }
}

export function drawWireframe(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  tileSize: number,
  color = 'rgba(56, 189, 248, 0.35)',
) {
  context.save()
  context.strokeStyle = color
  context.lineWidth = 1

  for (let x = 0; x <= width; x += tileSize) {
    context.beginPath()
    context.moveTo(x + 0.5, 0)
    context.lineTo(x + 0.5, height)
    context.stroke()
  }

  for (let y = 0; y <= height; y += tileSize) {
    context.beginPath()
    context.moveTo(0, y + 0.5)
    context.lineTo(width, y + 0.5)
    context.stroke()
  }

  context.restore()
}
