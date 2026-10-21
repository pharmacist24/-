// End-to-end walkthrough of the built app (run `npm run build` first).
// Usage: node scripts/e2e.mjs <m2|m3|m4|m5|m6|m7>   (on Linux without a display: xvfb-run -a node …)
// Every stage starts from a fresh data folder, runs the wizard + patient checks, then its own checks.
// Screenshots are written to test-output/. Uses a throw-away data folder.
import { _electron as electron } from 'playwright-core'
import fs from 'fs'
import os from 'os'
import path from 'path'

const out = path.resolve('test-output')
fs.mkdirSync(out, { recursive: true })
const dataDir = process.env.KEEP_DATA_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'rxdesk-e2e-'))
const stage = process.argv[2] || 'm2'
const lang = process.env.E2E_LANG || 'ar'

let failures = 0
const check = (cond, msg) => {
  console.log((cond ? 'PASS ' : 'FAIL ') + msg)
  if (!cond) failures++
}

const t0 = Date.now()
const app = await electron.launch({
  args: ['.', '--no-sandbox'],
  env: { ...process.env, RXDESK_DATA_DIR: dataDir, NODE_ENV: 'production' }
})
const page = await app.firstWindow()
page.on('pageerror', (e) => {
  console.log('PAGE ERROR', e.message)
  failures++
})
page.on('console', (m) => m.type() === 'error' && console.log('console.error:', m.text()))
await page.setViewportSize({ width: 1366, height: 820 }).catch(() => {})
const shot = (name) => page.screenshot({ path: path.join(out, name + '.png') })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ---------------------------------------------------------------- setup wizard
await page.waitForSelector('#setup-next', { timeout: 20000 })
check(true, `setup wizard shown after ${Date.now() - t0} ms`)
if (lang === 'en') await page.click('#setup-language >> text=English')
await shot('01-wizard-welcome')
await page.click('#setup-next')
await page.fill('input >> nth=0', 'د. سامي عبد الله')
await page.fill('input >> nth=1', 'Dr. Sami Abdallah')
await page.fill('input >> nth=2', 'أخصائي الأمراض الجلدية')
await page.fill('input >> nth=3', 'Dermatology Specialist')
await page.fill('input >> nth=4', '12345')
await shot('02-wizard-doctor')
await page.click('#setup-next')
await page.fill('input >> nth=0', 'عيادة الشفاء')
await page.fill('input >> nth=1', '01001234567, 0233334444')
await page.fill('input >> nth=2', '15 شارع التحرير، الدقي، الجيزة')
await page.click('#setup-next')
await shot('03-wizard-paper')
await page.click('#setup-next')
await shot('04-wizard-pin')
await page.click('#setup-finish')
await page.waitForSelector('[data-nav="patients"]', { timeout: 10000 })
check(true, 'setup finished, main shell visible')

// ---------------------------------------------------------------- patients
await page.click('[data-nav="patients"]')
await page.waitForSelector('#patient-search')
await sleep(300)
const rows = await page.locator('tbody tr').count()
check(rows === 3, `3 sample patients listed (got ${rows})`)
await shot('05-patients')

await page.fill('#patient-search', 'احمد')
await sleep(400)
check((await page.locator('tbody tr').count()) === 1, 'search "احمد" finds أحمد (normalised)')
await page.fill('#patient-search', '0111')
await sleep(400)
check((await page.locator('tbody tr').count()) === 1, 'search by phone digits works')
await page.fill('#patient-search', '')

await page.click('#add-patient')
await page.fill('#pf-name', 'منى سعيد')
await page.fill('#pf-age', '28')
await page.fill('#pf-phone', '01099998888')
await page.fill('#pf-allergies', 'Aspirin')
await shot('06-patient-form')
await page.click('#pf-save')
await page.waitForSelector('#patient-new-rx')
await sleep(300)
await shot('07-patient-detail')
check((await page.textContent('h2')).includes('منى سعيد'), 'new patient detail page opened')

if (stage === 'm2') {
  await page.click('[data-nav="settings"]')
  await sleep(300)
  await shot('08-settings-clinic')
  await page.click('[data-tab="backup"]')
  await sleep(300)
  await shot('09-settings-backup')
}

// Stages that exercise every field use the detailed prescription screen.
if (['m3', 'm7'].includes(stage)) {
  await page.click('[data-nav="settings"]')
  await page.click('[data-tab="rxform"]')
  await page.click('[data-preset="detailed"]')
  await sleep(300)
}

if (stage !== 'm2') {
  const mod = await import(`./e2e-${stage}.mjs`)
  await mod.default({ page, app, shot, check, sleep, dataDir })
}

await app.close().catch(() => {})
if (!process.env.KEEP_DATA_DIR) fs.rmSync(dataDir, { recursive: true, force: true })
console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL CHECKS PASSED')
process.exit(failures ? 1 : 0)
