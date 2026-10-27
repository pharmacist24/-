// Live security test against the online project (run manually: needs internet and a test admin).
//   RXDESK_TEST_ADMIN_EMAIL=... RXDESK_TEST_ADMIN_PASSWORD=... NODE_USE_ENV_PROXY=1 node scripts/live-rls-test.mjs
// Creates two throw-away clinics through the admin-clinics function, checks that each doctor sees only
// their own clinic, then deletes both clinics and their logins.
import { createClient } from '@supabase/supabase-js'
import assert from 'node:assert/strict'

const URL = 'https://ticujgmhqkfdgrnkgnmp.supabase.co'
const KEY = 'sb_publishable_-faQ9CUPCm9ztfKKCT9Lww_T9dUniJq'
const opts = { auth: { persistSession: false, autoRefreshToken: false } }
const stamp = Date.now().toString(36)

const admin = createClient(URL, KEY, opts)
const { error: aErr } = await admin.auth.signInWithPassword({
  email: process.env.RXDESK_TEST_ADMIN_EMAIL,
  password: process.env.RXDESK_TEST_ADMIN_PASSWORD
})
assert.ifError(aErr)

async function call(body) {
  const { data, error } = await admin.functions.invoke('admin-clinics', { body })
  if (error) {
    const text = error.context ? await error.context.text() : ''
    throw new Error(`${body.action}: ${error.message} ${text}`)
  }
  return data
}

const created = []
try {
  const A = (await call({ action: 'create', name: 'Test clinic A ' + stamp, email: `a-${stamp}@rxdesk-test.dev`, password: 'Clinic#A-2026' })).clinic
  created.push(A.id)
  const B = (await call({ action: 'create', name: 'Test clinic B ' + stamp, email: `b-${stamp}@rxdesk-test.dev`, password: 'Clinic#B-2026' })).clinic
  created.push(B.id)
  console.log('created clinics', A.id, B.id)

  const docA = createClient(URL, KEY, opts)
  const docB = createClient(URL, KEY, opts)
  assert.ifError((await docA.auth.signInWithPassword({ email: `a-${stamp}@rxdesk-test.dev`, password: 'Clinic#A-2026' })).error)
  assert.ifError((await docB.auth.signInWithPassword({ email: `b-${stamp}@rxdesk-test.dev`, password: 'Clinic#B-2026' })).error)

  // A writes to its own clinic.
  const row = { clinic_id: A.id, tbl: 'patients', uid: 'p-' + stamp, data: { name: 'Secret patient' }, updated_at: new Date().toISOString(), updated_by: 'test' }
  assert.ifError((await docA.from('sync_rows').upsert(row, { onConflict: 'clinic_id,tbl,uid' })).error)
  const own = await docA.from('sync_rows').select('uid, seq').eq('clinic_id', A.id)
  assert.equal(own.data.length, 1)
  assert.ok(own.data[0].seq > 0, 'seq is set by the server')

  // An older edit does not replace a newer one.
  await docA.from('sync_rows').upsert({ ...row, data: { name: 'old' }, updated_at: '2020-01-01T00:00:00Z' }, { onConflict: 'clinic_id,tbl,uid' })
  const still = await docA.from('sync_rows').select('data').eq('uid', row.uid).single()
  assert.equal(still.data.data.name, 'Secret patient')

  // B cannot read or write A's rows, nor see A's clinic.
  const peek = await docB.from('sync_rows').select('uid').eq('clinic_id', A.id)
  assert.equal(peek.data.length, 0, 'clinic B must not read clinic A')
  const write = await docB.from('sync_rows').insert({ ...row, uid: 'evil', updated_by: 'B' })
  assert.ok(write.error, 'clinic B must not write into clinic A')
  const clinicsB = await docB.from('clinics').select('id')
  assert.deepEqual(clinicsB.data.map((c) => c.id), [B.id])
  const upd = await docB.from('clinics').update({ name: 'hacked' }).eq('id', B.id).select()
  assert.equal(upd.data?.length ?? 0, 0, 'a doctor cannot rename the clinic')
  const del = await docA.from('sync_rows').delete().eq('clinic_id', A.id).select()
  assert.equal(del.data?.length ?? 0, 0, 'a doctor cannot hard-delete rows')

  // Not signed in: nothing.
  const anon = createClient(URL, KEY, opts)
  assert.equal(((await anon.from('sync_rows').select('uid')).data ?? []).length, 0)
  assert.equal(((await anon.from('clinics').select('id')).data ?? []).length, 0)
  const anonStats = await anon.rpc('clinic_stats')
  assert.ok(anonStats.error || (anonStats.data ?? []).length === 0)

  // A doctor cannot call the admin function.
  const notAdmin = await docA.functions.invoke('admin-clinics', { body: { action: 'delete', clinicId: B.id } })
  assert.ok(notAdmin.error, 'doctor must not use admin-clinics')

  // Admin sees both clinics and their data.
  const all = await admin.from('clinics').select('id').in('id', [A.id, B.id])
  assert.equal(all.data.length, 2)
  const stats = await admin.rpc('clinic_stats')
  assert.equal(stats.data.find((s) => s.clinic_id === A.id).patients, 1)
  assert.ok((await docA.rpc('touch_clinic', { p_app_version: '9.9.9' })).error === null)
  const touched = await admin.from('clinics').select('app_version, last_sync_at').eq('id', A.id).single()
  assert.equal(touched.data.app_version, '9.9.9')

  // Reset password + disable.
  await call({ action: 'reset-password', clinicId: A.id, password: 'NewPass#2026' })
  assert.ok((await createClient(URL, KEY, opts).auth.signInWithPassword({ email: `a-${stamp}@rxdesk-test.dev`, password: 'NewPass#2026' })).data.session)
  await call({ action: 'set-disabled', clinicId: B.id, disabled: true })
  const afterDisable = await docB.from('sync_rows').select('uid')
  assert.equal((afterDisable.data ?? []).length, 0)
  const signInDisabled = await createClient(URL, KEY, opts).auth.signInWithPassword({ email: `b-${stamp}@rxdesk-test.dev`, password: 'Clinic#B-2026' })
  assert.ok(signInDisabled.error, 'a disabled clinic cannot sign in')

  console.log('LIVE RLS TEST PASSED')
} finally {
  for (const id of created) await call({ action: 'delete', clinicId: id }).catch((e) => console.error('cleanup', e.message))
  console.log('cleaned up', created.length, 'clinics')
}
