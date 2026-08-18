/**
 * Staff support WhatsApp (placeholder until confirmed).
 * Vite exposes only VITE_* vars to the client.
 */
export function getStaffSupportWhatsApp(): string {
  const raw =
    (import.meta.env.VITE_STAFF_SUPPORT_WHATSAPP as string | undefined) ??
    (import.meta.env.STAFF_SUPPORT_WHATSAPP as string | undefined) ??
    ''
  return String(raw).replace(/\D/g, '')
}

export function staffSupportWhatsAppDisplay(): string {
  const digits = getStaffSupportWhatsApp()
  return digits || '[PHONE NUMBER — pending]'
}

export function staffSupportWhatsAppHref(): string | null {
  const digits = getStaffSupportWhatsApp()
  if (!digits) return null
  return `https://wa.me/${digits}`
}
