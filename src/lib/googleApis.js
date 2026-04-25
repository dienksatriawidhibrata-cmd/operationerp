import { supabase } from './supabase'

const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY
const KPI_SHEET_ID = import.meta.env.VITE_GOOGLE_KPI_SHEET_ID
const BACKEND_BASE = import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000'

const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets'

function requireEnv(name, value) {
  if (!value) {
    throw new Error(`Konfigurasi ${name} belum diisi.`)
  }

  return value
}

function normalizeLabel(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function findKpiHeaderRow(values) {
  return values.findIndex((row = []) => {
    const normalized = row.map(normalizeLabel)
    return normalized.includes('store') && normalized.includes('score')
  })
}

function canonicalMonthlyKey(header, index) {
  const normalized = normalizeLabel(header)

  if (normalized === 'nama outlet' || normalized === 'nama store' || normalized === 'outlet') return 'outlet'
  if (normalized === 'store') return 'store'
  if (normalized === 'net sales') return 'sales'
  if (normalized === 'audit') return 'audit'
  if (normalized === 'complain') return 'complain'
  if (normalized === 'total') return 'total'
  if (normalized === 'score') return 'score'
  if (!normalized && index === 1) return 'dm'

  return null
}

async function fetchBackendJson(path) {
  const { data } = await supabase.auth.getSession()
  const accessToken = data?.session?.access_token
  if (!accessToken) {
    throw new Error('Sesi login tidak ditemukan.')
  }

  const res = await fetch(`${BACKEND_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!res.ok) {
    let detail = 'Gagal memuat data dari backend'
    try {
      const payload = await res.json()
      detail = payload?.detail || detail
    } catch {
      // Ignore JSON parsing failures.
    }
    throw new Error(detail)
  }

  return await res.json()
}

// SOP selalu lewat backend agar akses tetap mengikuti auth aplikasi.
export async function fetchSopDocuments() {
  const payload = await fetchBackendJson('/api/sop/docs')
  return payload.items || []
}

export async function fetchSopDocumentContent(documentId) {
  if (!documentId) throw new Error('Document ID tidak valid.')
  return await fetchBackendJson(`/api/sop/docs/${documentId}`)
}

// KPI framework (targets & weights) from "KPI" tab
export async function fetchKpiFramework() {
  const apiKey = requireEnv('VITE_GOOGLE_API_KEY', API_KEY)
  const sheetId = requireEnv('VITE_GOOGLE_KPI_SHEET_ID', KPI_SHEET_ID)
  const params = new URLSearchParams({ key: apiKey })
  const res = await fetch(`${SHEETS_BASE}/${sheetId}/values/KPI!A:E?${params}`)
  if (!res.ok) throw new Error('Gagal memuat KPI framework dari Spreadsheet')
  const { values = [] } = await res.json()

  const sections = []
  let activeSection = null

  for (const row of values) {
    const first = (row[0] || '').trim()
    const second = (row[1] || '').trim()

    if (!first && !second) continue

    if (!second && first && first !== 'Category' && first !== 'CATEGORY') {
      activeSection = {
        key: normalizeLabel(first).replace(/\s+/g, '_'),
        label: first,
        rows: [],
      }
      sections.push(activeSection)
      continue
    }

    if (first === 'Category' || first === 'CATEGORY') continue
    if (!first || !second || !activeSection) continue

    const entry = {
      category: first,
      item: second,
      target: row[2] || '',
      contribution: row[3] || '',
      cara: row[4] || '',
    }
    activeSection.rows.push(entry)
  }

  return sections
}

// Monthly scores from a specific tab e.g. 'Jan', 'Feb'
export async function fetchKpiMonthly(monthTab) {
  const apiKey = requireEnv('VITE_GOOGLE_API_KEY', API_KEY)
  const sheetId = requireEnv('VITE_GOOGLE_KPI_SHEET_ID', KPI_SHEET_ID)
  const params = new URLSearchParams({ key: apiKey })
  const res = await fetch(`${SHEETS_BASE}/${sheetId}/values/${monthTab}!A:P?${params}`)
  if (!res.ok) throw new Error(`Gagal memuat data KPI bulan ${monthTab}`)
  const { values = [] } = await res.json()
  if (values.length < 2) return []

  const headerRowIndex = findKpiHeaderRow(values)
  if (headerRowIndex === -1) return []

  const headers = values[headerRowIndex]
  return values.slice(headerRowIndex + 1).map((row) => {
    const obj = {}
    headers.forEach((header, index) => {
      const key = canonicalMonthlyKey(header, index)
      if (key) obj[key] = row[index] || ''
    })
    return obj
  }).filter((row) => row.outlet || row.store)
}

// Get available monthly sheet tabs from the spreadsheet
export async function fetchKpiAvailableMonths() {
  const apiKey = requireEnv('VITE_GOOGLE_API_KEY', API_KEY)
  const sheetId = requireEnv('VITE_GOOGLE_KPI_SHEET_ID', KPI_SHEET_ID)
  const params = new URLSearchParams({ key: apiKey, fields: 'sheets.properties' })
  const res = await fetch(`${SHEETS_BASE}/${sheetId}?${params}`)
  if (!res.ok) throw new Error('Gagal memuat daftar bulan dari Spreadsheet')
  const { sheets = [] } = await res.json()
  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
  return sheets
    .map((s) => s.properties.title)
    .filter((t) => MONTH_NAMES.includes(t))
}
