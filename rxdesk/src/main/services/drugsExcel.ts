import fs from 'fs'
import path from 'path'
import ExcelJS from 'exceljs'
import type { Drug, DrugInput } from '@shared/types'

// Excel import/export of the drug library. No Electron imports (unit-testable).

export type DrugField = 'name' | 'form' | 'strength' | 'dose' | 'frequency' | 'duration' | 'route' | 'instructions'

export const DRUG_FIELDS: DrugField[] = ['name', 'form', 'strength', 'dose', 'frequency', 'duration', 'route', 'instructions']

const HEADERS: Record<DrugField, string> = {
  name: 'Drug name / اسم الدواء',
  form: 'Form / الشكل',
  strength: 'Strength / التركيز',
  dose: 'Dose / الجرعة',
  frequency: 'Frequency / عدد المرات',
  duration: 'Duration / المدة',
  route: 'Route / طريقة الاستخدام',
  instructions: 'Instructions / تعليمات'
}

/** Words that identify each column in a header row (English or Arabic). */
const HEADER_WORDS: Record<DrugField, string[]> = {
  name: ['drug name', 'drug', 'name', 'medicine', 'medication', 'trade name', 'brand', 'اسم الدواء', 'الدواء', 'دواء', 'الاسم', 'اسم'],
  form: ['form', 'dosage form', 'الشكل', 'شكل', 'الشكل الدوائي'],
  strength: ['strength', 'concentration', 'التركيز', 'تركيز', 'القوة'],
  dose: ['dose', 'dosage', 'الجرعة', 'جرعة'],
  frequency: ['frequency', 'times', 'عدد المرات', 'التكرار', 'المرات'],
  duration: ['duration', 'days', 'period', 'المدة', 'مدة'],
  route: ['route', 'way', 'طريقة الاستخدام', 'الطريقة', 'طريقة'],
  instructions: ['instructions', 'notes', 'advice', 'تعليمات', 'ملاحظات', 'إرشادات']
}

const norm = (s: string) => s.toLowerCase().replace(/[ً-ٟ]/g, '').replace(/[أإآ]/g, 'ا').replace(/\s+/g, ' ').trim()

/** Which field a header cell belongs to ('' if none). Each part of "English / عربي" is tried. */
export function headerField(cell: string): DrugField | '' {
  const parts = cell.split(/[\/|()\-–]/).map(norm).filter(Boolean)
  for (const f of DRUG_FIELDS) {
    const words = HEADER_WORDS[f].map(norm)
    if (parts.some((p) => words.includes(p))) return f
  }
  return ''
}

function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v.trim()
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v === 'object') {
    const o = v as unknown as Record<string, unknown>
    if (Array.isArray(o.richText)) return (o.richText as { text: string }[]).map((r) => r.text).join('').trim()
    if ('result' in o) return cellText(o.result as ExcelJS.CellValue)
    if ('text' in o) return String(o.text ?? '').trim()
  }
  return String(v).trim()
}

/** Minimal CSV parser (quotes, commas or semicolons, CRLF, BOM). */
export function parseCsv(text: string): string[][] {
  const t = text.replace(/^﻿/, '')
  const firstLine = t.split(/\r?\n/, 1)[0] ?? ''
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ','
  const rows: string[][] = []
  let row: string[] = []
  let cur = ''
  let q = false
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (q) {
      if (c === '"' && t[i + 1] === '"') {
        cur += '"'
        i++
      } else if (c === '"') q = false
      else cur += c
    } else if (c === '"') q = true
    else if (c === sep) {
      row.push(cur)
      cur = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++
      row.push(cur)
      rows.push(row)
      row = []
      cur = ''
    } else cur += c
  }
  if (cur || row.length) {
    row.push(cur)
    rows.push(row)
  }
  return rows.map((r) => r.map((x) => x.trim()))
}

export interface ReadResult {
  rows: DrugInput[]
  /** Spreadsheet row numbers that had details but no drug name. */
  skipped: number[]
}

/** Turns a grid of cells into drug rows, finding the header row (or using the default column order). */
export function gridToDrugs(grid: string[][]): ReadResult {
  let headerIndex = -1
  let map: (DrugField | '')[] = []
  for (let i = 0; i < Math.min(grid.length, 10); i++) {
    const m = grid[i].map((c) => headerField(c))
    if (m.includes('name') && m.filter(Boolean).length >= 1) {
      headerIndex = i
      map = m
      break
    }
  }
  if (headerIndex < 0) map = [...DRUG_FIELDS]
  const rows: DrugInput[] = []
  const skipped: number[] = []
  grid.slice(headerIndex + 1).forEach((cells, k) => {
    const d: DrugInput = { name: '', form: '', strength: '', dose: '', frequency: '', duration: '', route: '', instructions: '' }
    map.forEach((f, col) => {
      if (f && !d[f]) d[f] = (cells[col] ?? '').trim()
    })
    if (!d.name) {
      if (cells.some((c) => c && c.trim())) skipped.push(headerIndex + 2 + k)
      return
    }
    rows.push(d)
  })
  return { rows, skipped }
}

export async function readDrugFile(file: string): Promise<ReadResult> {
  const ext = path.extname(file).toLowerCase()
  if (ext === '.csv' || ext === '.txt') return gridToDrugs(parseCsv(fs.readFileSync(file, 'utf8')))
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(file)
  const ws = wb.worksheets.find((w) => w.rowCount > 0) ?? wb.worksheets[0]
  if (!ws) return { rows: [], skipped: [] }
  const grid: string[][] = []
  ws.eachRow({ includeEmpty: true }, (row, n) => {
    const cells: string[] = []
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      cells[col - 1] = cellText(cell.value)
    })
    grid[n - 1] = Array.from(cells, (c) => c ?? '')
  })
  return gridToDrugs(Array.from(grid, (r) => r ?? []))
}

export async function writeDrugsXlsx(drugs: (DrugInput & { useCount?: number })[], file: string, opts: { withUseCount?: boolean } = {}): Promise<void> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'RxDesk'
  const ws = wb.addWorksheet('Drugs', { views: [{ state: 'frozen', ySplit: 1 }] })
  const cols = [
    ...DRUG_FIELDS.map((f) => ({ header: HEADERS[f], key: f, width: f === 'name' ? 28 : f === 'instructions' || f === 'frequency' ? 26 : 16 })),
    ...(opts.withUseCount ? [{ header: 'Times used / مرات الاستخدام', key: 'useCount', width: 14 }] : [])
  ]
  ws.columns = cols
  for (const d of drugs) ws.addRow({ ...d })
  const head = ws.getRow(1)
  head.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0C8C69' } }
  head.alignment = { vertical: 'middle' }
  head.height = 22
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } }
  fs.mkdirSync(path.dirname(file), { recursive: true })
  await wb.xlsx.writeFile(file)
}

export const TEMPLATE_ROWS: DrugInput[] = [
  { name: 'Augmentin', form: 'Tab', strength: '1 g', dose: '1 tablet', frequency: 'every 12 hours', duration: '7 days', route: 'Oral', instructions: 'بعد الأكل' },
  { name: 'Panadol Extra', form: 'Tab', strength: '500/65 mg', dose: '1 tablet', frequency: 'every 8 hours when needed', duration: '', route: 'Oral', instructions: '' }
]

export type ImportStatus = 'new' | 'update' | 'same'

export interface ImportPlan {
  rows: (DrugInput & { status: ImportStatus })[]
  newCount: number
  updateCount: number
  sameCount: number
  duplicates: number
}

/**
 * Decides what each row will do. Existing drugs (same name, any case) are updated only in the cells
 * that are filled in the sheet; empty cells never erase what the doctor already has.
 */
export function planImport(rows: DrugInput[], existing: (name: string) => Drug | null): ImportPlan {
  const byName = new Map<string, DrugInput>()
  let duplicates = 0
  for (const r of rows) {
    const k = r.name.trim().toLowerCase()
    if (byName.has(k)) duplicates++
    byName.set(k, r) // last one wins
  }
  const out: ImportPlan['rows'] = []
  for (const r of byName.values()) {
    const cur = existing(r.name)
    if (!cur) {
      out.push({ ...r, status: 'new' })
      continue
    }
    const merged: DrugInput = { ...cur, id: cur.id, name: cur.name }
    let changed = false
    for (const f of DRUG_FIELDS) {
      if (f === 'name') continue
      if (r[f] && r[f] !== cur[f]) {
        merged[f] = r[f]
        changed = true
      }
    }
    out.push({ ...merged, status: changed ? 'update' : 'same' })
  }
  return {
    rows: out,
    newCount: out.filter((r) => r.status === 'new').length,
    updateCount: out.filter((r) => r.status === 'update').length,
    sameCount: out.filter((r) => r.status === 'same').length,
    duplicates
  }
}
