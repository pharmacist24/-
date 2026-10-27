// Drug library: export to Excel, import from Excel with preview.
import fs from 'fs'
import path from 'path'
import ExcelJS from 'exceljs'

export default async function ({ page, app, shot, check, sleep }) {
  const out = path.resolve('test-output')
  const stub = (save, open) =>
    app.evaluate(({ dialog }, [s, o]) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: s })
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [o] })
    }, [save, open])

  await page.click('[data-nav="library"]')
  await sleep(500)

  // Export
  const exp = path.join(out, 'drugs-export.xlsx')
  fs.rmSync(exp, { force: true })
  await stub(exp, exp)
  await page.click('[data-menu="excel"]')
  await page.click('#xl-export')
  await sleep(1200)
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(exp)
  const ws = wb.worksheets[0]
  check(ws.rowCount >= 23 && String(ws.getRow(1).getCell(1).value).includes('اسم الدواء'), `export written as a real .xlsx (${ws.rowCount - 1} drugs, bilingual header)`)

  // Template
  const tpl = path.join(out, 'drugs-template.xlsx')
  await stub(tpl, tpl)
  await page.click('[data-menu="excel"]')
  await page.click('#xl-template')
  await sleep(800)
  check(fs.existsSync(tpl), 'empty template downloaded')

  // Import: Arabic headers, 2 new drugs, 1 update, 1 row without name
  const imp = path.join(out, 'drugs-import.xlsx')
  const w2 = new ExcelJS.Workbook()
  const s2 = w2.addWorksheet('Sheet1')
  s2.addRow(['اسم الدواء', 'الشكل', 'التركيز', 'الجرعة', 'عدد المرات', 'المدة', 'تعليمات'])
  s2.addRow(['Zithrokan', 'Tab', '500 mg', '1 tablet', 'once daily', '3 days', 'قبل الأكل بساعة'])
  s2.addRow(['Motilium', 'Tab', '10 mg', '1 tablet', 'three times daily', '5 days', 'قبل الأكل'])
  s2.addRow(['Augmentin', '', '625 mg', '', '', '', ''])
  s2.addRow(['', 'Tab', '', '', '', '', ''])
  await w2.xlsx.writeFile(imp)
  await stub(imp, imp)
  await page.click('[data-menu="excel"]')
  await page.click('#xl-import')
  await page.waitForSelector('#xl-preview')
  await sleep(300)
  const summary = await page.textContent('[data-xl-summary]')
  check(/2 دواء جديد · 1 سيتم تحديثه/.test(summary), 'preview shows 2 new, 1 update: ' + summary)
  check((await page.locator('#xl-preview >> text=تم تجاهل 1 صف').count()) === 1, 'row without a name reported as skipped')
  await shot('80-excel-import-preview')
  await page.click('#xl-apply')
  await sleep(800)
  check((await page.locator('td:has-text("Zithrokan")').count()) === 1, 'imported drug appears in the library')
  const augRow = page.locator('tr:has(td:text-is("Augmentin"))')
  check((await augRow.textContent()).includes('625 mg') && (await augRow.textContent()).includes('Tab'), 'existing drug updated (strength) and kept its other details')

  // Use an imported drug in a prescription
  await page.click('[data-nav="rx"]')
  await page.waitForSelector('#patient-picker')
  await page.fill('#patient-picker', 'فاطمة')
  await sleep(400)
  await page.keyboard.press('Enter')
  await page.waitForSelector('#rx-patient-name')
  await page.click('[data-row="0"][data-field="drugName"]')
  await page.keyboard.type('Zithro', { delay: 40 })
  await sleep(500)
  await page.keyboard.press('Enter')
  await sleep(300)
  check(
    (await page.inputValue('[data-row="0"][data-field="dose"]')).startsWith('1 tablet') && (await page.inputValue('[data-row="0"][data-field="frequency"]')) === 'once daily',
    'imported drug autocompletes with its details (amount + frequency)'
  )
}
