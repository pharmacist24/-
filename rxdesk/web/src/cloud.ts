import { createClient } from '@supabase/supabase-js'
import { CLOUD_ANON_KEY, CLOUD_URL } from '@shared/sync/config'

// The project URL and publishable key can be overridden at build time (Vercel environment variables).
export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL || CLOUD_URL, import.meta.env.VITE_SUPABASE_ANON_KEY || CLOUD_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true }
})

export interface ClinicRow {
  id: string
  name: string
  owner_email: string
  disabled: boolean
  app_version: string
  last_sync_at: string | null
  created_at: string
  patients: number
  prescriptions: number
  drugs: number
}

export async function listClinics(): Promise<ClinicRow[]> {
  const [{ data: clinics, error }, { data: stats, error: sErr }] = await Promise.all([
    supabase.from('clinics').select('id, name, owner_email, disabled, app_version, last_sync_at, created_at').order('name'),
    supabase.rpc('clinic_stats')
  ])
  if (error) throw new Error(error.message)
  if (sErr) throw new Error(sErr.message)
  const by = new Map((stats ?? []).map((s: { clinic_id: string }) => [s.clinic_id, s]))
  return (clinics ?? []).map((c) => {
    const s = by.get(c.id) as { patients?: number; prescriptions?: number; drugs?: number } | undefined
    return { ...c, patients: Number(s?.patients ?? 0), prescriptions: Number(s?.prescriptions ?? 0), drugs: Number(s?.drugs ?? 0) }
  })
}

/** Calls the admin-clinics edge function (it holds the service key, never the browser). */
export async function adminAction(body: Record<string, unknown>): Promise<any> {
  const { data, error } = await supabase.functions.invoke('admin-clinics', { body })
  if (error) {
    let msg = error.message
    try {
      const j = await (error as { context?: Response }).context?.json()
      if (j?.error) msg = j.error
    } catch {
      /* keep message */
    }
    throw new Error(msg)
  }
  return data
}

export async function isAdmin(userId: string): Promise<boolean> {
  const { data } = await supabase.from('platform_admins').select('user_id').eq('user_id', userId).maybeSingle()
  return !!data
}
