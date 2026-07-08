// Minimal, dependency-free CSV parse/serialize. Handles quoted fields, escaped
// quotes ("") and commas/newlines inside quotes — enough for customer import.

// Column order shared by customer export + import.
//
// The first four are the original required columns; the trailing three are
// optional (older 4-column CSVs still import). `birthday` is "YYYY-MM-DD" (the
// sentinel year 2000 is fine — only day+month are used); `marketing_consent`
// accepts 1/0, true/false, yes/no.
export const CSV_HEADERS = [
  'phone',
  'name',
  'points_balance',
  'visit_count',
  'lifetime_points',
  'birthday',
  'marketing_consent',
  'last_visited',
] as const

// Parse CSV text into rows of cells. Returns [] for empty input.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0

  const pushField = () => {
    row.push(field)
    field = ''
  }
  const pushRow = () => {
    rows.push(row)
    row = []
  }

  // Normalize CRLF/CR to LF.
  const src = text.replace(/\r\n?/g, '\n')

  while (i < src.length) {
    const c = src[i]
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i += 1
        continue
      }
      field += c
      i += 1
      continue
    }
    if (c === '"') {
      inQuotes = true
      i += 1
      continue
    }
    if (c === ',') {
      pushField()
      i += 1
      continue
    }
    if (c === '\n') {
      pushField()
      pushRow()
      i += 1
      continue
    }
    field += c
    i += 1
  }
  // Flush the trailing field/row (unless the input ended on a newline).
  if (field.length > 0 || row.length > 0) {
    pushField()
    pushRow()
  }
  // Drop a trailing fully-empty row.
  return rows.filter((r) => !(r.length === 1 && r[0] === ''))
}

// Serialize rows to CSV text, quoting cells that need it.
export function toCsv(rows: (string | number)[][]): string {
  const escape = (cell: string | number): string => {
    const s = String(cell)
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  return rows.map((r) => r.map(escape).join(',')).join('\n')
}

// Trigger a browser download of the given text as a file.
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
