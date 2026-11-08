// Real-Windows smoke test of a built installer (run on GitHub's windows-latest runner).
//   node scripts/smoke-windows.mjs <path-to-installer.exe> <label>
// Installs silently, starts the installed RxDesk.exe twice (plain, then driven by Playwright through the setup
// wizard) and prints the app's log. Exits non-zero if the app does not start or the wizard does not work.
import { spawn, spawnSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { _electron as electron } from 'playwright-core'

const [installer, label = 'rxdesk'] = process.argv.slice(2)
const out = path.resolve('smoke-output', label)
fs.mkdirSync(out, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let failures = 0
const check = (ok, msg) => {
  console.log((ok ? 'PASS ' : 'FAIL ') + msg)
  if (!ok) failures++
}
const printLog = (dir, title) => {
  const log = path.join(dir, 'logs', 'rxdesk.log')
  console.log(`----- ${title}: ${log}`)
  if (fs.existsSync(log)) {
    const text = fs.readFileSync(log, 'utf8')
    console.log(text)
    fs.copyFileSync(log, path.join(out, title.replace(/\W+/g, '-') + '.log'))
    return text
  }
  console.log('(no log file)')
  return ''
}

// 1. Install
console.log('Installing', installer)
const inst = spawnSync(path.resolve(installer), ['/S'], { stdio: 'inherit' })
check(inst.status === 0, `installer exit code ${inst.status}`)
const exe = path.join(process.env.LOCALAPPDATA, 'Programs', 'rxdesk', 'RxDesk.exe')
for (let i = 0; i < 30 && !fs.existsSync(exe); i++) await sleep(1000)
check(fs.existsSync(exe), 'installed at ' + exe)
if (!fs.existsSync(exe)) process.exit(1)

// 2. Plain start (as a user double-clicking the shortcut)
const plainDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rxdesk-plain-'))
const child = spawn(exe, [], { env: { ...process.env, RXDESK_DATA_DIR: plainDir, ELECTRON_ENABLE_LOGGING: '1' } })
let output = ''
child.stdout.on('data', (d) => (output += d))
child.stderr.on('data', (d) => (output += d))
let exited = null
child.on('exit', (code, signal) => (exited = { code, signal }))
await sleep(20000)
check(exited === null, 'app still running after 20 s' + (exited ? ` (exited: ${JSON.stringify(exited)})` : ''))
if (exited === null) spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'])
await sleep(1500)
console.log('----- process output\n' + output.slice(-6000))
fs.writeFileSync(path.join(out, 'plain-output.txt'), output)
const plainLog = printLog(plainDir, 'plain start log')
check(/starting/.test(plainLog), 'log shows the app starting')
check(fs.existsSync(path.join(plainDir, 'rxdesk.db')), 'database created')

// 3. Through Playwright: the window renders and the setup wizard works
const pwDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rxdesk-pw-'))
let app
try {
  app = await electron.launch({ executablePath: exe, env: { ...process.env, RXDESK_DATA_DIR: pwDir }, timeout: 60000 })
  const page = await app.firstWindow({ timeout: 60000 })
  page.on('pageerror', (e) => check(false, 'page error: ' + e.message))
  page.on('console', (m) => m.type() === 'error' && console.log('console.error:', m.text()))
  await page.waitForSelector('#setup-next', { timeout: 60000 })
  check(true, 'setup wizard shown')
  await page.screenshot({ path: path.join(out, '1-wizard.png') })
  await page.click('#setup-next')
  await page.fill('input >> nth=0', 'د. اختبار')
  for (let i = 0; i < 3; i++) await page.click('#setup-next')
  await page.click('#setup-finish')
  await page.waitForSelector('[data-nav="patients"]', { timeout: 20000 })
  await page.click('[data-nav="patients"]')
  await page.waitForSelector('#patient-search', { timeout: 20000 })
  check(true, 'setup finished and patients screen opened')
  await page.screenshot({ path: path.join(out, '2-patients.png') })
  const info = await app.evaluate(({ app: a }) => ({ version: a.getVersion(), electron: process.versions.electron, arch: process.arch }))
  console.log('app info', JSON.stringify(info))
} catch (e) {
  check(false, 'Playwright start: ' + (e?.message ?? e))
} finally {
  await app?.close().catch(() => {})
}
printLog(pwDir, 'playwright start log')

console.log(failures ? `\n${failures} FAILURE(S) for ${label}` : `\nSMOKE TEST PASSED for ${label}`)
process.exit(failures ? 1 : 0)
