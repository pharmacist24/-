import { describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { uniqueOptions } from '../src/renderer/src/lib/options'
import { migrations } from '../src/main/db/migrations'

describe('dropdown choices', () => {
  it('drops blanks and duplicates (Mantine refuses duplicate options)', () => {
    expect(uniqueOptions(['1 tablet twice daily after food', '1 tablet twice daily after food', ' ', '', null, 'قرص  ', 'قرص'])).toEqual([
      '1 tablet twice daily after food',
      'قرص'
    ])
  })
})

describe('migration v5', () => {
  it('removes duplicate dose phrases and logs them for online deletion', () => {
    const db = new Database(':memory:')
    for (const m of migrations.filter((m) => m.version <= 4)) {
      m.up(db)
      db.pragma(`user_version = ${m.version}`)
    }
    const ins = db.prepare('INSERT INTO dose_phrases(text, position) VALUES(?, ?)')
    ins.run('1 tablet twice daily after food', 1)
    ins.run('1 tablet twice daily after food', 2)
    ins.run('1 tablet twice daily after food ', 3)
    ins.run('مرة يومياً', 4)
    migrations.find((m) => m.version === 5)!.up(db)
    const texts = (db.prepare('SELECT text FROM dose_phrases ORDER BY id').all() as { text: string }[]).map((r) => r.text)
    expect(texts).toEqual(['1 tablet twice daily after food', 'مرة يومياً'])
    expect((db.prepare("SELECT COUNT(*) AS c FROM sync_deletes WHERE tbl = 'dose_phrases'").get() as { c: number }).c).toBe(2)
    db.close()
  })
})
