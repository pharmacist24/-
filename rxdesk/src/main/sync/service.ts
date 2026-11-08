// Online sync for the desktop app: sign-in, background sync and status.
// The app works fully offline; nothing leaves the PC until the doctor signs in.
import { app, net, safeStorage } from 'electron'
import { randomUUID } from 'crypto'
import fs from 'fs'
import path from 'path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { SyncEngine, type SqlDb } from '@shared/sync/engine'
import { SupabaseRemote } from '@shared/sync/supabaseRemote'
import { CLOUD_ANON_KEY, CLOUD_URL } from '@shared/sync/config'
import type { SyncStatus } from '@shared/types'
import { AppError } from '../db/repo'
import { log } from '../logger'
import { state } from '../state'

const EVERY_MS = 2 * 60 * 1000
const AFTER_CHANGE_MS = 5000

interface Link {
  email: string
  clinicId: string
  clinicName: string
}

let client: SupabaseClient | null = null
let link: Link | null = null
let syncing = false
let lastSyncAt = ''
let lastError = ''
let online = true
let soonTimer: NodeJS.Timeout | null = null
let started = false

const sessionFile = () => path.join(state.dataDir, 'cloud-session.bin')
const linkFile = () => path.join(state.dataDir, 'cloud-link.json')
const db = () => state.repo!.db as unknown as SqlDb

// ------------------------------------------------------------------ session storage (encrypted)
let sessionCache: Record<string, string> = {}

function loadSessions(): void {
  try {
    const buf = fs.readFileSync(sessionFile())
    const text = safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(buf) : buf.toString('utf8')
    sessionCache = JSON.parse(text)
  } catch {
    sessionCache = {}
  }
}

function saveSessions(): void {
  try {
    const text = JSON.stringify(sessionCache)
    if (!Object.keys(sessionCache).length) {
      fs.rmSync(sessionFile(), { force: true })
      return
    }
    const buf = safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(text) : Buffer.from(text, 'utf8')
    fs.writeFileSync(sessionFile(), buf)
  } catch (e) {
    log.warn('Could not save the online session', e)
  }
}

const storage = {
  getItem: (k: string) => sessionCache[k] ?? null,
  setItem: (k: string, v: string) => {
    sessionCache[k] = v
    saveSessions()
  },
  removeItem: (k: string) => {
    delete sessionCache[k]
    saveSessions()
  }
}

/**
 * Chromium's network stack (net.fetch, Electron 25+) uses the Windows proxy settings and certificate store.
 * The Windows 7 build runs on Electron 22, which has no net.fetch: there the same network stack is used
 * through net.request (Headers / Response come from undici, installed as globals by ./polyfill).
 */
function cloudFetch(): typeof fetch {
  const n = net as unknown as { fetch?: typeof fetch }
  if (typeof n.fetch === 'function') return (input, init) => n.fetch!(input as string, init as RequestInit)
  return netRequestFetch as typeof fetch
}

class NoWebSocket {
  readyState = 3
  constructor() {
    throw new Error('Live updates are not used by RxDesk')
  }
}

// Headers Chromium sets itself; net.request refuses them.
const RESTRICTED = new Set(['content-length', 'host', 'connection', 'transfer-encoding', 'upgrade', 'keep-alive', 'expect'])

/** fetch() on top of Electron's net.request (older Electron): Windows proxy + certificate store, like net.fetch. */
function netRequestFetch(input: string | URL | { url: string }, init: RequestInit = {}): Promise<Response> {
  return new Promise((resolve, reject) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const req = net.request({ url, method: (init.method ?? 'GET').toUpperCase(), redirect: 'follow' })
    new Headers(init.headers).forEach((value, key) => {
      if (!RESTRICTED.has(key.toLowerCase())) req.setHeader(key, value)
    })
    const signal = init.signal
    if (signal) {
      if (signal.aborted) return reject(new Error('The request was aborted'))
      signal.addEventListener('abort', () => {
        req.abort()
        reject(new Error('The request was aborted'))
      })
    }
    req.on('response', (res) => {
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('error', reject)
      res.on('end', () => {
        const headers = new Headers()
        for (const [k, v] of Object.entries(res.headers)) for (const x of ([] as string[]).concat(v)) headers.append(k, x)
        const noBody = [101, 204, 205, 304].includes(res.statusCode)
        resolve(new Response(noBody ? null : Buffer.concat(chunks), { status: res.statusCode, statusText: res.statusMessage, headers }))
      })
    })
    req.on('error', reject)
    const body = init.body
    if (body !== undefined && body !== null) {
      if (typeof body === 'string') req.write(body)
      else if (body instanceof ArrayBuffer) req.write(Buffer.from(body))
      else if (ArrayBuffer.isView(body)) req.write(Buffer.from(body.buffer, body.byteOffset, body.byteLength))
      else req.write(String(body))
    }
    req.end()
  })
}

function getClient(): SupabaseClient {
  if (!client) {
    client = createClient(CLOUD_URL, CLOUD_ANON_KEY, {
      auth: { storage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
      // Chromium's network stack: uses the Windows proxy settings and certificate store.
      global: { fetch: cloudFetch() },
      // RxDesk does not use Supabase live updates. Node 16 (Windows 7 build) has no WebSocket, which the
      // client insists on: give it one that never connects.
      ...(typeof (globalThis as { WebSocket?: unknown }).WebSocket === 'function' ? {} : { realtime: { transport: NoWebSocket as never } })
    })
  }
  return client
}

function deviceId(): string {
  let id = SyncEngine.getState(db(), 'device_id')
  if (!id) {
    id = 'device:' + randomUUID()
    SyncEngine.setState(db(), 'device_id', id)
  }
  return id
}

function readLink(): Link | null {
  try {
    return JSON.parse(fs.readFileSync(linkFile(), 'utf8')) as Link
  } catch {
    return null
  }
}

function notify(changed = false): void {
  state.mainWindow?.webContents.send('sync-status', { ...status(), changed })
}

// ------------------------------------------------------------------ public
export function status(): SyncStatus {
  let pending = 0
  try {
    pending = state.repo ? SyncEngine.pendingCount(db()) : 0
  } catch {
    /* ignore */
  }
  return {
    signedIn: !!link,
    email: link?.email ?? '',
    clinicName: link?.clinicName ?? '',
    syncing,
    online,
    lastSyncAt,
    lastError,
    pending
  }
}

export async function signIn(email: string, password: string): Promise<SyncStatus> {
  const sb = getClient()
  const { data, error } = await sb.auth.signInWithPassword({ email: email.trim(), password })
  if (error || !data.user) {
    if (/invalid login/i.test(error?.message ?? '')) throw new AppError('CLOUD_LOGIN', error!.message)
    throw new AppError('CLOUD_OFFLINE', error?.message ?? 'Sign-in failed')
  }
  const { data: clinic, error: cErr } = await sb.from('clinics').select('id, name, disabled').eq('owner_user_id', data.user.id).maybeSingle()
  if (cErr) throw new AppError('CLOUD_OFFLINE', cErr.message)
  if (!clinic || clinic.disabled) {
    await sb.auth.signOut({ scope: 'local' })
    throw new AppError('CLOUD_NO_CLINIC', 'This account is not linked to a clinic')
  }
  link = { email: data.user.email ?? email, clinicId: clinic.id, clinicName: clinic.name }
  fs.writeFileSync(linkFile(), JSON.stringify(link))
  SyncEngine.bindClinic(db(), clinic.id)
  lastError = ''
  log.info('Signed in for online sync', { clinic: clinic.id })
  await syncNow()
  return status()
}

export async function signOut(): Promise<SyncStatus> {
  try {
    await getClient().auth.signOut({ scope: 'local' })
  } catch (e) {
    log.warn('Sign out failed (offline?)', e)
  }
  sessionCache = {}
  saveSessions()
  fs.rmSync(linkFile(), { force: true })
  link = null
  lastError = ''
  notify()
  return status()
}

/** Runs one sync round now (errors are kept in the status, never thrown at the UI). */
export async function syncNow(): Promise<SyncStatus> {
  if (!link || !state.repo) return status()
  if (syncing) return status()
  syncing = true
  notify()
  let changed = false
  try {
    const sb = getClient()
    const { data } = await sb.auth.getSession()
    if (!data.session) {
      lastError = 'SIGNED_OUT'
      return status()
    }
    SyncEngine.bindClinic(db(), link.clinicId)
    const engine = new SyncEngine(db(), new SupabaseRemote(sb, link.clinicId), deviceId())
    const res = await engine.sync()
    changed = res.localChanged
    await sb.rpc('touch_clinic', { p_app_version: app.getVersion() })
    lastSyncAt = new Date().toISOString()
    lastError = ''
    online = true
    if (res.pulled || res.pushed) log.info('Synced', res)
  } catch (e) {
    lastError = (e as Error).message || String(e)
    log.warn('Sync failed', lastError)
  } finally {
    syncing = false
    notify(changed)
  }
  return status()
}

/** Called after every change made in the app: sync a few seconds later. */
export function noteLocalChange(): void {
  if (!link || soonTimer) return
  soonTimer = setTimeout(() => {
    soonTimer = null
    try {
      if (state.repo && SyncEngine.pendingCount(db()) > 0) void syncNow()
    } catch {
      /* ignore */
    }
  }, AFTER_CHANGE_MS)
}

/** Starts background sync (every 2 minutes and when the internet comes back). */
export function startSync(): void {
  if (started) return
  started = true
  loadSessions()
  link = readLink()
  if (link) setTimeout(() => void syncNow(), 3000)
  setInterval(() => void syncNow(), EVERY_MS)
  setInterval(() => {
    const now = net.isOnline()
    if (now && !online && link) void syncNow()
    if (now !== online) {
      online = now
      notify()
    }
  }, 15000)
}
