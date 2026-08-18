import type { DnoSize, Platform } from '../types'

const WAREHOUSE_WA_KEY = 'dhari_warehouse_wa'

export type PackDispatchPayload = {
  dnoNumber: string
  size: DnoSize
  pieces: number
  platform: Platform
  platformOrderId?: string | null
  buyerName?: string | null
}

/** Digits-only phone for wa.me (optional country code, e.g. 9198…). */
export function getWarehouseWhatsAppPhone(): string {
  try {
    return (localStorage.getItem(WAREHOUSE_WA_KEY) ?? '').replace(/\D/g, '')
  } catch {
    return ''
  }
}

export function setWarehouseWhatsAppPhone(phone: string): void {
  const digits = phone.replace(/\D/g, '')
  try {
    if (digits) localStorage.setItem(WAREHOUSE_WA_KEY, digits)
    else localStorage.removeItem(WAREHOUSE_WA_KEY)
  } catch {
    /* ignore quota / private mode */
  }
}

export function buildPackDispatchMessage(p: PackDispatchPayload): string {
  const lines = [
    'Pack for dispatch',
    '',
    `DN: ${p.dnoNumber}`,
    `Size (feet): ${p.size}`,
    `Pieces: ${p.pieces}`,
    `Platform: ${p.platform}`,
  ]
  if (p.platformOrderId?.trim()) {
    lines.push(`Platform order ID: ${p.platformOrderId.trim()}`)
  }
  if (p.buyerName?.trim()) {
    lines.push(`Buyer: ${p.buyerName.trim()}`)
  }
  lines.push('', 'Please pack this for marketplace dispatch.')
  return lines.join('\n')
}

/** Opens WhatsApp or WhatsApp Business with a pre-filled pack message. */
export function openWhatsAppPack(payload: PackDispatchPayload, phone?: string): void {
  const text = encodeURIComponent(buildPackDispatchMessage(payload))
  const digits = (phone ?? getWarehouseWhatsAppPhone()).replace(/\D/g, '')
  const url = digits
    ? `https://wa.me/${digits}?text=${text}`
    : `https://wa.me/?text=${text}`
  window.open(url, '_blank', 'noopener,noreferrer')
}
