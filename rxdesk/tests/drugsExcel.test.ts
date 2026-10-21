import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import ExcelJS from 'exceljs'
import { openDatabase } from '../src/main/db/database'
import type { Repo } from '../src/main/db/repo'
import { gridToDrugs, headerField, parseCsv, planImport, readDrugFile, writeDrugsXlsx } from '../src/main/services/drugsExcel'

let dir: string
let repo: Repo
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rxdesk-xl-'))
  repo = openDatabase(path.join(dir, 't.db')).repo
})
afterEach(() => {
  repo.db.close()
  fs.rmSync(dir, { recursive: true, force: true })
})

async function sheet(file: string, rows: (string | number)[][]) {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('S')
  rows.forEach((r) => ws.addRow(r))
  await wb.xlsx.writeFile(file)
}

describe('drug Excel import/export', () => {
  it('export → re-import round trip keeps every drug and field', async () => {
    const file = path.join(dir, 'out.xlsx')
    const drugs = repo.listDrugs()
    await writeDrugsXlsx(drugs, file, { withUseCount: true })
    const read = await readDrugFile(file)
    expect(read.rows.length).toBe(drugs.length)
    const aug = read.rows.find((r) => r.name === 'Augmentin')!
    expect(aug).toMatchObject({ form: 'Tab', strength: '1 g', instructions: 'بعد الأكل' })
    const plan = planImport(read.rows, (n) => repo.getDrugByName(n))
    expect(plan.sameCount).toBe(drugs.length)
  })

  it('understands Arabic headers in any order, numbers and blank names', async () => {
    const file = path.join(dir, 'ar.xlsx')
    await sheet(file, [
      ['قائمة أدوية العيادة'],
      ['التركيز', 'اسم الدواء', 'الجرعة', 'المدة'],
      ['250 mg', 'Klacid', 'قرص', '7 أيام'],
      [500, 'Flagyl', '1 tablet', 5],
      ['10 mg', '', 'x', '']
    ])
    const r = await readDrugFile(file)
    expect(r.rows).toEqual([
      expect.objectContaining({ name: 'Klacid', strength: '250 mg', dose: 'قرص', duration: '7 أيام' }),
      expect.objectContaining({ name: 'Flagyl', strength: '500', duration: '5' })
    ])
    expect(r.skipped).toEqual([5])
  })

  it('uses the default column order when there is no header row', () => {
    const r = gridToDrugs([['Zyrtec', 'Tab', '10 mg', '1 tablet', 'once daily', '5 days', 'Oral', 'at night']])
    expect(r.rows[0]).toMatchObject({ name: 'Zyrtec', route: 'Oral', instructions: 'at night' })
  })

  it('reads Excel CSV (UTF-8 BOM, quotes, semicolons)', async () => {
    const file = path.join(dir, 'd.csv')
    fs.writeFileSync(file, '﻿Name;Form;Instructions\r\n"Brufen, 400";Tab;"بعد ""الأكل"""\r\n', 'utf8')
    const r = await readDrugFile(file)
    expect(r.rows[0]).toMatchObject({ name: 'Brufen, 400', form: 'Tab', instructions: 'بعد "الأكل"' })
    expect(parseCsv('a,b\n1,2')).toEqual([['a', 'b'], ['1', '2']])
  })

  it('recognises bilingual headers', () => {
    expect(headerField('Drug name / اسم الدواء')).toBe('name')
    expect(headerField('الشكل')).toBe('form')
    expect(headerField('Times used / مرات الاستخدام')).toBe('')
  })

  it('updates existing drugs only in filled cells; duplicates: last wins', () => {
    const rows = [
      { name: 'augmentin', form: '', strength: '625 mg', dose: '', frequency: '', duration: '', route: '', instructions: '' },
      { name: 'New One', form: 'Cap', strength: '', dose: 'a', frequency: '', duration: '', route: '', instructions: '' },
      { name: 'New One', form: 'Tab', strength: '', dose: 'b', frequency: '', duration: '', route: '', instructions: '' }
    ]
    const plan = planImport(rows, (n) => repo.getDrugByName(n))
    expect(plan).toMatchObject({ newCount: 1, updateCount: 1, sameCount: 0, duplicates: 1 })
    const res = repo.importDrugs(plan.rows)
    expect(res).toEqual({ added: 1, updated: 1 })
    const aug = repo.getDrugByName('Augmentin')!
    expect(aug.strength).toBe('625 mg')
    expect(aug.form).toBe('Tab') // untouched
    expect(aug.name).toBe('Augmentin') // keeps original spelling
    expect(repo.getDrugByName('new one')!.form).toBe('Tab')
  })
})
