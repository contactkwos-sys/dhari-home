import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'

export type SignaturePadHandle = {
  clear: () => void
  toBlob: () => Promise<Blob | null>
  hasInk: () => boolean
}

/**
 * Simple touch/mouse signature pad for courier gate-pass confirmation.
 * Works on low-end Android phones with finger input.
 */
export const SignaturePad = forwardRef<
  SignaturePadHandle,
  {
    onChange?: (hasInk: boolean) => void
    className?: string
  }
>(function SignaturePad({ onChange, className = '' }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)
  const inkRef = useRef(false)
  const [hasInk, setHasInk] = useState(false)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  function paintBlank() {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    ctx.fillStyle = '#faf6ef'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = '#1f3b57'
    ctx.lineWidth = 2.25
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resize = () => {
      const parent = canvas.parentElement
      if (!parent) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = parent.clientWidth
      const h = Math.max(140, Math.round(w * 0.42))
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      paintBlank()
      inkRef.current = false
      setHasInk(false)
      onChangeRef.current?.(false)
    }

    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  useImperativeHandle(ref, () => ({
    clear() {
      paintBlank()
      inkRef.current = false
      setHasInk(false)
      onChangeRef.current?.(false)
    },
    async toBlob() {
      const canvas = canvasRef.current
      if (!canvas || !inkRef.current) return null
      return new Promise((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/png')
      })
    },
    hasInk: () => inkRef.current,
  }))

  function pointFromEvent(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault()
    canvasRef.current?.setPointerCapture(e.pointerId)
    drawing.current = true
    last.current = pointFromEvent(e)
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return
    e.preventDefault()
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    const next = pointFromEvent(e)
    if (!ctx || !next || !last.current) return
    ctx.beginPath()
    ctx.moveTo(last.current.x, last.current.y)
    ctx.lineTo(next.x, next.y)
    ctx.stroke()
    last.current = next
    if (!inkRef.current) {
      inkRef.current = true
      setHasInk(true)
      onChangeRef.current?.(true)
    }
  }

  function end(e: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = false
    last.current = null
    try {
      canvasRef.current?.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className={className}>
      <div className="overflow-hidden rounded-lg border border-[rgba(31,59,87,0.18)] bg-ivory touch-none">
        <canvas
          ref={canvasRef}
          className="block w-full touch-none"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          aria-label="Signature pad"
        />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-xs text-muted">
          {hasInk ? 'Signature captured' : 'Sign with finger'}
        </p>
        <button
          type="button"
          className="btn btn-ghost !px-2.5 !py-1 text-xs"
          onClick={() => {
            paintBlank()
            inkRef.current = false
            setHasInk(false)
            onChangeRef.current?.(false)
          }}
        >
          Clear
        </button>
      </div>
    </div>
  )
})
