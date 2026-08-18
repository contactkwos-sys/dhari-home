import {
  staffSupportWhatsAppDisplay,
  staffSupportWhatsAppHref,
} from '../lib/support'

/** Small unobtrusive credit footer on every authenticated screen. */
export function AppFooter() {
  const href = staffSupportWhatsAppHref()
  const phone = staffSupportWhatsAppDisplay()

  return (
    <footer className="app-footer px-4 pb-[calc(4.75rem+env(safe-area-inset-bottom))] pt-2 text-center lg:pb-4">
      <p className="text-[0.65rem] leading-relaxed text-muted">
        Built by KWOS — Powered by Kumaresh Budhia · For any help, WhatsApp:{' '}
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="num text-indigo underline-offset-2 hover:underline"
        >
          {phone}
        </a>
      </p>
    </footer>
  )
}
