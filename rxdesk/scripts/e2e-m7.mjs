// Milestone 7 checks: English/LTR screens and keyboard shortcuts.
export default async function ({ page, shot, check, sleep }) {
  // Switch the UI to English at runtime.
  await page.click('[data-nav="settings"]')
  await page.click('text=عام')
  await page.click('#ui-language >> text=English')
  await sleep(400)
  check((await page.evaluate(() => document.documentElement.dir)) === 'ltr', 'switching to English makes the layout LTR')
  check((await page.locator('[data-nav="patients"]').textContent()).includes('Patients'), 'navigation is translated')

  // Keyboard: Ctrl+F -> patients, F1 -> new prescription
  await page.keyboard.press('Control+f')
  await page.waitForSelector('#patient-search')
  check(true, 'Ctrl+F opens patients')
  await shot('50-en-patients')
  await page.keyboard.press('F1')
  await page.waitForSelector('#patient-picker')
  check(true, 'F1 opens a new prescription')

  // Keyboard-only prescription: type patient, Enter, Tab to diagnosis, drug, Enter...
  await page.focus('#patient-picker')
  await page.keyboard.type('Yousef'.slice(0, 0) + 'يوسف')
  await sleep(400)
  await page.keyboard.press('Enter')
  await page.waitForSelector('#rx-patient-name')
  await page.focus('#rx-diagnosis')
  await page.keyboard.type('Bronchial asthma')
  await page.keyboard.press('Escape')
  await page.focus('[data-row="0"][data-field="drugName"]')
  await page.keyboard.type('Salb')
  await sleep(400)
  await page.keyboard.press('Enter') // pick Salbutamol, focus jumps to dose
  await sleep(200)
  await page.keyboard.press('Enter') // dose -> frequency
  await page.keyboard.press('Enter') // frequency -> duration
  await page.keyboard.press('Enter') // duration -> route
  await page.keyboard.press('Enter') // route -> instructions
  await page.keyboard.press('Enter') // instructions -> next row drug name
  await sleep(200)
  const f = await page.evaluate(() => [document.activeElement?.getAttribute('data-row'), document.activeElement?.getAttribute('data-field')].join(':'))
  check(f === '1:drugName', 'Enter walks through the row and lands on the next medicine (' + f + ')')
  check((await page.locator('[data-allergy-warning]').count()) === 0, 'no allergy warning for Salbutamol (patient allergic to sulfa)')
  await page.keyboard.type('Septrin')
  await sleep(300)
  await page.keyboard.press('Escape')
  await sleep(200)
  check((await page.locator('[data-allergy-warning]').count()) >= 1, 'allergy warning for Septrin (sulfa) in English UI')
  await shot('51-en-rx')
  await page.keyboard.press('Control+s')
  await sleep(700)
  check(/#\d+/.test(await page.textContent('h3')), 'Ctrl+S saves (title shows the number)')
  await page.keyboard.press('Control+n')
  await sleep(500)
  check((await page.locator('#patient-picker').count()) === 1, 'Ctrl+N starts a new prescription')

  await page.click('[data-nav="designer"]')
  await sleep(800)
  await shot('52-en-designer')
  await page.click('[data-nav="library"]')
  await sleep(400)
  await shot('53-en-library')
  await page.click('[data-nav="settings"]')
  await page.click('[data-tab="backup"]')
  await sleep(300)
  await shot('54-en-settings')
}
