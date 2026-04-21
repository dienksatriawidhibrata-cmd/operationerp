const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY
const SOP_FOLDER_ID = import.meta.env.VITE_GOOGLE_SOP_FOLDER_ID
const KPI_SHEET_ID = import.meta.env.VITE_GOOGLE_KPI_SHEET_ID

const DRIVE_BASE = 'https://www.googleapis.com/drive/v3'
const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets'

// ── SOP ───────────────────────────────────────────────────────────────────────

export async function fetchSopFiles() {
  const params = new URLSearchParams({
    q: `'${SOP_FOLDER_ID}' in parents and trashed = false`,
    key: API_KEY,
    fields: 'files(id,name,mimeType,modifiedTime)',
    orderBy: 'name',
    pageSize: '100',
  })
  const res = await fetch(`${DRIVE_BASE}/files?${params}`)
  if (!res.ok) throw new Error('Gagal memuat file SOP dari Drive')
  const { files } = await res.json()
  return (files || []).map((f) => ({
    id: f.id,
    name: f.name.replace(/\.(docx?|pdf|pptx?)$/i, ''),
    mimeType: f.mimeType,
    previewUrl: `https://docs.google.com/document/d/${f.id}/preview`,
    modifiedTime: f.modifiedTime,
  }))
}

// ── KPI ───────────────────────────────────────────────────────────────────────

// KPI framework (targets & weights) from "KPI" tab
export async function fetchKpiFramework() {
  const params = new URLSearchParams({ key: API_KEY })
  const res = await fetch(`${SHEETS_BASE}/${KPI_SHEET_ID}/values/KPI!A1:E30?${params}`)
  if (!res.ok) throw new Error('Gagal memuat KPI framework dari Spreadsheet')
  const { values = [] } = await res.json()

  const storeRows = []
  const managerRows = []
  let section = null

  for (const row of values) {
    const first = (row[0] || '').trim()
    if (first === 'Category' || first === 'CATEGORY') {
      section = storeRows.length === 0 ? 'store' : 'manager'
      continue
    }
    if (!first || !row[1]) continue
    const entry = {
      category: first,
      item: row[1],
      target: row[2] || '',
      contribution: row[3] || '',
      cara: row[4] || '',
    }
    if (section === 'store') storeRows.push(entry)
    else if (section === 'manager') managerRows.push(entry)
  }

  return { store: storeRows, manager: managerRows }
}

// Monthly scores from a specific tab e.g. 'Jan', 'Feb'
export async function fetchKpiMonthly(monthTab) {
  const params = new URLSearchParams({ key: API_KEY })
  const res = await fetch(`${SHEETS_BASE}/${KPI_SHEET_ID}/values/${monthTab}!A1:P50?${params}`)
  if (!res.ok) throw new Error(`Gagal memuat data KPI bulan ${monthTab}`)
  const { values = [] } = await res.json()
  if (values.length < 2) return []

  const headers = values[0]
  return values.slice(1).map((row) => {
    const obj = {}
    headers.forEach((h, i) => { obj[h] = row[i] || '' })
    return obj
  })
}

// Get available monthly sheet tabs from the spreadsheet
export async function fetchKpiAvailableMonths() {
  const params = new URLSearchParams({ key: API_KEY, fields: 'sheets.properties' })
  const res = await fetch(`${SHEETS_BASE}/${KPI_SHEET_ID}?${params}`)
  if (!res.ok) throw new Error('Gagal memuat daftar bulan dari Spreadsheet')
  const { sheets = [] } = await res.json()
  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']
  return sheets
    .map((s) => s.properties.title)
    .filter((t) => MONTH_NAMES.includes(t))
}
