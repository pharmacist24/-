// Milestone 4 checks: preview, PDF output and multi-page pagination.
import fs from 'fs'
import path from 'path'

export default async function ({ page, app, shot, check, sleep }) {
  const out = path.resolve('test-output')
  // Replace the "Save as" dialog so PDFs land in test-output without user interaction.
  const stubSave = (file) =>
    app.evaluate(({ dialog, shell }, f) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: f })
      shell.openPath = async () => ''
    }, file)

  // Open a sample patient's prescription and preview it.
  await page.click('[data-nav="patients"]')
  await page.fill('#patient-search', 'فاطمة')
  await sleep(400)
  await page.keyboard.press('Enter')
  await page.waitForSelector('[data-reprint]')
  await page.locator('[data-reprint]').first().click()
  await page.waitForSelector('#preview-frame', { timeout: 15000 })
  await sleep(1200)
  await shot('20-preview-a5')
  const frame = page.frameLocator('#preview-frame')
  check((await frame.locator('.rx-page').count()) === 1, 'preview shows 1 page for a short prescription')
  check((await frame.locator('text=Terbinafine').count()) === 1, 'preview contains the drug name')

  const pdfA5 = path.join(out, 'rx-a5.pdf')
  fs.rmSync(pdfA5, { force: true })
  await stubSave(pdfA5)
  await page.click('#preview-pdf')
  for (let i = 0; i < 40 && !fs.existsSync(pdfA5); i++) await sleep(250)
  check(fs.existsSync(pdfA5) && fs.statSync(pdfA5).size > 5000, 'PDF saved from preview')
  await page.keyboard.press('Escape')

  // A long prescription must continue on a second page.
  await page.click('[data-nav="rx"]')
  await page.fill('#patient-picker', 'يوسف')
  await sleep(400)
  await page.keyboard.press('Enter')
  await page.waitForSelector('#rx-patient-name')
  const drugs = ['Amoxicillin', 'Paracetamol', 'Ibuprofen', 'Omeprazole', 'Domperidone', 'Cetirizine', 'Loratadine', 'Salbutamol', 'Vitamin D3', 'Ferrous Sulfate', 'Fluconazole', 'Hydrocortisone', 'Metformin', 'Amlodipine']
  for (let i = 0; i < drugs.length; i++) {
    await page.click(`[data-row="${i}"][data-field="drugName"]`)
    await page.keyboard.type(drugs[i], { delay: 5 })
    await sleep(250)
    await page.keyboard.press('Enter')
    await sleep(150)
  }
  await page.fill('#rx-notes', 'متابعة بعد أسبوع')
  await page.keyboard.press('Control+s')
  await sleep(800)
  await page.click('#rx-preview')
  await page.waitForSelector('#preview-frame', { timeout: 15000 })
  await sleep(1500)
  const pages = await frame.locator('.rx-page').count()
  check(pages === 2, `14 medicines on A5 continue on a second page (pages: ${pages})`)
  check((await frame.locator('.rx-page').nth(0).locator('.rx-el-signature').count()) === 0, 'signature only on the last page')
  check((await frame.locator('.rx-page').nth(1).locator('.rx-el-signature').count()) === 1, 'signature printed on last page')
  check((await frame.locator('[data-med]').count()) === drugs.length, 'every medicine printed exactly once')
  // Nothing in the medicines box may run past its bottom edge.
  const overflow = await page.evaluate(() => {
    const doc = document.querySelector('#preview-frame').contentDocument
    let worst = -1e9
    for (const box of doc.querySelectorAll('.rx-el-medicines')) {
      const bottom = box.getBoundingClientRect().bottom
      for (const it of box.querySelectorAll('[data-med]')) worst = Math.max(worst, it.getBoundingClientRect().bottom - bottom)
    }
    return worst
  })
  check(overflow <= 0.5, `medicines stay inside their box on every page (max overflow ${overflow.toFixed(1)} px)`)
  await shot('21-preview-2pages')
  const pdfLong = path.join(out, 'rx-a5-long.pdf')
  fs.rmSync(pdfLong, { force: true })
  await stubSave(pdfLong)
  await page.click('#preview-pdf')
  for (let i = 0; i < 40 && !fs.existsSync(pdfLong); i++) await sleep(250)
  check(fs.existsSync(pdfLong), 'multi-page PDF saved')
  await page.keyboard.press('Escape')

  // Print: no printer exists in the test machine, so a friendly error must appear (no crash).
  await page.click('#rx-print')
  await sleep(2500)
  await shot('22-print-attempt')
}
