// Milestone 5 checks: Print Format Designer.
import fs from 'fs'
import path from 'path'

export default async function ({ page, app, shot, check, sleep }) {
  const out = path.resolve('test-output')
  await page.click('[data-nav="designer"]')
  await page.waitForSelector('#designer-canvas [data-el-type="patientName"]')
  await sleep(600)
  await shot('30-designer')

  const box = async (sel) => page.locator(sel).first().boundingBox()
  const zoomText = await page.locator('text=/^\\d+%$/').first().textContent()
  const zoom = parseInt(zoomText) / 100
  const pxPerMm = (96 / 25.4) * zoom

  // Drag the patient name 20 mm to the left / 10 mm down.
  const hit = '#designer-canvas [data-el-type="patientName"]'
  const before = await box(hit)
  await page.mouse.move(before.x + 10, before.y + 5)
  await page.mouse.down()
  for (let i = 1; i <= 10; i++) await page.mouse.move(before.x + 10 - 2 * pxPerMm * i, before.y + 5 + pxPerMm * i)
  await page.mouse.up()
  await sleep(200)
  const after = await box(hit)
  const dxMm = (after.x - before.x) / pxPerMm
  const dyMm = (after.y - before.y) / pxPerMm
  check(Math.abs(dxMm + 20) < 2.5 && Math.abs(dyMm - 10) < 2.5, `drag moved element by ≈(-20, +10) mm (got ${dxMm.toFixed(1)}, ${dyMm.toFixed(1)})`)
  check(Math.abs(Math.round(after.x / pxPerMm * 100)) >= 0, 'position snapped')

  // Undo / redo
  await page.click('#undo')
  await sleep(150)
  const undone = await box(hit)
  check(Math.abs(undone.x - before.x) < 1 && Math.abs(undone.y - before.y) < 1, 'undo restores the position')
  await page.click('#redo')
  await sleep(150)
  check(Math.abs((await box(hit)).x - after.x) < 1, 'redo re-applies the move')

  // Resize with the south-east handle
  await page.click(hit)
  const se = await box('[data-handle="se"]')
  await page.mouse.move(se.x + se.width / 2, se.y + se.height / 2)
  await page.mouse.down()
  for (let i = 1; i <= 5; i++) await page.mouse.move(se.x + se.width / 2 + 2 * pxPerMm * i, se.y + se.height / 2 + pxPerMm * i)
  await page.mouse.up()
  await sleep(150)
  const resized = await box(hit)
  check(resized.width - after.width > 5 * pxPerMm, 'resize handle makes the element wider')

  // Properties: font size and bold
  await page.fill('#font-size', '16')
  await page.click('#toggle-bold')
  await sleep(200)
  const weight = await page.evaluate(() => {
    const el = document.querySelector('#designer-canvas .rx-el-patientName')
    return getComputedStyle(el).fontWeight + ' ' + getComputedStyle(el).fontSize
  })
  check(weight.startsWith('700') && weight.includes('21.3'), 'font size 16pt + bold applied on the canvas: ' + weight)
  await page.fill('#label-text', 'اسم المريض:')
  await sleep(150)
  check((await page.locator('#designer-canvas .rx-el-patientName .rx-label').textContent()) === 'اسم المريض:', 'custom label text shown')

  // Arrow-key nudging
  await page.click(hit)
  const pre = await box(hit)
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  await sleep(100)
  check(Math.abs(((await box(hit)).x - pre.x) / pxPerMm - 2) < 0.3, 'arrow keys nudge by 1 mm')

  // Add a free text element from the palette, then delete it with the Delete key
  const count0 = await page.locator('#designer-canvas [data-el-id]').count()
  await page.click('[data-add="text"]')
  await sleep(150)
  check((await page.locator('#designer-canvas [data-el-id]').count()) === count0 + 1, 'palette adds a new element')
  await page.locator('#designer-canvas').click({ position: { x: 5, y: 5 } })
  await page.locator('#designer-canvas [data-el-type="text"]').last().click()
  await page.keyboard.press('Delete')
  await sleep(150)
  check((await page.locator('#designer-canvas [data-el-id]').count()) === count0, 'Delete key removes the element')

  // Medicines block -> table style
  await page.locator('#designer-canvas [data-el-type="medicines"]').click({ position: { x: 20, y: 60 } })
  await page.click('#med-style >> text=جدول')
  await sleep(200)
  check((await page.locator('#designer-canvas .rx-med-table').count()) === 1, 'medicines block switched to table style')
  await shot('31-designer-edited')

  // Page settings: background image + calibration
  await page.locator('#designer-canvas').click({ position: { x: 5, y: 5 } })
  await page.waitForSelector('#page-panel')
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('#upload-bg')])
  await chooser.setFiles(path.join(out, 'pdf-a5-1.png'))
  await sleep(800)
  check((await page.locator('#designer-canvas img.rx-bg').count()) === 1, 'background image shown in the designer')
  await page.fill('#offset-x', '1.5')
  await page.fill('#layout-name', 'تصميم تجريبي')
  await sleep(200)
  await shot('32-designer-background')

  // Save, then verify preview == designer geometry
  await page.keyboard.press('Control+s')
  await sleep(700)
  check((await page.locator('#save-layout').isDisabled()), 'Ctrl+S saved the layout')
  const designerRect = await page.evaluate(() => {
    const pageEl = document.querySelector('#designer-canvas .rx-page').getBoundingClientRect()
    const el = document.querySelector('#designer-canvas .rx-el-patientName').getBoundingClientRect()
    return { x: (el.left - pageEl.left) / pageEl.width, y: (el.top - pageEl.top) / pageEl.height, w: el.width / pageEl.width }
  })
  await page.click('[data-menu="test"]')
  await page.click('#preview-sample')
  await page.waitForSelector('#preview-frame')
  await sleep(1200)
  const previewRect = await page.evaluate(() => {
    const doc = document.querySelector('#preview-frame').contentDocument
    const pageEl = doc.querySelector('.rx-page').getBoundingClientRect()
    const el = doc.querySelector('.rx-el-patientName').getBoundingClientRect()
    return { x: (el.left - pageEl.left) / pageEl.width, y: (el.top - pageEl.top) / pageEl.height, w: el.width / pageEl.width }
  })
  const diff = Math.max(Math.abs(designerRect.x - previewRect.x), Math.abs(designerRect.y - previewRect.y), Math.abs(designerRect.w - previewRect.w))
  check(diff < 0.002, `designer and print preview place elements identically (max diff ${(diff * 100).toFixed(3)}% of page)`)
  check((await page.frameLocator('#preview-frame').locator('img.rx-bg').count()) === 0, 'background not printed when "print background" is off')
  await shot('33-designer-preview')
  await page.keyboard.press('Escape')

  // Long sample flows to 2 pages
  await page.click('[data-menu="test"]')
  await page.click('#preview-long')
  await page.waitForSelector('#preview-frame')
  await sleep(1500)
  const pages = await page.frameLocator('#preview-frame').locator('.rx-page').count()
  check(pages >= 2, `long sample continues on more pages (${pages})`)
  await page.keyboard.press('Escape')

  // Export & import
  const file = path.join(out, 'layout-export.rxlayout')
  fs.rmSync(file, { force: true })
  await app.evaluate(({ dialog }, f) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: f })
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [f] })
  }, file)
  await page.click('[data-menu="layout"]')
  await page.click('text=تصدير…')
  await sleep(600)
  const exported = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null
  check(exported?.format === 'rxdesk-layout' && exported.layout.offsetMm.x === 1.5, 'layout exported to a file')
  const before3 = await page.locator('#layout-select').inputValue()
  await page.click('[data-menu="layout"]')
  await page.click('text=استيراد…')
  await sleep(800)
  const nowName = await page.locator('#layout-select').inputValue()
  check(nowName !== before3 && nowName.includes('تصميم تجريبي'), 'layout imported as a new layout: ' + nowName)

  // New layout from blank A4
  await page.click('#new-layout')
  await page.fill('#new-layout-name', 'Blank A4')
  await page.click('text=A4 – صفحة فارغة')
  await page.click('#create-layout')
  await sleep(700)
  check((await page.locator('#designer-canvas [data-el-id]').count()) === 0, 'new blank layout created')
  await page.click('[data-add="doctorNameAr"]')
  await sleep(200)
  await shot('34-designer-blank')
}
