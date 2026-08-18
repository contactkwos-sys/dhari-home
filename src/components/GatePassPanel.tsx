import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { issueGatePass } from '../lib/api'
import {
  encodeGatePassQr,
  errorMessage,
  type Order,
} from '../types'
import { SignaturePad, type SignaturePadHandle } from './SignaturePad'
import { StripeBar } from './StripeBar'

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function GatePassPanel({
  order,
  onClose,
  onIssued,
}: {
  order: Order
  onClose: () => void
  onIssued: (updated: Order) => void
}) {
  const padRef = useRef<SignaturePadHandle>(null)
  const [hasInk, setHasInk] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [localOrder, setLocalOrder] = useState(order)

  const issued = Boolean(localOrder.gate_pass_issued_at && localOrder.gate_pass_signature_url)
  const received = Boolean(localOrder.gate_pass_received_at)

  useEffect(() => {
    setLocalOrder(order)
  }, [order])

  useEffect(() => {
    let cancelled = false
    void QRCode.toDataURL(encodeGatePassQr(order.id), {
      width: 180,
      margin: 1,
      color: { dark: '#1f3b57', light: '#faf6ef' },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url)
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null)
      })
    return () => {
      cancelled = true
    }
  }, [order.id])

  async function saveSignature() {
    setErr(null)
    const blob = await padRef.current?.toBlob()
    if (!blob) {
      setErr('Courier must sign before issuing the gate pass.')
      return
    }
    setBusy(true)
    try {
      const updated = await issueGatePass(order.id, blob)
      setLocalOrder(updated)
      onIssued(updated)
    } catch (e) {
      setErr(errorMessage(e, 'Failed to save gate pass'))
    } finally {
      setBusy(false)
    }
  }

  async function shareOrPrint() {
    try {
      const canvas = await buildGatePassImage(localOrder, qrDataUrl)
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/png'),
      )
      if (blob && typeof navigator.share === 'function') {
        const file = new File([blob], `gate-pass-${order.id.slice(0, 8)}.png`, {
          type: 'image/png',
        })
        const canShareFiles =
          typeof navigator.canShare === 'function' &&
          navigator.canShare({ files: [file] })
        if (canShareFiles) {
          await navigator.share({
            files: [file],
            title: 'DHARI Home Gate Pass',
            text: `Gate pass · ${localOrder.dno_master?.dno_number ?? ''}`,
          })
          return
        }
      }
      if (blob) {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `gate-pass-${order.id.slice(0, 8)}.png`
        a.click()
        URL.revokeObjectURL(url)
        return
      }
    } catch {
      /* fall through to print */
    }
    window.print()
  }

  return (
    <div className="panel panel-accent mb-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-lg text-indigo">Gate Pass</h2>
          <p className="text-xs text-muted">
            Courier signs on pickup · QR for receive-back scan
          </p>
        </div>
        <button type="button" className="btn btn-ghost !px-2.5 !py-1 text-xs" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="gate-pass-slip rounded-lg border border-[rgba(31,59,87,0.14)] bg-ivory p-3">
        <p className="font-display text-base tracking-wide text-indigo">DHARI Home</p>
        <p className="text-[0.65rem] uppercase tracking-[0.14em] text-turmeric">
          Gate Pass / Courier Pickup
        </p>
        <StripeBar className="my-2" />
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
          <div>
            <dt className="text-[0.65rem] uppercase tracking-wide text-muted">DN</dt>
            <dd className="num font-medium text-indigo">
              {localOrder.dno_master?.dno_number ?? '—'}
            </dd>
          </div>
          <div>
            <dt className="text-[0.65rem] uppercase tracking-wide text-muted">Qty</dt>
            <dd className="num font-medium">{localOrder.pieces}</dd>
          </div>
          <div>
            <dt className="text-[0.65rem] uppercase tracking-wide text-muted">Platform</dt>
            <dd className="font-medium">{localOrder.platform}</dd>
          </div>
          <div>
            <dt className="text-[0.65rem] uppercase tracking-wide text-muted">Order ID</dt>
            <dd className="num text-xs font-medium">
              {localOrder.platform_order_id || '—'}
            </dd>
          </div>
          <div>
            <dt className="text-[0.65rem] uppercase tracking-wide text-muted">Order date</dt>
            <dd className="num text-xs">{localOrder.order_date}</dd>
          </div>
          <div>
            <dt className="text-[0.65rem] uppercase tracking-wide text-muted">Size</dt>
            <dd className="text-xs font-medium">{localOrder.size}</dd>
          </div>
          {issued ? (
            <div className="col-span-2">
              <dt className="text-[0.65rem] uppercase tracking-wide text-muted">Issued</dt>
              <dd className="num text-xs">{formatDateTime(localOrder.gate_pass_issued_at)}</dd>
            </div>
          ) : null}
          {received ? (
            <div className="col-span-2">
              <dt className="text-[0.65rem] uppercase tracking-wide text-muted">
                Received back
              </dt>
              <dd className="num text-xs text-[var(--color-green,#2f6b4f)]">
                {formatDateTime(localOrder.gate_pass_received_at)}
              </dd>
            </div>
          ) : null}
        </dl>

        <div className="mt-3 flex items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-[0.65rem] uppercase tracking-wide text-muted">
              Courier signature
            </p>
            {issued && localOrder.gate_pass_signature_url ? (
              <img
                src={localOrder.gate_pass_signature_url}
                alt="Courier signature"
                className="max-h-24 w-full rounded border border-[rgba(31,59,87,0.12)] bg-white object-contain"
              />
            ) : (
              <p className="text-xs text-muted">Pending signature</p>
            )}
          </div>
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="Gate pass QR"
              className="h-[5.5rem] w-[5.5rem] shrink-0 rounded bg-ivory"
            />
          ) : null}
        </div>
      </div>

      {!issued ? (
        <>
          <SignaturePad ref={padRef} onChange={setHasInk} />
          {err ? <p className="err whitespace-pre-wrap">{err}</p> : null}
          <button
            type="button"
            className="btn btn-primary w-full"
            disabled={busy || !hasInk}
            onClick={() => void saveSignature()}
          >
            {busy ? 'Saving…' : 'Issue gate pass'}
          </button>
        </>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-primary text-sm"
            onClick={() => void shareOrPrint()}
          >
            Share / save slip
          </button>
          <button
            type="button"
            className="btn btn-ghost text-sm"
            onClick={() => window.print()}
          >
            Print
          </button>
          {received ? (
            <span className="self-center text-xs font-medium text-[var(--color-green,#2f6b4f)]">
              Received back ✓
            </span>
          ) : (
            <span className="self-center text-xs text-muted">Awaiting return scan</span>
          )}
        </div>
      )}
    </div>
  )
}

async function buildGatePassImage(
  order: Order,
  qrDataUrl: string | null,
): Promise<HTMLCanvasElement> {
  const w = 640
  const h = 780
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not available')

  ctx.fillStyle = '#faf6ef'
  ctx.fillRect(0, 0, w, h)

  ctx.fillStyle = '#1f3b57'
  ctx.font = '600 32px Georgia, serif'
  ctx.fillText('DHARI Home', 36, 56)
  ctx.fillStyle = '#c98a2c'
  ctx.font = '500 14px sans-serif'
  ctx.fillText('GATE PASS / COURIER PICKUP', 36, 82)

  // Stripe
  const colors = ['#1f3b57', '#c98a2c', '#8b5a3c', '#2f6b4f', '#b85c38']
  colors.forEach((c, i) => {
    ctx.fillStyle = c
    ctx.fillRect(36 + i * 40, 98, 36, 4)
  })

  const rows: Array<[string, string]> = [
    ['DN', order.dno_master?.dno_number ?? '—'],
    ['Qty', String(order.pieces)],
    ['Size', order.size],
    ['Platform', order.platform],
    ['Order ID', order.platform_order_id || '—'],
    ['Order date', order.order_date],
    ['Issued', formatDateTime(order.gate_pass_issued_at)],
  ]
  if (order.gate_pass_received_at) {
    rows.push(['Received back', formatDateTime(order.gate_pass_received_at)])
  }

  let y = 140
  for (const [label, value] of rows) {
    ctx.fillStyle = '#6b7280'
    ctx.font = '12px sans-serif'
    ctx.fillText(label.toUpperCase(), 36, y)
    ctx.fillStyle = '#1f3b57'
    ctx.font = '600 20px monospace, sans-serif'
    ctx.fillText(value, 36, y + 24)
    y += 52
  }

  ctx.fillStyle = '#6b7280'
  ctx.font = '12px sans-serif'
  ctx.fillText('COURIER SIGNATURE', 36, y + 8)

  if (order.gate_pass_signature_url) {
    try {
      const sig = await loadImage(order.gate_pass_signature_url)
      const maxW = 280
      const maxH = 120
      const scale = Math.min(maxW / sig.width, maxH / sig.height, 1)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(36, y + 18, maxW, maxH)
      ctx.drawImage(sig, 36, y + 18, sig.width * scale, sig.height * scale)
    } catch {
      ctx.fillStyle = '#1f3b57'
      ctx.font = '14px sans-serif'
      ctx.fillText('(signature on file)', 36, y + 48)
    }
  }

  if (qrDataUrl) {
    try {
      const qr = await loadImage(qrDataUrl)
      ctx.drawImage(qr, w - 36 - 160, h - 36 - 160, 160, 160)
    } catch {
      /* ignore */
    }
  }

  return canvas
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = src
  })
}
