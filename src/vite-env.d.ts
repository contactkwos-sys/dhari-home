/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  /** Staff support WhatsApp digits with country code (default 919825063208). Alias: STAFF_SUPPORT_WHATSAPP */
  readonly VITE_STAFF_SUPPORT_WHATSAPP?: string
  readonly STAFF_SUPPORT_WHATSAPP?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
