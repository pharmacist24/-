import { useEffect, useState } from 'react'
import type { SyncStatus } from '@shared/types'
import { api } from './api'

const EMPTY: SyncStatus = { signedIn: false, email: '', clinicName: '', syncing: false, online: true, lastSyncAt: '', lastError: '', pending: 0 }

type Listener = (s: SyncStatus & { changed?: boolean }) => void
const listeners = new Set<Listener>()
let current: SyncStatus = EMPTY
let wired = false

function wire(): void {
  if (wired || !window.rxdesk?.on) return
  wired = true
  window.rxdesk.on('sync-status', (p) => {
    current = p as SyncStatus
    listeners.forEach((l) => l(p as SyncStatus & { changed?: boolean }))
  })
}

/** Live online-sync status (pushed by the main process after every change of state). */
export function useSyncStatus(): [SyncStatus, (s: SyncStatus) => void] {
  const [s, setS] = useState<SyncStatus>(current)
  useEffect(() => {
    wire()
    const l: Listener = (x) => setS(x)
    listeners.add(l)
    api.sync
      .status()
      .then((x) => {
        current = x
        setS(x)
      })
      .catch(() => undefined)
    return () => {
      listeners.delete(l)
    }
  }, [])
  return [s, setS]
}

/** Runs `fn` whenever a sync downloaded changes. */
export function onSyncedChanges(fn: () => void): () => void {
  wire()
  const l: Listener = (x) => {
    if (x.changed) fn()
  }
  listeners.add(l)
  return () => listeners.delete(l)
}

export type SyncState = 'off' | 'syncing' | 'offline' | 'expired' | 'error' | 'ok'

export function syncState(s: SyncStatus): SyncState {
  if (!s.signedIn) return 'off'
  if (s.syncing) return 'syncing'
  if (!s.online) return 'offline'
  if (s.lastError === 'SIGNED_OUT') return 'expired'
  if (s.lastError) return 'error'
  return 'ok'
}
