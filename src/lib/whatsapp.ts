import type { DnoSize, Platform } from '../types'
import { DEFAULT_STAFF_WHATSAPP_E164 } from './support'

const WAREHOUSE_WA_KEY = 'dhari_warehouse_wa'

export type PackDispatchPayload = {
  dnoNumber: string
  size: DnoSize
  pieces: number
  platform: Platform
  platformOrderId?: string | null
  buyerName?: string | null
  /** Public Supabase Storage URL for the DN design photo (no re-upload). */
  photoUrl?: string | null
}

/**
 * Digits-only phone for wa.me (with country code, e.g. 9198…).
 * Defaults to staff packing number when not overridden on this device.
 */
export function getWarehouseWhatsAppPhone(): string {
  try {
    const stored = (localStorage.getItem(WAREHOUSE_WA_KEY) ?? '').replace(
      /\D/g,
      '',
    )
    return stored || DEFAULT_STAFF_WHATSAPP_E164
  } catch {
    return DEFAULT_STAFF_WHATSAPP_E164
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
  if (p.photoUrl?.trim()) {
    lines.push('', `Design photo: ${p.photoUrl.trim()}`)
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
