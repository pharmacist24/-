/// <reference types="vite/client" />

declare module '*.woff2?inline' {
  const dataUrl: string
  export default dataUrl
}

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_RXDESK_WEB?: string
}
