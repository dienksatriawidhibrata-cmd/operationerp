import * as XLSX from 'xlsx'

/**
 * Format angka ke Rupiah, e.g. 1500000 -> "Rp 1.500.000"
 */
export function fmtRp(n) {
  if (n == null || isNaN(n)) return 'Rp 0'
  return 'Rp ' + Number(n).toLocaleString('id-ID')
}

/**
 * Format tanggal ke "Senin, 15 Apr 2026"
 */
export function fmtDate(date) {
  return new Date(date).toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'short', year: 'numeric',
  })
}

/**
 * Format tanggal ke "15 Apr"
 */
export function fmtDateShort(date) {
  return new Date(date).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short',
  })
}

/**
 * Today's date as YYYY-MM-DD string in WIB
 */
export function todayWIB() {
  const now = new Date()
  const wib = new Date(now.getTime() + 7 * 3600 * 1000)
  return wib.toISOString().split('T')[0]
}

/**
 * Yesterday's date as YYYY-MM-DD in WIB
 */
export function yesterdayWIB() {
  const now = new Date()
  const wib = new Date(now.getTime() + 7 * 3600 * 1000 - 24 * 3600 * 1000)
  return wib.toISOString().split('T')[0]
}

/**
 * Current time in WIB as "HH:MM"
 */
export function nowTimeWIB() {
  const now = new Date(new Date().getTime() + 7 * 3600 * 1000)
  return now.toISOString().slice(11, 16)
}

/**
 * Hitung sisa waktu deadline laporan harian (H+1 14:00 WIB)
 * @param {string} tanggalOperasional - YYYY-MM-DD
 * @returns {string} e.g. "3 jam 45 menit" atau "Terlambat"
 */
export function sisaWaktuLaporan(tanggalOperasional) {
  const deadline = new Date(tanggalOperasional)
  deadline.setDate(deadline.getDate() + 1)
  deadline.setUTCHours(7, 0, 0, 0)
  const now = new Date()
  const diff = deadline - now
  if (diff <= 0) return 'Terlambat'
  const jam = Math.floor(diff / 3600000)
  const menit = Math.floor((diff % 3600000) / 60000)
  return `${jam}j ${menit}m`
}

/**
 * Daily visit grade berdasarkan score %
 */
export function visitGrade(score, maxScore = 110) {
  const pct = score / maxScore * 100
  if (pct >= 90) return { label: 'Excellent', color: 'text-green-600', bg: 'bg-green-50' }
  if (pct >= 80) return { label: 'Good', color: 'text-blue-600', bg: 'bg-blue-50' }
  if (pct >= 60) return { label: 'Fair', color: 'text-yellow-600', bg: 'bg-yellow-50' }
  return { label: 'Poor', color: 'text-red-600', bg: 'bg-red-50' }
}

/**
 * Role label human-readable
 */
export function roleLabel(role) {
  const map = {
    staff: 'Staff',
    barista: 'Barista',
    kitchen: 'Kitchen',
    waitress: 'Waitress',
    asst_head_store: 'Asst. Head Store',
    head_store: 'Head Store',
    district_manager: 'District Manager',
    area_manager: 'Area Manager',
    ops_manager: 'Operational Manager',
    finance_supervisor: 'Finance Supervisor',
    sc_supervisor: 'Supply Chain Supervisor',
    support_spv: 'Support Supervisor',
    support_admin: 'Support Admin',
    trainer: 'Trainer',
    auditor: 'Auditor',
    hr_staff: 'HR Staff',
    hr_spv: 'HR Supervisor',
    hr_legal: 'HR Legal',
    hr_administrator: 'HR Administrator',
  }
  return map[role] || role
}

export function currentPeriodWIB() {
  const now = new Date(new Date().getTime() + 7 * 3600 * 1000)
  return now.toISOString().slice(0, 7)
}

export function periodBounds(yyyymm) {
  if (!yyyymm) {
    return { startDate: '', endDate: '', daysInMonth: 0 }
  }

  const [y, m] = yyyymm.split('-').map(Number)
  const daysInMonth = new Date(y, m, 0).getDate()

  return {
    startDate: `${yyyymm}-01`,
    endDate: `${yyyymm}-${String(daysInMonth).padStart(2, '0')}`,
    daysInMonth,
  }
}

export function periodLabel(yyyymm) {
  if (!yyyymm) return ''
  const [y, m] = yyyymm.split('-')
  return new Date(Number(y), Number(m) - 1, 1)
    .toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })
}

export function lastNPeriods(n = 6) {
  const result = []
  const now = new Date(new Date().getTime() + 7 * 3600 * 1000)
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    result.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return result
}

export function pctToScore(pct) {
  if (pct >= 90) return 5
  if (pct >= 80) return 4
  if (pct >= 70) return 3
  if (pct >= 60) return 2
  return 1
}

export function avg360ToScore(avg) {
  if (avg >= 4.0) return 5
  if (avg >= 3.0) return 4
  if (avg >= 2.5) return 3
  if (avg >= 2.0) return 2
  return 1
}

export function isStoreRole(role) {
  return ['staff', 'asst_head_store', 'head_store'].includes(role)
}

export function isManagerRole(role) {
  return ['district_manager', 'area_manager', 'ops_manager'].includes(role)
}

/**
 * Download data as a UTF-8 CSV file (with BOM so Excel opens correctly).
 * @param {string} filename
 * @param {string[]} headers
 * @param {Array<Array<string|number|null>>} rows
 */
export function downloadCsv(filename, headers, rows) {
  const escape = (val) => {
    if (val == null) return ''
    const str = String(val)
    return str.includes(',') || str.includes('"') || str.includes('\n')
      ? `"${str.replace(/"/g, '""')}"`
      : str
  }

  const lines = [headers.map(escape).join(',')]
  rows.forEach((row) => lines.push(row.map(escape).join(',')))

  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Download tabular data as an XLSX file.
 * @param {string} filename
 * @param {string} sheetName
 * @param {string[]} headers
 * @param {Array<Array<string|number|null>>} rows
 */
export function downloadXlsx(filename, sheetName, headers, rows) {
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  XLSX.writeFile(workbook, filename)
}
