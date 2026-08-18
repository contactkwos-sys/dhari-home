import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { fetchOrderById, markGatePassReceived } from '../lib/api'
import { errorMessage, parseGatePassQr, type Order } from '../types'

const SCANNER_REGION_ID = 'gate-pass-qr-reader'

export function GatePassScanner({
  onClose,
  onReceived,
}: {
  onClose: () => void
  onReceived: (order: Order) => void
}) {
  const [status, setStatus] = useState<'starting' | 'scanning' | 'busy' | 'done' | 'error'>(
    'starting',
  )
  const [message, setMessage] = useState('Starting camera…')
  const [err, setErr] = useState<string | null>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const handling = useRef(false)

  useEffect(() => {
    let cancelled = false
    const scanner = new Html5Qrcode(SCANNER_REGION_ID)
    scannerRef.current = scanner

    async function start() {
      try {
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 8, qrbox: { width: 220, height: 220 } },
          (decoded) => {
            void handleScan(decoded)
          },
          () => {
            /* ignore frame misses */
          },
        )
        if (!cancelled) {
          setStatus('scanning')
          setMessage('Point camera at the gate pass QR')
        }
      } catch (e) {
        if (!cancelled) {
          setStatus('error')
          setErr(
            errorMessage(
              e,
              'Could not open camera. Allow camera access and try again.',
            ),
          )
        }
      }
    }

    async function handleScan(raw: string) {
      if (handling.current || cancelled) return
      const orderId = parseGatePassQr(raw)
      if (!orderId) {
        setMessage('Not a DHARI gate pass QR — try again')
        return
      }
      handling.current = true
      setStatus('busy')
      setMessage('Confirming gate pass…')
      try {
        await scanner.stop().catch(() => undefined)
        const existing = await fetchOrderById(orderId)
        if (!existing) {
          throw new Error('Order not found for this QR')
        }
        if (!existing.gate_pass_issued_at) {
          throw new Error('This order has no issued gate pass yet')
        }
        if (existing.gate_pass_received_at) {
          setStatus('done')
          setMessage(
            `Already received · ${existing.dno_master?.dno_number ?? orderId.slice(0, 8)}`,
          )
          onReceived(existing)
          return
        }
        const updated = await markGatePassReceived(orderId)
        setStatus('done')
        setMessage(
          `Received back · ${updated.dno_master?.dno_number ?? ''} · ${updated.platform}`,
        )
        onReceived(updated)
      } catch (e) {
        setStatus('error')
        setErr(errorMessage(e, 'Failed to mark gate pass received'))
        handling.current = false
        // Restart scanner if still mounted
        if (!cancelled && scannerRef.current) {
          void start()
        }
      }
    }

    void start()

    return () => {
      cancelled = true
      const s = scannerRef.current
      scannerRef.current = null
      if (s?.isScanning) {
        void s.stop().catch(() => undefined)
      }
      try {
        s?.clear()
      } catch {
        /* ignore */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once
  }, [])

  return (
    <div className="panel panel-accent mb-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-lg text-indigo">Scan Gate Pass</h2>
          <p className="text-xs text-muted">
            Scan the QR on a returned slip to confirm
          </p>
        </div>
        <button type="button" className="btn btn-ghost !px-2.5 !py-1 text-xs" onClick={onClose}>
          Close
        </button>
      </div>

      <div
        id={SCANNER_REGION_ID}
        className="overflow-hidden rounded-lg bg-indigo-deep/90 [&_video]:max-h-64 [&_video]:w-full [&_video]:object-cover"
      />

      {err ? <p className="err whitespace-pre-wrap">{err}</p> : null}
      {!err ? (
        <p
          className={[
            'text-sm',
            status === 'done' ? 'ok' : 'text-muted',
          ].join(' ')}
        >
          {message}
        </p>
      ) : null}

      {status === 'done' || status === 'error' ? (
        <button type="button" className="btn btn-primary text-sm" onClick={onClose}>
          Done
        </button>
      ) : null}
    </div>
  )
}
