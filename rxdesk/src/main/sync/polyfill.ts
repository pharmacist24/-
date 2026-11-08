// Windows 7 build only (Electron 22 = Node 16): Node 16 has no global fetch, Headers, Request, Response
// or FormData, which the Supabase client needs. undici provides the standard implementations.
// The main Windows 10/11 build never loads this file.
/* eslint-disable @typescript-eslint/no-require-imports */
const g = globalThis as Record<string, unknown>
if (typeof g.fetch !== 'function') {
  const undici = require('undici')
  for (const k of ['fetch', 'Headers', 'Request', 'Response', 'FormData', 'File']) if (!g[k] && undici[k]) g[k] = undici[k]
}
export {}
