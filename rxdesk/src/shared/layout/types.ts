// Layout model shared by the Print Format Designer and the print renderer.
// All positions and sizes are in millimetres; font sizes are in points.

// v2: medicines can print the eye/site column.
export const LAYOUT_VERSION = 2

export type PaperPreset = 'A4' | 'A5' | 'Letter' | 'custom'

export const PAPER_SIZES: Record<Exclude<PaperPreset, 'custom'>, { widthMm: number; heightMm: number }> = {
  A4: { widthMm: 210, heightMm: 297 },
  A5: { widthMm: 148, heightMm: 210 },
  Letter: { widthMm: 215.9, heightMm: 279.4 }
}

export type FontFamily = 'Cairo' | 'Noto Naskh Arabic' | 'Amiri' | 'Roboto'
export const FONT_FAMILIES: FontFamily[] = ['Cairo', 'Noto Naskh Arabic', 'Amiri', 'Roboto']

export type TextAlign = 'start' | 'center' | 'end' | 'justify'
export type TextDirection = 'auto' | 'rtl' | 'ltr'
export type PageScope = 'all' | 'first' | 'last'

export interface TextStyle {
  fontFamily: FontFamily
  fontSizePt: number
  bold: boolean
  italic: boolean
  color: string
  align: TextAlign
  direction: TextDirection
  lineHeight: number
}

export type ElementType =
  | 'doctorNameAr'
  | 'doctorNameEn'
  | 'specialtyAr'
  | 'specialtyEn'
  | 'clinicName'
  | 'clinicAddress'
  | 'clinicPhone'
  | 'licenseNumber'
  | 'logo'
  | 'patientName'
  | 'patientAge'
  | 'patientGender'
  | 'patientWeight'
  | 'date'
  | 'diagnosis'
  | 'medicines'
  | 'notes'
  | 'labTests'
  | 'nextVisit'
  | 'signature'
  | 'prescriptionId'
  | 'pageNumber'
  | 'text'
  | 'line'
  | 'rect'
  | 'qr'

export type MedicineColumn =
  | 'number'
  | 'drug'
  | 'dose'
  | 'frequency'
  | 'site'
  | 'duration'
  | 'route'
  | 'instructions'

export const ALL_MEDICINE_COLUMNS: MedicineColumn[] = [
  'number',
  'drug',
  'dose',
  'frequency',
  'site',
  'duration',
  'route',
  'instructions'
]

export interface MedicinesOptions {
  style: 'list' | 'table'
  columns: MedicineColumn[]
  showHeader: boolean
  /** Custom header labels for table columns (empty = default label). */
  headerLabels: Partial<Record<MedicineColumn, string>>
  rowGapMm: number
  /** Print an "Rx" symbol at the start of the block. */
  showRxSymbol: boolean
  drugBold: boolean
  /** Font size used for the second line (dose/instructions) in list style. */
  detailFontSizePt: number
  /** Draw borders in table style. */
  borders: boolean
}

export interface LayoutElement {
  id: string
  type: ElementType
  x: number
  y: number
  w: number
  h: number
  pages: PageScope
  style: TextStyle
  label: { show: boolean; text: string }
  locked?: boolean
  /** Free text content (type 'text'); supports placeholders like {doctorNameAr}. */
  text?: string
  /** Line / rectangle */
  strokeWidthMm?: number
  strokeColor?: string
  fillColor?: string
  radiusMm?: number
  /** Image fit for logo */
  fit?: 'contain' | 'cover'
  medicines?: MedicinesOptions
}

export interface Layout {
  version: number
  paper: { preset: PaperPreset; widthMm: number; heightMm: number }
  marginsMm: { top: number; right: number; bottom: number; left: number }
  /** Printer calibration: shifts everything when printing on real paper. */
  offsetMm: { x: number; y: number }
  background: { dataUrl: string; print: boolean; opacity: number }
  grid: { sizeMm: number; snap: boolean; show: boolean }
  /** Base direction of the page. */
  direction: 'rtl' | 'ltr'
  elements: LayoutElement[]
}

/** Data that fills a layout when rendering. */
export interface PrintData {
  lang: 'ar' | 'en'
  clinic: {
    doctorNameAr: string
    doctorNameEn: string
    specialtyAr: string
    specialtyEn: string
    clinicName: string
    address: string
    phones: string
    licenseNumber: string
    logo: string
  }
  patient: { name: string; ageText: string; gender: string; weight: string }
  rx: {
    id: number | null
    date: string
    diagnosis: string
    notes: string
    labTests: string
    nextVisit: string
    items: {
      drugName: string
      form: string
      strength: string
      dose: string
      frequency: string
      duration: string
      route: string
      instructions: string
      site?: string
    }[]
  }
}
