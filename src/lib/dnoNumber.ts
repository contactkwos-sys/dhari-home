import type { DnoMaster } from '../types'

/** Collapse typed spaces: "DN  3" → "DN 3". Keeps dash vs space as entered. */
export function normalizeDnoNumber(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ')
}

export function parseDnoTail(
  raw: string,
): { prefix: string; n: number } | null {
  const t = normalizeDnoNumber(raw)
  const m = t.match(/^(.*?)(\d+)$/)
  if (!m) return null
  const n = Number(m[2])
  if (!Number.isFinite(n)) return null
  return { prefix: m[1], n }
}

/** Numeric serial only (DN-21 → 21, DN 1001 → 1001). */
export function dnoSerial(raw: string): number | null {
  return parseDnoTail(raw)?.n ?? null
}

/** Next number in the same style as this DN (DN-21 → DN-22, DN 3 → DN 4). */
export function nextAfterDnoNumber(dnoNumber: string): string {
  const parsed = parseDnoTail(dnoNumber)
  if (!parsed) return 'DN-1'
  return `${parsed.prefix}${parsed.n + 1}`
}

/**
 * Next number in the same style as the highest serial DN.
 * Prefer max serial over "latest by date" so lists stay 1→2→3… without jumping.
 */
export function suggestNextDnoNumber(
  dnos: Pick<DnoMaster, 'id' | 'dno_number' | 'date_added'>[],
): string {
  if (!dnos.length) return 'DN-1'
  const ranked = [...dnos].sort((a, b) => {
    const bySerial = compareDnoNumbers(a.dno_number, b.dno_number)
    if (bySerial) return -bySerial
    const byDate = (b.date_added || '').localeCompare(a.date_added || '')
    if (byDate) return byDate
    return b.id.localeCompare(a.id)
  })
  const latest = ranked[0]
  const parsed = parseDnoTail(latest.dno_number)
  if (!parsed) return 'DN-1'
  return `${parsed.prefix}${parsed.n + 1}`
}

/**
 * Sort by numeric serial first, then by prefix style (DN- vs DN ).
 * Avoids "DN 1, DN 1001, DN-2, DN-10" looking scrambled up/down in warehouse.
 */
export function compareDnoNumbers(a: string, b: string): number {
  const pa = parseDnoTail(a)
  const pb = parseDnoTail(b)
  if (pa && pb) {
    if (pa.n !== pb.n) return pa.n - pb.n
    const pref = pa.prefix.localeCompare(pb.prefix, undefined, {
      sensitivity: 'base',
    })
    if (pref) return pref
  } else if (pa && !pb) {
    return -1
  } else if (!pa && pb) {
    return 1
  }
  return normalizeDnoNumber(a).localeCompare(normalizeDnoNumber(b), undefined, {
    numeric: true,
    sensitivity: 'base',
  })
}

export function sortDnos<T extends { dno_number: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => compareDnoNumbers(a.dno_number, b.dno_number))
}
