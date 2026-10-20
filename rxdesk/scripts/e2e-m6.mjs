// Milestone 6 checks: reports, backup/restore, auto backup, CSV export, PIN lock.
import fs from 'fs'
import path from 'path'
import { _electron as electron } from 'playwright-core'

export default async function ({ page, app, shot, check, sleep, dataDir }) {
  const out = path.resolve('test-output')
  const stub = (save, open) =>
    app.evaluate(({ dialog, shell }, [s, o]) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: s })
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [o] })
      shell.openPath = async () => ''
    }, [save, open])

  // Reports
  await page.click('[data-nav="reports"]')
  await sleep(600)
  check((await page.locator('[data-stat]').first().textContent()) === '3', 'reports: 3 prescriptions today')
  await shot('40-reports')

  // Backup now
  const zip = path.join(out, 'backup-test.zip')
  fs.rmSync(zip, { force: true })
  await stub(zip, zip)
  await page.click('[data-nav="settings"]')
  await page.click('[data-tab="backup"]')
  await page.click('#backup-now')
  await sleep(1200)
  check(fs.existsSync(zip) && fs.statSync(zip).size > 2000, 'manual backup written to chosen file')

  // Automatic backup
  await page.click('text=عمل نسخة تلقائية الآن')
  await sleep(1200)
  const autoDir = path.join(dataDir, 'backups')
  const autos = fs.existsSync(autoDir) ? fs.readdirSync(autoDir).filter((f) => f.startsWith('RxDesk-auto-')) : []
  check(autos.length === 1, 'automatic backup created in default folder')
  await shot('41-backup')

  // CSV export
  const csv = path.join(out, 'patients.csv')
  await stub(csv, csv)
  await page.click('text=تصدير المرضى إلى Excel (CSV)')
  await sleep(800)
  const csvText = fs.existsSync(csv) ? fs.readFileSync(csv, 'utf8') : ''
  check(csvText.startsWith('﻿') && csvText.includes('منى سعيد'), 'patients exported to CSV (UTF-8 with BOM)')
  const csv2 = path.join(out, 'prescriptions.csv')
  await stub(csv2, csv2)
  await page.click('text=تصدير الروشتات إلى Excel (CSV)')
  await sleep(800)
  check(fs.existsSync(csv2) && fs.readFileSync(csv2, 'utf8').includes('Amlodipine'), 'prescriptions exported to CSV')

  // Restore: add a patient after the backup, restore, the patient must be gone.
  await page.click('[data-nav="patients"]')
  await page.click('#add-patient')
  await page.fill('#pf-name', 'مريض بعد النسخة')
  await page.click('#pf-save')
  await sleep(500)
  await page.click('[data-nav="settings"]')
  await page.click('[data-tab="backup"]')
  await stub(zip, zip)
  await page.click('text=استرجاع من نسخة احتياطية…')
  await page.waitForSelector('text=استرجاع هذه النسخة؟')
  await shot('42-restore-confirm')
  await page.click('.mantine-Modal-content button:has-text("تأكيد")')
  await sleep(2500)
  await page.waitForSelector('[data-nav="patients"]', { timeout: 15000 })
  await page.click('[data-nav="patients"]')
  await sleep(500)
  check((await page.locator('text=مريض بعد النسخة').count()) === 0, 'restore replaced data with the backup')
  check((await page.locator('text=منى سعيد').count()) === 1, 'restored data contains patients from the backup')
  const safety = fs.readdirSync(autoDir).filter((f) => f.startsWith('before-restore-'))
  check(safety.length === 1, 'safety copy saved before restoring')

  // PIN
  await page.click('[data-nav="settings"]')
  await page.click('[data-tab="security"]')
  await page.fill('#pin-new', '2468')
  await page.fill('#pin-new2', '2468')
  await page.click('#pin-save')
  await sleep(600)
  await page.click('.rx-lock-btn')
  await page.waitForSelector('#pin-input')
  await shot('43-lock')
  check((await page.locator('[data-nav="patients"]').count()) === 0, 'lock screen hides the app')
  const blocked = await page.evaluate(() => window.rxdesk.invoke('patients.search', ['']))
  check(blocked.ok === false && blocked.code === 'LOCKED', 'data access is blocked in the main process while locked')
  await page.fill('#pin-input', '1111')
  await page.click('#unlock-btn')
  await sleep(400)
  check((await page.locator('text=رقم سري خاطئ').count()) === 1, 'wrong PIN rejected')
  await page.fill('#pin-input', '2468')
  await page.click('#unlock-btn')
  await page.waitForSelector('[data-nav="patients"]', { timeout: 5000 })
  check(true, 'correct PIN unlocks')

  // Restart: the app must open locked.
  await app.close()
  const app2 = await electron.launch({ args: ['.', '--no-sandbox'], env: { ...process.env, RXDESK_DATA_DIR: dataDir, NODE_ENV: 'production' } })
  const p2 = await app2.firstWindow()
  await p2.waitForSelector('#pin-input', { timeout: 20000 })
  check(true, 'app opens locked after restart')
  await p2.fill('#pin-input', '2468')
  await p2.keyboard.press('Enter')
  await p2.waitForSelector('[data-nav="patients"]', { timeout: 5000 })
  check(true, 'unlock after restart with Enter')
  await app2.close()
}
