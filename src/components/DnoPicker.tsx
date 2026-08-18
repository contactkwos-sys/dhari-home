import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getStockBalancesBySize } from '../lib/api'
import type { DnoMaster, DnoSize } from '../types'
import { SIZES } from '../types'

export function DnoPicker({
  id = 'dno_pick',
  label = 'DN number',
  dnos,
  value,
  onChange,
  viewTo,
}: {
  id?: string
  label?: string
  dnos: DnoMaster[]
  value: string
  onChange: (id: string) => void
  viewTo?: string | null
}) {
  const selected = dnos.find((d) => d.id === value) ?? null
  const [stock, setStock] = useState<Record<DnoSize, number> | null>(null)

  useEffect(() => {
    if (!value) {
      setStock(null)
      return
    }
    let cancelled = false
    void getStockBalancesBySize(value)
      .then((bal) => {
        if (!cancelled) setStock(bal)
      })
      .catch(() => {
        if (!cancelled) setStock(null)
      })
    return () => {
      cancelled = true
    }
  }, [value])

  return (
    <div className="field col-span-2">
      <label htmlFor={id}>{label}</label>
      {dnos.length === 0 ? (
        <p className="text-sm text-muted">No DNs yet — add a design first.</p>
      ) : (
        <select
          id={id}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          {dnos.map((d) => (
            <option key={d.id} value={d.id}>
              {d.dno_number}
              {d.category ? ` · ${d.category}` : ''}
            </option>
          ))}
        </select>
      )}

      {selected ? (
        <div className="mt-2 flex gap-3 rounded-lg border border-[rgba(31,59,87,0.1)] bg-ivory-dark/40 p-2">
          <Link
            to={`/dno?id=${encodeURIComponent(selected.id)}`}
            className="h-20 w-20 shrink-0 overflow-hidden rounded-md bg-ivory-dark"
            aria-label={`Open design ${selected.dno_number}`}
          >
            {selected.photo_url ? (
              <img
                src={selected.photo_url}
                alt={selected.dno_number}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-[0.55rem] text-muted">
                No photo
              </span>
            )}
          </Link>
          <div className="min-w-0 flex-1">
            <p className="num text-sm font-semibold text-indigo">
              {selected.dno_number}
            </p>
            <p className="truncate text-xs text-muted">
              {selected.category || '—'}
            </p>
            <p className="mt-1 text-[0.65rem] uppercase tracking-wide text-muted">
              Warehouse stock
            </p>
            <ul className="mt-0.5 space-y-0.5 text-xs">
              {SIZES.map((size) => (
                <li key={size} className="flex justify-between gap-2">
                  <span className="text-muted">{size}</span>
                  <span className="num font-medium text-indigo">
                    {stock == null ? '…' : stock[size]}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
              <Link
                to={`/dno?id=${encodeURIComponent(selected.id)}`}
                className="text-xs font-medium text-turmeric"
              >
                View design →
              </Link>
              {viewTo ? (
                <Link
                  to={viewTo}
                  className="text-xs font-medium text-turmeric"
                >
                  View in warehouse →
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
