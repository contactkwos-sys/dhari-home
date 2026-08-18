/** Default India staff WhatsApp (digits for wa.me = +91 9825063208). */
export const DEFAULT_STAFF_WHATSAPP_E164 = '919825063208'

/** Local display form without country code. */
export const DEFAULT_STAFF_WHATSAPP_DISPLAY = '9825063208'

/**
 * Staff support WhatsApp digits for wa.me (with country code).
 * Prefers VITE_STAFF_SUPPORT_WHATSAPP / STAFF_SUPPORT_WHATSAPP, else default.
 */
export function getStaffSupportWhatsApp(): string {
  const raw =
    (import.meta.env.VITE_STAFF_SUPPORT_WHATSAPP as string | undefined) ??
    (import.meta.env.STAFF_SUPPORT_WHATSAPP as string | undefined) ??
    ''
  const digits = String(raw).replace(/\D/g, '')
  return digits || DEFAULT_STAFF_WHATSAPP_E164
}

/** Human-facing number shown in the footer (no +91 prefix). */
export function staffSupportWhatsAppDisplay(): string {
  const digits = getStaffSupportWhatsApp()
  if (
    digits === DEFAULT_STAFF_WHATSAPP_E164 ||
    digits === DEFAULT_STAFF_WHATSAPP_DISPLAY
  ) {
    return DEFAULT_STAFF_WHATSAPP_DISPLAY
  }
  // Strip leading 91 for 12-digit Indian mobiles
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2)
  }
  return digits
}

export function staffSupportWhatsAppHref(): string {
  let digits = getStaffSupportWhatsApp()
  // Ensure India country code for 10-digit locals
  if (digits.length === 10) digits = `91${digits}`
  return `https://wa.me/${digits}`
}
