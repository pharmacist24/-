import fs from 'fs'
import path from 'path'
import type { DrugInput } from '@shared/types'
import { drugsXlsxBytes, readDrugBytes, type ReadResult } from '@shared/drugsSheet'

// File helpers for the desktop app; the sheet logic itself lives in @shared/drugsSheet.
export * from '@shared/drugsSheet'

export async function readDrugFile(file: string): Promise<ReadResult> {
  return readDrugBytes(fs.readFileSync(file), path.basename(file))
}

export async function writeDrugsXlsx(drugs: (DrugInput & { useCount?: number })[], file: string, opts: { withUseCount?: boolean } = {}): Promise<void> {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, await drugsXlsxBytes(drugs, opts))
}
