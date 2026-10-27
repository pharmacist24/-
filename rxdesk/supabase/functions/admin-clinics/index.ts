// RxDesk admin actions that need the service role key (kept on the server).
// Only callers listed in public.platform_admins may use it.
//   POST { action: 'create', name, email, password }        -> creates the doctor's login + clinic
//   POST { action: 'reset-password', clinicId, password }
//   POST { action: 'set-disabled', clinicId, disabled }
//   POST { action: 'delete', clinicId }                      -> removes the clinic, its data and the login
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2.49.4'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

function reply(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return reply(405, { error: 'Method not allowed' })

  const url = Deno.env.get('SUPABASE_URL')!
  const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false }
  })

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data: who, error: whoErr } = await service.auth.getUser(token)
  if (whoErr || !who?.user) return reply(401, { error: 'Not signed in' })
  const { data: admin } = await service.from('platform_admins').select('user_id').eq('user_id', who.user.id).maybeSingle()
  if (!admin) return reply(403, { error: 'Admins only' })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return reply(400, { error: 'Invalid JSON' })
  }
  const str = (k: string) => String(body[k] ?? '').trim()

  async function clinicOwner(clinicId: string): Promise<string | null> {
    const { data } = await service.from('clinics').select('owner_user_id').eq('id', clinicId).maybeSingle()
    return (data?.owner_user_id as string) ?? null
  }

  switch (body.action) {
    case 'create': {
      const name = str('name')
      const email = str('email').toLowerCase()
      const password = String(body.password ?? '')
      if (!name || !email || password.length < 8) return reply(400, { error: 'Name, e-mail and a password of 8+ characters are required' })
      // Public sign-up is closed in the database; this e-mail is let through once.
      await service.from('invited_emails').upsert({ email, created_at: new Date().toISOString() })
      const { data: created, error } = await service.auth.admin.createUser({ email, password, email_confirm: true })
      if (error || !created.user) return reply(400, { error: error?.message ?? 'Could not create the user' })
      const { data: clinic, error: cErr } = await service
        .from('clinics')
        .insert({ name, owner_user_id: created.user.id, owner_email: email })
        .select()
        .single()
      if (cErr) {
        await service.auth.admin.deleteUser(created.user.id)
        return reply(400, { error: cErr.message })
      }
      return reply(200, { clinic })
    }
    case 'reset-password': {
      const owner = await clinicOwner(str('clinicId'))
      const password = String(body.password ?? '')
      if (!owner) return reply(404, { error: 'Clinic not found' })
      if (password.length < 8) return reply(400, { error: 'Password must be 8+ characters' })
      const { error } = await service.auth.admin.updateUserById(owner, { password })
      return error ? reply(400, { error: error.message }) : reply(200, { ok: true })
    }
    case 'set-disabled': {
      const clinicId = str('clinicId')
      const disabled = !!body.disabled
      const owner = await clinicOwner(clinicId)
      const { error } = await service.from('clinics').update({ disabled }).eq('id', clinicId)
      if (error) return reply(400, { error: error.message })
      if (owner) await service.auth.admin.updateUserById(owner, { ban_duration: disabled ? '876000h' : 'none' })
      return reply(200, { ok: true })
    }
    case 'delete': {
      const clinicId = str('clinicId')
      const owner = await clinicOwner(clinicId)
      const { error } = await service.from('clinics').delete().eq('id', clinicId)
      if (error) return reply(400, { error: error.message })
      if (owner) await service.auth.admin.deleteUser(owner)
      return reply(200, { ok: true })
    }
    default:
      return reply(400, { error: 'Unknown action' })
  }
})
