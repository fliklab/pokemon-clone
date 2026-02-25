export type GameErrorPayload = {
  source: 'phaser-init' | 'scene-init' | 'scene-preload' | 'scene-create' | 'scene-load'
  sceneKey?: string
  message: string
  stack?: string
  at: string
}

type ErrorOverlayProps = {
  error: GameErrorPayload | null
  debugMode: boolean
}

export function ErrorOverlay({ error, debugMode }: ErrorOverlayProps) {
  if (!error) {
    return null
  }

  return (
    <div
      className={`absolute inset-0 z-[65] bg-rose-950/90 text-rose-100 p-4 md:p-5 overflow-auto ${debugMode ? 'block' : 'hidden'}`}
      role="alert"
      aria-live="assertive"
    >
      <p className="text-sm font-semibold text-rose-200">게임 실행 중 오류가 발생했습니다.</p>
      <p className="mt-2 text-xs md:text-sm">source: {error.source}{error.sceneKey ? ` · scene: ${error.sceneKey}` : ''}</p>
      <p className="mt-1 text-xs md:text-sm break-words">message: {error.message}</p>
      {error.stack && (
        <pre className="mt-3 rounded bg-black/40 p-2 text-[11px] leading-relaxed whitespace-pre-wrap break-words">
          {error.stack}
        </pre>
      )}
      <p className="mt-3 text-[11px] text-rose-200/80">at: {error.at}</p>
    </div>
  )
}
