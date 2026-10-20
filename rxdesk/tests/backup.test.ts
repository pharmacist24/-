import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { openDatabase } from '../src/main/db/database'
import type { Repo } from '../src/main/db/repo'
import { seedSamplePatients } from '../src/main/db/seed'
import { AUTO_PREFIX, createBackup, listAutoBackups, prepareRestore, pruneAutoBackups } from '../src/main/services/backup'
import { hashPin, isValidPin, PinThrottle, verifyPin } from '../src/main/services/pin'
import { toCsv } from '../src/main/services/csv'

let dir: string
let repo: Repo

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rxdesk-bk-'))
  repo = openDatabase(path.join(dir, 'live.db')).repo
  seedSamplePatients(repo)
})

afterEach(() => {
  repo.db.close()
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('backup & restore', () => {
  it('creates a zip backup that restores with the same data', async () => {
    const zip = path.join(dir, 'out', 'b.zip')
    const info = await createBackup(repo, zip, '1.0.0')
    expect(fs.existsSync(zip)).toBe(true)
    expect(info.sizeBytes).toBeGreaterThan(1000)
    const prepared = await prepareRestore(zip, path.join(dir, 'work'))
    expect(prepared.patients).toBe(3)
    expect(prepared.prescriptions).toBe(3)
    const restored = openDatabase(prepared.dbPath).repo
    expect(restored.searchPatients('').length).toBe(3)
    restored.db.close()
  })

  it('accepts a raw .db file', async () => {
    const raw = path.join(dir, 'copy.db')
    await repo.db.backup(raw)
    expect((await prepareRestore(raw, path.join(dir, 'work'))).patients).toBe(3)
  })

  it('rejects files that are not RxDesk backups', async () => {
    const bad = path.join(dir, 'bad.zip')
    fs.writeFileSync(bad, 'hello')
    await expect(prepareRestore(bad, path.join(dir, 'work'))).rejects.toThrow()
    const JSZip = (await import('jszip')).default
    const z = new JSZip()
    z.file('other.txt', 'x')
    fs.writeFileSync(bad, await z.generateAsync({ type: 'nodebuffer' }))
    await expect(prepareRestore(bad, path.join(dir, 'work'))).rejects.toThrow(/not an RxDesk backup/)
  })

  it('keeps only the newest automatic backups and never touches other files', () => {
    const folder = path.join(dir, 'auto')
    fs.mkdirSync(folder)
    for (let d = 1; d <= 20; d++) fs.writeFileSync(path.join(folder, `${AUTO_PREFIX}2026-01-${String(d).padStart(2, '0')}_0900.zip`), 'x')
    fs.writeFileSync(path.join(folder, 'my-notes.zip'), 'keep me')
    const removed = pruneAutoBackups(folder, 14)
    expect(removed.length).toBe(6)
    const left = listAutoBackups(folder)
    expect(left.length).toBe(14)
    expect(path.basename(left[0].path)).toContain('2026-01-20')
    expect(fs.existsSync(path.join(folder, 'my-notes.zip'))).toBe(true)
  })
})

describe('pin', () => {
  it('hashes and verifies', () => {
    const h = hashPin('1234')
    expect(h).not.toContain('1234')
    expect(verifyPin('1234', h)).toBe(true)
    expect(verifyPin('4321', h)).toBe(false)
    expect(verifyPin('1234', '')).toBe(false)
    expect(isValidPin('12')).toBe(false)
    expect(isValidPin('123456')).toBe(true)
  })

  it('throttles after 5 failures', () => {
    const th = new PinThrottle()
    for (let i = 0; i < 5; i++) th.fail(1000)
    expect(th.check(1000)).toBe(30000)
    expect(th.check(40000)).toBe(0)
  })
})

describe('csv', () => {
  it('writes an Excel-friendly UTF-8 CSV', () => {
    const csv = toCsv(['Name', 'Note'], [{ a: 'أحمد', b: 'x, "y"' }, { a: '=cmd()', b: '+201001234567' }], ['a', 'b'])
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv).toContain('أحمد,"x, ""y"""')
    expect(csv).toContain("'=cmd()")
    expect(csv).toContain(',+201001234567')
  })
})
