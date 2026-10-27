import type { SupabaseClient } from '@supabase/supabase-js'
import type { Remote, RemoteRow } from './engine'

/** The online side of the sync engine: rows of public.sync_rows for one clinic. */
export class SupabaseRemote implements Remote {
  constructor(
    private sb: SupabaseClient,
    private clinicId: string
  ) {}

  async pull(since: number, limit: number): Promise<RemoteRow[]> {
    const { data, error } = await this.sb
      .from('sync_rows')
      .select('tbl, uid, data, deleted, updated_at, updated_by, seq')
      .eq('clinic_id', this.clinicId)
      .gt('seq', since)
      .order('seq', { ascending: true })
      .limit(limit)
    if (error) throw new Error(error.message)
    return (data ?? []) as RemoteRow[]
  }

  async push(rows: RemoteRow[]): Promise<void> {
    if (!rows.length) return
    const { error } = await this.sb.from('sync_rows').upsert(
      rows.map(({ seq: _seq, ...r }) => ({ ...r, clinic_id: this.clinicId })),
      { onConflict: 'clinic_id,tbl,uid' }
    )
    if (error) throw new Error(error.message)
  }
}
