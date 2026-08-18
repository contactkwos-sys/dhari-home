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

/** Next number in the same style as this DN (DN-21 → DN-22, DN 3 → DN 4). */
export function nextAfterDnoNumber(dnoNumber: string): string {
  const parsed = parseDnoTail(dnoNumber)
  if (!parsed) return 'DN-1'
  return `${parsed.prefix}${parsed.n + 1}`
}

/** Next number in the same style as the latest DN (DN-21 → DN-22, DN 3 → DN 4). */
export function suggestNextDnoNumber(
  dnos: Pick<DnoMaster, 'id' | 'dno_number' | 'date_added'>[],
): string {
  if (!dnos.length) return 'DN-1'
  const latest = [...dnos].sort((a, b) => {
    const byDate = (b.date_added || '').localeCompare(a.date_added || '')
    if (byDate) return byDate
    return b.id.localeCompare(a.id)
  })[0]
  const parsed = parseDnoTail(latest.dno_number)
  if (!parsed) return 'DN-1'
  return `${parsed.prefix}${parsed.n + 1}`
}

export function compareDnoNumbers(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

export function sortDnos<T extends { dno_number: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => compareDnoNumbers(a.dno_number, b.dno_number))
}
