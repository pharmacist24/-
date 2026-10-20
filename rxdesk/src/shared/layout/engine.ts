// The layout engine: turns a Layout + PrintData into HTML.
//
// It is used by BOTH the Print Format Designer (element by element) and the
// print/preview/PDF pipeline (whole document), so what the doctor designs is
// exactly what prints. All geometry is in millimetres, fonts in points.

import { escapeHtml, formatDate, genderText } from '../text'
import type { Prescription, ClinicProfile } from '../types'
import type { FontFamily, Layout, LayoutElement, MedicineColumn, MedicinesOptions, PrintData } from './types'
import { qrSvg } from './qr'

export const PX_PER_MM = 96 / 25.4

export interface EmbeddedFontFace {
  family: string
  weight: number
  style: string
  range: string
  url: string
}

export interface RenderOptions {
  /** 'measure' renders only the medicines block at natural height so items can be measured. */
  mode: 'final' | 'measure'
  /** Item indexes for each page of the medicines block (final mode). Default: all on one page. */
  medPages?: number[][]
  /** Apply the printer calibration offset (only for real printing, not preview/PDF). */
  applyOffset?: boolean
  fonts?: EmbeddedFontFace[]
  title?: string
}

const n = (v: number) => Math.round(v * 1000) / 1000

/** Font stack: the chosen font, then bundled fallbacks for Arabic/Latin glyphs. */
export function fontStack(f: FontFamily): string {
  const stack = [f, 'Cairo', 'Roboto'].filter((x, i, a) => a.indexOf(x) === i)
  return stack.map((x) => `'${x}'`).join(', ') + ', sans-serif'
}

/** Inline style (position, size, font) of an element: shared by designer and print. */
export function elementStyle(el: LayoutElement): string {
  const s = el.style
  return [
    `left:${n(el.x)}mm`,
    `top:${n(el.y)}mm`,
    `width:${n(el.w)}mm`,
    `height:${n(el.h)}mm`,
    `font-family:${fontStack(s.fontFamily)}`,
    `font-size:${n(s.fontSizePt)}pt`,
    `font-weight:${s.bold ? 700 : 400}`,
    `font-style:${s.italic ? 'italic' : 'normal'}`,
    `color:${safeColor(s.color)}`,
    `text-align:${s.align}`,
    `line-height:${n(s.lineHeight)}`
  ].join(';')
}

function safeColor(c: string | undefined, fallback = '#111111'): string {
  if (!c) return fallback
  return /^(#[0-9a-f]{3,8}|transparent|rgba?\([\d\s.,%]+\))$/i.test(c.trim()) ? c.trim() : fallback
}

export function dirAttr(el: LayoutElement): string {
  return el.style.direction === 'auto' ? 'auto' : el.style.direction
}

// ------------------------------------------------------------------ data helpers

export function printDataFromPrescription(rx: Prescription, profile: ClinicProfile, lang: 'ar' | 'en'): PrintData {
  return {
    lang,
    clinic: { ...profile },
    patient: {
      name: rx.patient.name,
      ageText: rx.patient.ageText,
      gender: genderText(rx.patient.gender, lang),
      weight: rx.patient.weight
    },
    rx: {
      id: rx.id,
      date: rx.date,
      diagnosis: rx.diagnosis,
      notes: rx.notes,
      labTests: rx.labTests,
      nextVisit: rx.nextVisit,
      items: rx.items
    }
  }
}

/** Realistic sample used by the designer and the "Print test page" button. */
export function samplePrintData(profile: Partial<ClinicProfile>, lang: 'ar' | 'en', manyItems = false): PrintData {
  const items = [
    { drugName: 'Augmentin', form: 'Tab', strength: '1 g', dose: '1 tablet', frequency: 'every 12 hours', duration: '7 days', route: 'Oral', instructions: 'بعد الأكل' },
    { drugName: 'Paracetamol', form: 'Tab', strength: '500 mg', dose: '1-2 tablets', frequency: 'every 6 hours when needed', duration: '5 days', route: 'Oral', instructions: 'عند ارتفاع الحرارة' },
    { drugName: 'Otrivin', form: 'Nasal drops', strength: '0.05%', dose: '2 drops', frequency: 'three times daily', duration: '5 days', route: 'Nasal', instructions: '' },
    { drugName: 'Vitamin C', form: 'Eff. tab', strength: '1000 mg', dose: '1 tablet', frequency: 'once daily', duration: '14 days', route: 'Oral', instructions: 'يذاب في نصف كوب ماء' }
  ]
  const all = manyItems ? [...items, ...items, ...items, ...items].map((it, i) => ({ ...it, drugName: `${it.drugName}${i >= 4 ? ' ' + (Math.floor(i / 4) + 1) : ''}` })) : items
  return {
    lang,
    clinic: {
      doctorNameAr: profile.doctorNameAr || 'د. أحمد محمود',
      doctorNameEn: profile.doctorNameEn || 'Dr. Ahmed Mahmoud',
      specialtyAr: profile.specialtyAr || 'استشاري الباطنة العامة',
      specialtyEn: profile.specialtyEn || 'Consultant of Internal Medicine',
      clinicName: profile.clinicName || 'عيادة الشفاء',
      address: profile.address || '15 شارع التحرير، الدقي، الجيزة',
      phones: profile.phones || '01001234567 - 0233334444',
      licenseNumber: profile.licenseNumber || '12345',
      logo: profile.logo || ''
    },
    patient: {
      name: lang === 'ar' ? 'محمد عبد الرحمن' : 'Mohamed Abdelrahman',
      ageText: lang === 'ar' ? '42 سنة' : '42 years',
      gender: genderText('male', lang),
      weight: '78 kg'
    },
    rx: {
      id: 1024,
      date: new Date().toISOString().slice(0, 10),
      diagnosis: 'Acute sinusitis',
      notes: 'استنشاق بخار ماء دافئ مرتين يومياً\nالإكثار من السوائل الدافئة',
      labTests: 'CBC, CRP',
      nextVisit: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      items: all
    }
  }
}

function placeholders(text: string, d: PrintData): string {
  const map: Record<string, string> = {
    doctorNameAr: d.clinic.doctorNameAr,
    doctorNameEn: d.clinic.doctorNameEn,
    specialtyAr: d.clinic.specialtyAr,
    specialtyEn: d.clinic.specialtyEn,
    clinicName: d.clinic.clinicName,
    address: d.clinic.address,
    phones: d.clinic.phones,
    licenseNumber: d.clinic.licenseNumber,
    patientName: d.patient.name,
    date: formatDate(d.rx.date, d.lang),
    rxId: d.rx.id ? String(d.rx.id) : ''
  }
  return escapeHtml(text).replace(/\{(\w+)\}/g, (m, k) => (k in map ? escapeHtml(map[k]) : m))
}

/** Plain value of a data element ('' if there is nothing to show). */
export function elementValue(el: LayoutElement, d: PrintData, page = 1, pages = 1): string {
  switch (el.type) {
    case 'doctorNameAr': return d.clinic.doctorNameAr
    case 'doctorNameEn': return d.clinic.doctorNameEn
    case 'specialtyAr': return d.clinic.specialtyAr
    case 'specialtyEn': return d.clinic.specialtyEn
    case 'clinicName': return d.clinic.clinicName
    case 'clinicAddress': return d.clinic.address
    case 'clinicPhone': return d.clinic.phones
    case 'licenseNumber': return d.clinic.licenseNumber
    case 'patientName': return d.patient.name
    case 'patientAge': return d.patient.ageText
    case 'patientGender': return d.patient.gender
    case 'patientWeight': return d.patient.weight
    case 'date': return formatDate(d.rx.date, d.lang)
    case 'diagnosis': return d.rx.diagnosis
    case 'notes': return d.rx.notes
    case 'labTests': return d.rx.labTests
    case 'nextVisit': return formatDate(d.rx.nextVisit, d.lang)
    case 'prescriptionId': return d.rx.id ? String(d.rx.id) : ''
    case 'pageNumber': return `${page} / ${pages}`
    default: return ''
  }
}

/** Elements about the prescription content are hidden when empty (no lonely labels). */
const HIDE_WHEN_EMPTY = new Set(['diagnosis', 'notes', 'labTests', 'nextVisit', 'prescriptionId', 'clinicAddress', 'clinicPhone', 'licenseNumber', 'clinicName', 'specialtyAr', 'specialtyEn', 'doctorNameAr', 'doctorNameEn'])
const MULTILINE = new Set(['notes', 'labTests', 'diagnosis', 'clinicAddress', 'text'])

// ------------------------------------------------------------------ medicines

const COLUMN_WIDTH: Record<MedicineColumn, number> = {
  number: 5,
  drug: 30,
  dose: 15,
  frequency: 17,
  duration: 11,
  route: 9,
  instructions: 20
}

const COLUMN_LABEL: Record<'ar' | 'en', Record<MedicineColumn, string>> = {
  en: { number: '#', drug: 'Medicine', dose: 'Dose', frequency: 'Frequency', duration: 'Duration', route: 'Route', instructions: 'Instructions' },
  ar: { number: '#', drug: 'الدواء', dose: 'الجرعة', frequency: 'عدد المرات', duration: 'المدة', route: 'الطريقة', instructions: 'تعليمات' }
}

export function columnLabel(m: MedicinesOptions, c: MedicineColumn, lang: 'ar' | 'en'): string {
  return m.headerLabels?.[c]?.trim() || COLUMN_LABEL[lang][c]
}

type Item = PrintData['rx']['items'][number]

function drugLine(it: Item, m: MedicinesOptions): string {
  const name = `<span class="rx-drug-name"${m.drugBold ? ' style="font-weight:700"' : ''}>${escapeHtml(it.drugName)}</span>`
  const extra = [it.strength, it.form].filter(Boolean).map(escapeHtml).join(' ')
  return extra ? `${name} <span class="rx-drug-extra">${extra}</span>` : name
}

function detailParts(it: Item, cols: MedicineColumn[]): string[] {
  const map: Partial<Record<MedicineColumn, string>> = {
    dose: it.dose,
    frequency: it.frequency,
    duration: it.duration,
    route: it.route,
    instructions: it.instructions
  }
  return cols.filter((c) => c in map && map[c]).map((c) => `<bdi>${escapeHtml(map[c]!)}</bdi>`)
}

function rxSymbol(): string {
  return '<div class="rx-symbol" dir="ltr">R<span>x</span></div>'
}

function medicinesList(el: LayoutElement, d: PrintData, indexes: number[]): string {
  const m = el.medicines!
  const numbered = m.columns.includes('number')
  const rows = indexes.map((i) => {
    const it = d.rx.items[i]
    const parts = detailParts(it, m.columns)
    const line2 = parts.length
      ? `<div class="rx-med-line2" dir="auto" style="font-size:${n(m.detailFontSizePt)}pt">${parts.join(' <span class="rx-sep">—</span> ')}</div>`
      : ''
    return `<div class="rx-med-item" data-med="${i}" style="margin-bottom:${n(m.rowGapMm)}mm"><div class="rx-med-line1" dir="ltr">${numbered ? `<span class="rx-med-num">${i + 1}.</span>` : ''}${drugLine(it, m)}</div>${line2}</div>`
  })
  return `<div class="rx-med-list${numbered ? ' rx-numbered' : ''}">${rows.join('')}</div>`
}

function medicinesTable(el: LayoutElement, d: PrintData, indexes: number[]): string {
  const m = el.medicines!
  const cols = m.columns
  const total = cols.reduce((s, c) => s + COLUMN_WIDTH[c], 0)
  const colgroup = cols.map((c) => `<col style="width:${n((COLUMN_WIDTH[c] / total) * 100)}%">`).join('')
  const head = m.showHeader
    ? `<thead><tr>${cols.map((c) => `<th dir="auto">${escapeHtml(columnLabel(m, c, d.lang))}</th>`).join('')}</tr></thead>`
    : ''
  const cell = (it: Item, i: number, c: MedicineColumn): string => {
    switch (c) {
      case 'number': return `<td class="rx-c-num">${i + 1}</td>`
      case 'drug': return `<td dir="ltr" class="rx-c-drug">${drugLine(it, m)}</td>`
      default: return `<td dir="auto" style="font-size:${n(m.detailFontSizePt)}pt">${escapeHtml(it[c] ?? '')}</td>`
    }
  }
  const body = indexes.map((i) => `<tr data-med="${i}">${cols.map((c) => cell(d.rx.items[i], i, c)).join('')}</tr>`).join('')
  const pad = n(m.rowGapMm / 2)
  return `<table class="rx-med-table${m.borders ? ' rx-borders' : ''}" style="--rx-pad:${pad}mm"><colgroup>${colgroup}</colgroup>${head}<tbody>${body}</tbody></table>`
}

export function medicinesHtml(el: LayoutElement, d: PrintData, indexes: number[]): string {
  const m = el.medicines!
  const inner = m.style === 'table' ? medicinesTable(el, d, indexes) : medicinesList(el, d, indexes)
  return (m.showRxSymbol ? rxSymbol() : '') + inner
}

// ------------------------------------------------------------------ elements

export interface ElementContext {
  page: number
  pages: number
  /** Item indexes of the medicines block on this page. */
  medIndexes: number[]
  /** In the designer, show placeholders for empty images. */
  designer?: boolean
}

/** Inner HTML of one element (without its positioned wrapper). */
export function renderElementContent(el: LayoutElement, d: PrintData, ctx: ElementContext): string {
  const labelHtml = () => (el.label.show && el.label.text ? `<span class="rx-label">${escapeHtml(el.label.text)}</span> ` : '')
  switch (el.type) {
    case 'medicines':
      return medicinesHtml(el, d, ctx.medIndexes)
    case 'logo':
      if (!d.clinic.logo) return ctx.designer ? '<div class="rx-placeholder">LOGO</div>' : ''
      return `<img class="rx-img" src="${escapeHtml(d.clinic.logo)}" style="object-fit:${el.fit === 'cover' ? 'cover' : 'contain'}" alt="">`
    case 'line': {
      const horizontal = el.w >= el.h
      const sw = n(el.strokeWidthMm ?? 0.4)
      const color = safeColor(el.strokeColor, '#333333')
      return horizontal
        ? `<div class="rx-line" style="top:50%;left:0;right:0;height:${sw}mm;margin-top:-${n(sw / 2)}mm;background:${color}"></div>`
        : `<div class="rx-line" style="left:50%;top:0;bottom:0;width:${sw}mm;margin-left:-${n(sw / 2)}mm;background:${color}"></div>`
    }
    case 'rect':
      return `<div class="rx-rect" style="border:${n(el.strokeWidthMm ?? 0.3)}mm solid ${safeColor(el.strokeColor, '#333333')};background:${safeColor(el.fillColor, 'transparent')};border-radius:${n(el.radiusMm ?? 0)}mm"></div>`
    case 'qr': {
      const id = d.rx.id ?? 0
      const text = `RxDesk Rx#${id} | ${d.rx.date} | ${d.patient.name} | ${d.clinic.doctorNameEn || d.clinic.doctorNameAr}`
      return `<div class="rx-qr">${qrSvg(text, safeColor(el.style.color, '#000000'))}</div>`
    }
    case 'signature':
      return `<div class="rx-sig"><div class="rx-sig-line"></div>${el.label.show ? `<div class="rx-sig-label">${escapeHtml(el.label.text)}</div>` : ''}</div>`
    case 'text':
      return `<span class="rx-pre">${placeholders(el.text ?? '', d)}</span>`
    default: {
      const value = elementValue(el, d, ctx.page, ctx.pages)
      if (!value && HIDE_WHEN_EMPTY.has(el.type)) return ''
      const cls = MULTILINE.has(el.type) ? 'rx-val rx-pre' : 'rx-val'
      return `${labelHtml()}<bdi class="${cls}">${escapeHtml(value)}</bdi>`
    }
  }
}

export function isOnPage(el: LayoutElement, page: number, pages: number): boolean {
  if (el.type === 'medicines') return true
  if (el.pages === 'first') return page === 1
  if (el.pages === 'last') return page === pages
  return true
}

/** Positioned wrapper + content for one element. */
export function renderElement(el: LayoutElement, d: PrintData, ctx: ElementContext): string {
  const content = renderElementContent(el, d, ctx)
  if (!content) return ''
  return `<div class="rx-el rx-el-${el.type}" dir="${dirAttr(el)}" style="${elementStyle(el)}">${content}</div>`
}

// ------------------------------------------------------------------ document

export function usedFamilies(layout: Layout): Set<string> {
  const s = new Set<string>(['Cairo'])
  for (const el of layout.elements) s.add(el.style.fontFamily)
  return s
}

export function fontFaceCss(fonts: EmbeddedFontFace[] | undefined, families: Set<string>): string {
  return (fonts ?? [])
    .filter((f) => families.has(f.family))
    .map(
      (f) =>
        `@font-face{font-family:'${f.family}';font-style:${f.style};font-weight:${f.weight};font-display:block;src:url(${f.url}) format('woff2');unicode-range:${f.range}}`
    )
    .join('\n')
}

/** Stylesheet shared by the designer canvas and printed documents. */
export const LAYOUT_CSS = `
.rx-page{position:relative;overflow:hidden;background:#fff;color:#111}
.rx-page *{box-sizing:border-box}
.rx-page-inner{position:absolute;left:0;top:0;width:100%;height:100%}
.rx-bg{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:fill;pointer-events:none;user-select:none}
.rx-el{position:absolute;overflow:visible;overflow-wrap:break-word;margin:0;padding:0}
.rx-label{opacity:.8;font-weight:inherit}
.rx-val{unicode-bidi:isolate}
.rx-pre{white-space:pre-wrap;unicode-bidi:plaintext}
.rx-el-text{white-space:pre-wrap}
.rx-img{display:block;width:100%;height:100%}
.rx-line{position:absolute}
.rx-rect{position:absolute;left:0;top:0;width:100%;height:100%}
.rx-qr{width:100%;height:100%}
.rx-qr svg{display:block}
.rx-sig{display:flex;flex-direction:column;justify-content:flex-end;height:100%}
.rx-sig-line{border-top:0.3mm solid currentColor;margin:0 4%}
.rx-sig-label{text-align:center;margin-top:0.8mm}
.rx-placeholder{width:100%;height:100%;display:flex;align-items:center;justify-content:center;border:0.3mm dashed #aab;color:#99a;font:600 8pt Roboto,sans-serif}
.rx-symbol{font-family:'Roboto',serif;font-weight:700;font-style:italic;font-size:1.9em;line-height:1;margin-bottom:1.2mm;text-align:left}
.rx-symbol span{font-size:.62em;margin-left:-.05em;vertical-align:-.25em}
.rx-med-item{break-inside:avoid}
.rx-med-line1{text-align:left}
.rx-numbered .rx-med-line2{padding-left:1.6em}
.rx-numbered .rx-med-num{display:inline-block;min-width:1.6em}
.rx-med-line2{unicode-bidi:plaintext;opacity:.92;margin-top:.3mm}
.rx-med-line2[dir=auto]{text-align:start}
.rx-sep{opacity:.5}
.rx-med-table{width:100%;border-collapse:collapse;table-layout:fixed}
.rx-med-table th,.rx-med-table td{padding:var(--rx-pad,1mm) 1.2mm;vertical-align:top;text-align:start;overflow-wrap:break-word}
.rx-med-table th{font-weight:700;font-size:.9em;background:rgba(0,0,0,.05)}
.rx-med-table.rx-borders th,.rx-med-table.rx-borders td{border:0.25mm solid #999}
.rx-c-num{text-align:center!important}
.rx-c-drug{text-align:left!important}
`

function pageCss(layout: Layout): string {
  const { widthMm: w, heightMm: h } = layout.paper
  return `
@page{size:${n(w)}mm ${n(h)}mm;margin:0}
html,body{margin:0;padding:0;background:#fff}
body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
.rx-page{width:${n(w)}mm;height:${n(h)}mm;page-break-after:always;break-after:page}
.rx-page:last-child{page-break-after:auto;break-after:auto}
@media screen{
  html,body{background:#d5dae1}
  body{padding:6mm 0}
  .rx-page{margin:0 auto 6mm;box-shadow:0 0.5mm 3mm rgba(0,0,0,.25)}
}`
}

/** Renders one page (inner HTML of .rx-page). */
export function renderPage(layout: Layout, d: PrintData, page: number, pages: number, medIndexes: number[], opts: { applyOffset?: boolean; background?: boolean } = {}): string {
  const bg =
    layout.background.dataUrl && (opts.background ?? layout.background.print)
      ? `<img class="rx-bg" src="${escapeHtml(layout.background.dataUrl)}" style="opacity:${n(layout.background.opacity)}" alt="">`
      : ''
  const els = layout.elements
    .filter((el) => isOnPage(el, page, pages))
    .map((el) => renderElement(el, d, { page, pages, medIndexes }))
    .join('')
  const off = opts.applyOffset && (layout.offsetMm.x || layout.offsetMm.y) ? ` style="transform:translate(${n(layout.offsetMm.x)}mm,${n(layout.offsetMm.y)}mm)"` : ''
  return `<div class="rx-page-inner"${off}>${bg}${els}</div>`
}

function htmlShell(layout: Layout, body: string, opts: RenderOptions): string {
  const css = fontFaceCss(opts.fonts, usedFamilies(layout)) + LAYOUT_CSS + pageCss(layout)
  return `<!doctype html><html lang="ar"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:"><title>${escapeHtml(opts.title ?? 'RxDesk')}</title><style>${css}</style></head><body>${body}</body></html>`
}

/** Full HTML document. In 'measure' mode only the medicines block is rendered, at natural height. */
export function renderDocument(layout: Layout, d: PrintData, opts: RenderOptions): string {
  const med = layout.elements.find((e) => e.type === 'medicines')
  const all = d.rx.items.map((_, i) => i)
  if (opts.mode === 'measure') {
    if (!med) return htmlShell(layout, '', opts)
    const style = elementStyle(med).replace(/height:[^;]+/, 'height:auto').replace(/top:[^;]+/, 'top:0').replace(/left:[^;]+/, 'left:0')
    const body = `<div class="rx-page" style="height:auto;overflow:visible"><div class="rx-el rx-el-medicines" id="rx-measure" dir="${dirAttr(med)}" style="${style}">${medicinesHtml(med, d, all)}</div></div>`
    return htmlShell(layout, body, opts)
  }
  const medPages = opts.medPages && opts.medPages.length ? opts.medPages : [all]
  const pages = medPages.length
  const body = medPages
    .map((idx, p) => `<div class="rx-page">${renderPage(layout, d, p + 1, pages, idx, { applyOffset: opts.applyOffset })}</div>`)
    .join('')
  return htmlShell(layout, body, opts)
}

// ------------------------------------------------------------------ pagination

export interface MedicineMeasurements {
  /** Outer height (px) of each item/row, in order. */
  itemHeights: number[]
  /** Height (px) of things repeated at the top of the block on every page (Rx symbol, table header). */
  headerHeight: number
  /** Gap after each item (px). */
  gap: number
}

/**
 * Splits medicines into pages so each page's block fits the box height.
 * Every page gets at least one item, so an over-sized item never loops forever.
 */
export function paginate(m: MedicineMeasurements, boxHeightPx: number): number[][] {
  const capacity = Math.max(1, boxHeightPx - m.headerHeight + m.gap - 0.5)
  const pages: number[][] = []
  let cur: number[] = []
  let used = 0
  m.itemHeights.forEach((h, i) => {
    const need = h + m.gap
    if (cur.length && used + need > capacity) {
      pages.push(cur)
      cur = []
      used = 0
    }
    cur.push(i)
    used += need
  })
  if (cur.length || pages.length === 0) pages.push(cur)
  return pages
}
