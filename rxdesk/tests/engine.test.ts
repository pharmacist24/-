import { describe, expect, it } from 'vitest'
import {
  elementValue,
  fontFaceCss,
  isOnPage,
  paginate,
  printDataFromPrescription,
  renderDocument,
  renderElementContent,
  samplePrintData,
  usedFamilies
} from '../src/shared/layout/engine'
import { createElement, normalizeLayout, sampleA4Layout, sampleA5Layout } from '../src/shared/layout/defaults'
import { qrSvg } from '../src/shared/layout/qr'
import { findAllergyMatches, formatAge, normalizeForSearch } from '../src/shared/text'
import type { Prescription } from '../src/shared/types'
import { EMPTY_PROFILE } from '../src/shared/defaults'

const data = samplePrintData({ doctorNameAr: 'د. سامي' }, 'ar')

describe('pagination', () => {
  it('keeps everything on one page when it fits', () => {
    expect(paginate({ itemHeights: [20, 20, 20], headerHeight: 10, gap: 5 }, 200)).toEqual([[0, 1, 2]])
  })

  it('splits across pages respecting the box height', () => {
    // capacity = 100 - 10 + 5 - 0.5 = 94.5; each needs 25 -> 3 per page
    const pages = paginate({ itemHeights: Array(8).fill(20), headerHeight: 10, gap: 5 }, 100)
    expect(pages).toEqual([[0, 1, 2], [3, 4, 5], [6, 7]])
  })

  it('puts an oversized item on its own page instead of looping', () => {
    expect(paginate({ itemHeights: [500, 10], headerHeight: 0, gap: 0 }, 100)).toEqual([[0], [1]])
  })

  it('always returns at least one page', () => {
    expect(paginate({ itemHeights: [], headerHeight: 0, gap: 0 }, 100)).toEqual([[]])
  })
})

describe('document rendering', () => {
  it('renders one page with every element and exact paper size', () => {
    const layout = sampleA5Layout()
    const html = renderDocument(layout, data, { mode: 'final' })
    expect(html).toContain('@page{size:148mm 210mm;margin:0}')
    expect((html.match(/class="rx-page"/g) ?? []).length).toBe(1)
    expect(html).toContain('د. سامي')
    expect(html).toContain('Augmentin')
    expect(html).toContain('محمد عبد الرحمن')
    expect(html).not.toContain('<script')
  })

  it('renders several pages; last-page-only elements appear once', () => {
    const layout = sampleA5Layout()
    const html = renderDocument(layout, data, { mode: 'final', medPages: [[0, 1], [2, 3]] })
    expect((html.match(/class="rx-page"/g) ?? []).length).toBe(2)
    expect((html.match(/rx-el-signature/g) ?? []).length).toBe(1)
    expect((html.match(/rx-el-patientName/g) ?? []).length).toBe(2)
    // medicines continue: each item once overall
    expect((html.match(/data-med="2"/g) ?? []).length).toBe(1)
    expect(html.indexOf('data-med="1"')).toBeLessThan(html.indexOf('data-med="2"'))
  })

  it('page scope rules', () => {
    const el = createElement('notes')
    expect(el.pages).toBe('last')
    expect(isOnPage(el, 1, 2)).toBe(false)
    expect(isOnPage(el, 2, 2)).toBe(true)
    expect(isOnPage({ ...el, pages: 'first' }, 2, 2)).toBe(false)
    expect(isOnPage(createElement('medicines', { pages: 'first' }), 2, 2)).toBe(true)
  })

  it('measure mode renders only the medicines block at natural height', () => {
    const html = renderDocument(sampleA4Layout(), data, { mode: 'measure' })
    expect(html).toContain('id="rx-measure"')
    expect(html).toContain('height:auto')
    expect(html).not.toContain('rx-el-patientName')
    expect((html.match(/<tr data-med=/g) ?? []).length).toBe(data.rx.items.length)
  })

  it('applies printer offset only when asked', () => {
    const layout = { ...sampleA5Layout(), offsetMm: { x: 1.5, y: -2 } }
    expect(renderDocument(layout, data, { mode: 'final' })).not.toContain('translate(')
    expect(renderDocument(layout, data, { mode: 'final', applyOffset: true })).toContain('translate(1.5mm,-2mm)')
  })

  it('prints the background only when enabled', () => {
    const bg = { dataUrl: 'data:image/png;base64,AAAA', print: false, opacity: 1 }
    const layout = { ...sampleA5Layout(), background: bg }
    expect(renderDocument(layout, data, { mode: 'final' })).not.toContain('class="rx-bg"')
    expect(renderDocument({ ...layout, background: { ...bg, print: true } }, data, { mode: 'final' })).toContain('class="rx-bg"')
  })

  it('escapes user text (no HTML injection)', () => {
    const evil = { ...data, patient: { ...data.patient, name: '<img src=x onerror=alert(1)>' } }
    const html = renderDocument(sampleA5Layout(), evil, { mode: 'final' })
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;img src=x')
  })

  it('handles mixed RTL/LTR: drug lines are LTR, instructions use auto direction', () => {
    const el = sampleA5Layout().elements.find((e) => e.type === 'medicines')!
    const html = renderElementContent(el, data, { page: 1, pages: 1, medIndexes: [0] })
    expect(html).toContain('class="rx-med-line1" dir="ltr"')
    expect(html).toContain('class="rx-med-line2" dir="auto"')
    expect(html).toContain('<bdi>بعد الأكل</bdi>')
  })

  it('table style uses fixed column widths summing to 100%', () => {
    const el = sampleA4Layout().elements.find((e) => e.type === 'medicines')!
    const html = renderElementContent(el, data, { page: 1, pages: 1, medIndexes: [0, 1] })
    const widths = [...html.matchAll(/<col style="width:([\d.]+)%">/g)].map((m) => Number(m[1]))
    expect(widths.length).toBe(el.medicines!.columns.length)
    expect(Math.round(widths.reduce((a, b) => a + b, 0))).toBe(100)
    expect(html).toContain('<th dir="auto">الدواء</th>')
  })

  it('table drops columns that are empty for every medicine', () => {
    const el = sampleA4Layout().elements.find((e) => e.type === 'medicines')!
    const simple = { ...data, rx: { ...data.rx, items: data.rx.items.map((i) => ({ ...i, frequency: '', duration: '', instructions: '' })) } }
    const html = renderElementContent(el, simple, { page: 1, pages: 1, medIndexes: [0, 1] })
    expect((html.match(/<col /g) ?? []).length).toBe(3) // #, drug, dose
    expect(html).not.toContain('عدد المرات')
  })

  it('hides empty prescription fields but keeps patient labels', () => {
    const empty = { ...data, rx: { ...data.rx, labTests: '', diagnosis: '' }, patient: { ...data.patient, weight: '' } }
    expect(renderElementContent(createElement('labTests'), empty, { page: 1, pages: 1, medIndexes: [] })).toBe('')
    expect(renderElementContent(createElement('patientWeight'), empty, { page: 1, pages: 1, medIndexes: [] })).toContain('الوزن')
  })

  it('free text placeholders', () => {
    const el = createElement('text', { text: 'Dr: {doctorNameAr} <b>' })
    const html = renderElementContent(el, data, { page: 1, pages: 1, medIndexes: [] })
    expect(html).toContain('Dr: د. سامي &lt;b&gt;')
  })

  it('page numbers and QR code', () => {
    expect(elementValue(createElement('pageNumber'), data, 2, 3)).toBe('2 / 3')
    const svg = qrSvg('RxDesk Rx#1')
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).toContain('<path')
  })

  it('embeds only fonts used by the layout (Cairo always)', () => {
    const fonts = [
      { family: 'Cairo', weight: 400, style: 'normal', range: 'U+0600-06FF', url: 'data:font/woff2;base64,AA' },
      { family: 'Amiri', weight: 400, style: 'normal', range: 'U+0600-06FF', url: 'data:font/woff2;base64,BB' }
    ]
    const css = fontFaceCss(fonts, usedFamilies(sampleA5Layout()))
    expect(css).toContain("'Cairo'")
    expect(css).not.toContain("'Amiri'")
  })
})

describe('layout normalisation', () => {
  it('repairs bad or partial layouts', () => {
    const l = normalizeLayout({
      paper: { preset: 'custom', widthMm: 'abc', heightMm: 99999 },
      elements: [
        { type: 'unknown' },
        { type: 'patientName', x: '12', style: { fontFamily: 'Comic Sans', fontSizePt: 500 } },
        { type: 'medicines', medicines: { columns: ['dose', 'bogus'] } }
      ]
    })
    expect(l.paper.widthMm).toBe(148)
    expect(l.paper.heightMm).toBe(2000)
    expect(l.elements.length).toBe(2)
    expect(l.elements[0].x).toBe(12)
    expect(l.elements[0].style.fontFamily).toBe('Cairo')
    expect(l.elements[0].style.fontSizePt).toBe(96)
    expect(l.elements[1].medicines!.columns).toEqual(['drug', 'dose'])
  })

  it('sample layouts survive a JSON round trip unchanged', () => {
    for (const l of [sampleA4Layout(), sampleA5Layout()]) {
      expect(normalizeLayout(JSON.parse(JSON.stringify(l)))).toEqual(l)
    }
  })

  it('every sample element stays inside the page', () => {
    for (const l of [sampleA4Layout(), sampleA5Layout()]) {
      for (const e of l.elements) {
        expect(e.x).toBeGreaterThanOrEqual(0)
        expect(e.y).toBeGreaterThanOrEqual(0)
        expect(e.x + e.w).toBeLessThanOrEqual(l.paper.widthMm + 0.01)
        expect(e.y + e.h).toBeLessThanOrEqual(l.paper.heightMm + 0.01)
      }
    }
  })
})

describe('print data', () => {
  it('builds print data from a saved prescription', () => {
    const rx: Prescription = {
      id: 7,
      patientId: 1,
      date: '2026-03-01',
      diagnosis: 'Dx',
      notes: '',
      nextVisit: '2026-03-08',
      labTests: '',
      items: [{ drugName: 'A', form: '', strength: '', dose: '', frequency: '', duration: '', route: '', instructions: '' }],
      patient: { name: 'P', ageText: '30 سنة', gender: 'female', weight: '60 kg' },
      createdAt: '',
      updatedAt: ''
    }
    const d = printDataFromPrescription(rx, { ...EMPTY_PROFILE, doctorNameAr: 'د' }, 'ar')
    expect(d.patient.gender).toBe('أنثى')
    expect(elementValue(createElement('nextVisit'), d)).toBe('08/03/2026')
    expect(elementValue(createElement('date'), d)).toBe('01/03/2026')
  })
})

describe('text helpers', () => {
  it('normalises Arabic for search', () => {
    expect(normalizeForSearch('أحمد')).toBe(normalizeForSearch('احمد'))
    expect(normalizeForSearch('فاطمة')).toBe('فاطمه')
    expect(normalizeForSearch('٠١٢٣')).toBe('0123')
    expect(normalizeForSearch('مُحَمَّد')).toBe('محمد')
  })

  it('formats ages', () => {
    const on = new Date(2026, 5, 15)
    expect(formatAge('1990-01-01', 'en', on)).toBe('36 years')
    expect(formatAge('2026-01-10', 'en', on)).toBe('5 months')
    expect(formatAge('2026-06-10', 'ar', on)).toBe('5 يوم')
    expect(formatAge('', 'ar', on)).toBe('')
  })

  it('finds allergy matches including drug classes', () => {
    expect(findAllergyMatches('Augmentin', 'Penicillin')).toEqual(['Penicillin'])
    expect(findAllergyMatches('Amoxicillin 500', 'بنسلين')).toEqual(['بنسلين'])
    expect(findAllergyMatches('Ibuprofen', 'aspirin, dust')).toEqual(['aspirin'])
    expect(findAllergyMatches('Septrin', 'Sulfa')).toEqual(['Sulfa'])
    expect(findAllergyMatches('Paracetamol', 'Penicillin, Sulfa')).toEqual([])
    expect(findAllergyMatches('Cetirizine', '')).toEqual([])
  })
})
