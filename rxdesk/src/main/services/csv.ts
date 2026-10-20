// CSV export that opens correctly in Excel (UTF-8 BOM so Arabic shows properly).

export function toCsv(headers: string[], rows: Record<string, unknown>[], keys: string[]): string {
  const cell = (v: unknown): string => {
    let s = v === null || v === undefined ? '' : String(v)
    // Prevent spreadsheet formula injection from free text fields.
    if (/^[=@\t\r]/.test(s) || /^[+\-][^\d\s]/.test(s)) s = "'" + s
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [headers.map(cell).join(',')]
  for (const r of rows) lines.push(keys.map((k) => cell(r[k])).join(','))
  return '\uFEFF' + lines.join('\r\n') + '\r\n'
}
