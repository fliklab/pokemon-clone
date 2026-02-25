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
  onConfirm: () => void
}

export function ErrorOverlay({ error, debugMode, onConfirm }: ErrorOverlayProps) {
  if (!error) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end md:items-center justify-center overflow-y-auto bg-black/70 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-[calc(env(safe-area-inset-top)+0.75rem)] md:p-6"
      role="alertdialog"
      aria-live="assertive"
      aria-modal="true"
      aria-label="게임 오류"
    >
      <section className="w-full max-w-[42rem] rounded-2xl border border-rose-700/80 bg-rose-950/95 text-rose-100 shadow-2xl max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-1.5rem)] overflow-y-auto overscroll-contain">
        <div className="p-4 md:p-5">
          <p className="text-sm font-semibold text-rose-200 md:text-base">게임 실행 중 오류가 발생했습니다.</p>
          <p className="mt-2 text-xs md:text-sm">source: {error.source}{error.sceneKey ? ` · scene: ${error.sceneKey}` : ''}</p>
          <p className="mt-1 text-xs md:text-sm break-words">message: {error.message}</p>
          {(debugMode || error.stack) && error.stack && (
            <pre className="mt-3 rounded bg-black/40 p-2 text-[11px] leading-relaxed whitespace-pre-wrap break-words">
              {error.stack}
            </pre>
          )}
          {debugMode && <p className="mt-3 text-[11px] text-rose-200/80">at: {error.at}</p>}

          <div className="mt-4 pt-3 border-t border-rose-800/70">
            <button
              type="button"
              className="w-full rounded-lg bg-rose-600 px-4 py-3 text-sm font-semibold text-white hover:bg-rose-500 active:bg-rose-500"
              onClick={onConfirm}
            >
              확인
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
