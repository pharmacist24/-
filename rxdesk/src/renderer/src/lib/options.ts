/**
 * Dropdown choices without blanks or duplicates. Mantine refuses duplicate options (the screen stops), and
 * lists that come from the database or from sync can contain the same text twice.
 */
export function uniqueOptions(values: readonly (string | null | undefined)[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const v of values) {
    const s = typeof v === 'string' ? v.trim() : ''
    if (!s || seen.has(s)) continue
    seen.add(s)
    out.push(s)
  }
  return out
}
