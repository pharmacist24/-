// Online stage: desktop app <-> Supabase <-> admin web app, against the live project.
// Needs internet, `npm run build:web`, and an admin account (e.g. your own admin login):
//   RXDESK_TEST_ADMIN_EMAIL=... RXDESK_TEST_ADMIN_PASSWORD=... xvfb-run -a node scripts/e2e.mjs online
// Creates a throw-away clinic and deletes it at the end.
import { chromium, _electron as electron } from 'playwright-core'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { spawn } from 'child_process'
import { createClient } from '@supabase/supabase-js'

const URL = 'https://ticujgmhqkfdgrnkgnmp.supabase.co'
const KEY = 'sb_publishable_-faQ9CUPCm9ztfKKCT9Lww_T9dUniJq'

export default async function ({ page, app, shot, check, sleep }) {
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy
  const stamp = Date.now().toString(36)
  const clinicName = 'E2E clinic ' + stamp
  const doctorEmail = `e2e-${stamp}@rxdesk-test.dev`
  const doctorPassword = 'E2e#Clinic-2026'
  const adminEmail = process.env.RXDESK_TEST_ADMIN_EMAIL
  const adminPassword = process.env.RXDESK_TEST_ADMIN_PASSWORD
  if (!adminEmail || !adminPassword) throw new Error('RXDESK_TEST_ADMIN_EMAIL / RXDESK_TEST_ADMIN_PASSWORD are required')

  // Desktop networking goes through the session proxy in this test environment.
  if (proxy) await app.evaluate(async ({ session }, p) => session.defaultSession.setProxy({ proxyRules: p }), proxy)

  const desk = (method, ...args) => page.evaluate(([m, a]) => window.rxdesk.invoke(m, a), [method, args])
  const deskStatus = async () => (await desk('sync.status')).data

  const server = spawn('npx', ['vite', 'preview', '--config', 'web/vite.config.ts', '--port', '5181', '--strictPort'], { stdio: 'ignore', detached: true })
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium',
    args: proxy ? ['--proxy-server=' + proxy] : []
  })
  let clinicId = null
  const admin = createClient(URL, KEY, { auth: { persistSession: false } })
  try {
    await sleep(2500)
    const web = await browser.newPage({ viewport: { width: 1366, height: 820 } })
    web.on('pageerror', (e) => check(false, 'web page error: ' + e.message))
    const wshot = (n) => web.screenshot({ path: `test-output/${n}.png` })
    const wcall = (method, ...args) => web.evaluate(([m, a]) => window.rxdesk.invoke(m, a), [method, args])
    const webSaved = async () => {
      await sleep(1200)
      await web.waitForSelector('#web-save-state[data-state="idle"]', { timeout: 30000 })
    }

    // ---------------------------------------------------------------- admin creates the clinic
    await web.goto('http://127.0.0.1:5181/')
    await web.waitForSelector('#admin-email', { timeout: 30000 })
    await wshot('online-01-admin-login')
    await web.fill('#admin-email', adminEmail)
    await web.fill('#admin-password', adminPassword)
    await web.click('#admin-signin')
    await web.waitForSelector('#new-clinic', { timeout: 30000 })
    check(true, 'admin signed in to the web app')
    await web.click('#new-clinic')
    await web.fill('#nc-name', clinicName)
    await web.fill('#nc-email', doctorEmail)
    await web.fill('#nc-password', doctorPassword)
    await web.click('#nc-create')
    await web.waitForSelector('text=' + doctorEmail, { timeout: 30000 })
    await wshot('online-02-clinic-created')
    await web.keyboard.press('Escape')
    const listed = await web.waitForSelector(`[data-clinic="${clinicName}"]`, { timeout: 20000 }).then(() => true, () => false)
    check(listed, 'new clinic listed')
    await admin.auth.signInWithPassword({ email: adminEmail, password: adminPassword })
    clinicId = (await admin.from('clinics').select('id').eq('name', clinicName).single()).data?.id

    // ---------------------------------------------------------------- desktop signs in and uploads
    await page.click('[data-nav="settings"]')
    await page.click('[data-tab="sync"]')
    await page.fill('#sync-email', doctorEmail)
    await page.fill('#sync-password', 'wrong-password')
    await page.click('#sync-signin')
    await sleep(2500)
    check(!(await deskStatus()).signedIn, 'wrong password is refused')
    await page.fill('#sync-password', doctorPassword)
    await page.click('#sync-signin')
    await page.waitForSelector('#sync-state[data-state="ok"]', { timeout: 60000 })
    const st = await deskStatus()
    check(st.signedIn && st.clinicName === clinicName && st.pending === 0, `desktop signed in and synced (${st.clinicName}, pending ${st.pending})`)
    await shot('online-03-desktop-synced')
    check((await page.locator('#cloud-status[data-state="ok"]').count()) === 1, 'sidebar cloud icon shows synced')

    const { data: rows } = await admin.from('sync_rows').select('tbl').eq('clinic_id', clinicId).eq('deleted', false)
    const count = (t) => rows.filter((r) => r.tbl === t).length
    check(count('patients') >= 4, `patients uploaded (${count('patients')})`)
    check(count('prescriptions') >= 1, `prescriptions uploaded (${count('prescriptions')})`)
    check(count('drugs') > 10 && count('layouts') >= 1 && count('settings') === 1, 'drugs, layouts and settings uploaded')

    // ---------------------------------------------------------------- admin opens the clinic
    await web.reload()
    await web.waitForSelector(`[data-clinic="${clinicName}"]`, { timeout: 30000 })
    await web.click(`[data-clinic="${clinicName}"]`)
    await web.waitForSelector('#patient-search', { timeout: 60000 })
    await sleep(500)
    const webPatients = await web.locator('tbody tr').count()
    check(webPatients >= 4, `web shows the clinic's patients (${webPatients})`)
    await wshot('online-04-web-patients')
    await web.fill('#patient-search', 'منى')
    await sleep(500)
    await web.locator('tbody tr').first().click()
    await web.waitForSelector('text=' + 'منى سعيد', { timeout: 10000 })
    await wshot('online-05-web-patient')
    await web.click('[data-nav="reports"]')
    await sleep(800)
    await wshot('online-06-web-reports')
    await web.click('[data-nav="settings"]')
    await sleep(500)
    check((await web.locator('[data-tab="backup"], [data-tab="security"], [data-tab="sync"]').count()) === 0, 'web settings hide backup / PIN / sync tabs')
    await wshot('online-07-web-settings')

    // ---------------------------------------------------------------- admin edits -> desktop
    await wcall('drugs.save', { name: 'Web Drug ' + stamp, form: 'Drops', strength: '0.3%', dose: 'قطرة واحدة', frequency: '', duration: '', route: '', instructions: '' })
    const s = (await wcall('settings.get')).data
    await wcall('settings.update', { copies: 2, rxForm: { ...s.rxForm, lists: { ...s.rxForm.lists, amount: ['قطرة واحدة', 'قطرتين', 'نقطة من الويب'] } } })
    const layouts = (await wcall('layouts.list')).data
    const other = layouts.find((l) => !l.isDefault)
    if (other) await wcall('layouts.setDefault', other.id)
    await wcall('settings.saveProfile', { clinicName: 'عيادة من الويب' })
    await webSaved()
    check(true, 'web changes saved online')

    await desk('sync.now')
    await sleep(1000)
    const drug = (await desk('drugs.search', 'Web Drug ' + stamp)).data
    check(drug.length === 1 && drug[0].strength === '0.3%', 'drug added on the web reached the desktop')
    const ds = (await desk('settings.get')).data
    check(ds.rxForm.lists.amount.includes('نقطة من الويب') && ds.copies === 2, 'dose list + copies changed on the web reached the desktop')
    check(ds.pinEnabled === false && ds.setupCompleted === true, 'device settings untouched')
    const dl = (await desk('layouts.list')).data.find((l) => l.isDefault)
    check(!other || dl.name === other.name, 'default print layout chosen on the web reached the desktop')
    check((await desk('settings.getProfile')).data.clinicName === 'عيادة من الويب', 'clinic profile edited on the web reached the desktop')

    // ---------------------------------------------------------------- offline on the desktop, then back
    await app.evaluate(async ({ session }) => session.defaultSession.setProxy({ proxyRules: 'http://127.0.0.1:9' }))
    await desk('patients.save', { name: 'مريض أثناء انقطاع النت ' + stamp, birthDate: '', birthDateEstimated: false, gender: 'male', phone: '', weight: '', allergies: '', chronicDiseases: '', notes: '' })
    await desk('sync.now')
    const off = await deskStatus()
    check(off.lastError !== '' && off.pending >= 1, `offline: change kept locally (pending ${off.pending})`)
    await page.click('[data-nav="patients"]')
    await page.click('[data-nav="settings"]')
    await page.click('[data-tab="sync"]')
    await sleep(500)
    await shot('online-08-desktop-offline')
    await app.evaluate(async ({ session }, p) => session.defaultSession.setProxy(p ? { proxyRules: p } : { mode: 'direct' }), proxy)
    await desk('sync.now')
    const back = await deskStatus()
    check(back.lastError === '' && back.pending === 0, 'back online: queued change sent')
    await web.click('#web-refresh')
    await sleep(2500)
    await web.click('[data-nav="patients"]')
    await web.fill('#patient-search', 'انقطاع')
    await sleep(600)
    check((await web.locator('tbody tr').count()) === 1, 'patient added while offline appears on the web')

    // Delete on the web -> desktop
    const victim = (await wcall('patients.search', 'انقطاع')).data[0]
    await wcall('patients.delete', victim.id)
    await webSaved()
    await desk('sync.now')
    check((await desk('patients.search', 'انقطاع')).data.length === 0, 'patient deleted on the web is deleted on the desktop')

    // A brand-new PC signs in from the setup wizard and downloads the clinic.
    const fresh = fs.mkdtempSync(path.join(os.tmpdir(), 'rxdesk-e2e-pc2-'))
    const app2 = await electron.launch({ args: ['.', '--no-sandbox'], env: { ...process.env, RXDESK_DATA_DIR: fresh, NODE_ENV: 'production' } })
    try {
      if (proxy) await app2.evaluate(async ({ session }, p) => session.defaultSession.setProxy({ proxyRules: p }), proxy)
      const pc2 = await app2.firstWindow()
      await pc2.waitForSelector('#setup-cloud', { timeout: 20000 })
      await pc2.click('#setup-cloud')
      await pc2.fill('#sync-email', doctorEmail)
      await pc2.fill('#sync-password', doctorPassword)
      await pc2.screenshot({ path: 'test-output/online-09-new-pc-wizard.png' })
      await pc2.click('#sync-signin')
      await pc2.waitForSelector('[data-nav="patients"]', { timeout: 60000 })
      await pc2.click('[data-nav="patients"]')
      await sleep(800)
      const n2 = await pc2.locator('tbody tr').count()
      check(n2 >= 4, `new PC skipped the wizard and downloaded the clinic (${n2} patients)`)
      const d2 = (await pc2.evaluate(() => window.rxdesk.invoke('drugs.search', ['Web Drug']))).data
      check(d2.length === 1, 'new PC has the drug added on the web')
      const l2 = (await pc2.evaluate(() => window.rxdesk.invoke('layouts.list', []))).data
      const l1 = (await desk('layouts.list')).data
      check(l2.length === l1.length, `new PC did not duplicate print layouts (${l2.length} / ${l1.length})`)
      await pc2.screenshot({ path: 'test-output/online-10-new-pc.png' })
    } finally {
      await app2.close().catch(() => {})
      fs.rmSync(fresh, { recursive: true, force: true })
    }

    // Sign out keeps local data
    await page.click('#sync-signout')
    await page.click('#sync-signout-confirm')
    await page.waitForSelector('#sync-signin', { timeout: 20000 })
    const after = await deskStatus()
    const left = (await desk('patients.search', '')).data.length
    check(!after.signedIn && left >= 4, `sign out stops sync and keeps the data on the PC (signedIn ${after.signedIn}, patients ${left})`)
  } finally {
    if (clinicId) {
      const { error } = await admin.functions.invoke('admin-clinics', { body: { action: 'delete', clinicId } })
      check(!error, 'test clinic deleted')
    }
    await browser.close().catch(() => {})
    try {
      process.kill(-server.pid)
    } catch {
      /* already stopped */
    }
  }
}
