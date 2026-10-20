// Launches the built app with a throw-away data folder and checks it starts.
// Usage: xvfb-run node scripts/smoke.mjs [screenshot.png]
import { _electron as electron } from 'playwright-core'
import fs from 'fs'
import os from 'os'
import path from 'path'

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rxdesk-smoke-'))
const started = Date.now()
const app = await electron.launch({
  args: ['.', '--no-sandbox'],
  env: { ...process.env, RXDESK_DATA_DIR: dataDir, NODE_ENV: 'production' }
})
const page = await app.firstWindow()
await page.waitForSelector('#status:not(:has-text("…"))', { timeout: 20000 })
console.log('window ready in', Date.now() - started, 'ms')
console.log(await page.textContent('#status'))
if (process.argv[2]) await page.screenshot({ path: process.argv[2] })
await app.close()
console.log('db exists:', fs.existsSync(path.join(dataDir, 'rxdesk.db')), 'log exists:', fs.existsSync(path.join(dataDir, 'logs', 'rxdesk.log')))
fs.rmSync(dataDir, { recursive: true, force: true })
