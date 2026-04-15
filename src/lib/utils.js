/**
 * Format angka ke Rupiah, e.g. 1500000 → "Rp 1.500.000"
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
    weekday: 'long', day: 'numeric', month: 'short', year: 'numeric'
  })
}

/**
 * Format tanggal ke "15 Apr"
 */
export function fmtDateShort(date) {
  return new Date(date).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short'
  })
}

/**
 * Today's date as YYYY-MM-DD string in WIB
 */
export function todayWIB() {
  const now = new Date()
  // UTC+7
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
  deadline.setUTCHours(7, 0, 0, 0) // 14:00 WIB = 07:00 UTC
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
  if (pct >= 80) return { label: 'Good',      color: 'text-blue-600',  bg: 'bg-blue-50' }
  if (pct >= 60) return { label: 'Fair',      color: 'text-yellow-600',bg: 'bg-yellow-50' }
  return             { label: 'Poor',      color: 'text-red-600',   bg: 'bg-red-50' }
}

/**
 * Role label human-readable
 */
export function roleLabel(role) {
  const map = {
    staff: 'Staff',
    asst_head_store: 'Assistant Head Store',
    head_store: 'Head Store',
    district_manager: 'District Manager',
    area_manager: 'Area Manager',
    ops_manager: 'Operational Manager',
    finance_supervisor: 'Finance Supervisor',
    sc_supervisor: 'Supply Chain Supervisor',
  }
  return map[role] || role
}

/**
 * Apakah role ini level store?
 */
export function isStoreRole(role) {
  return ['staff', 'asst_head_store', 'head_store'].includes(role)
}

/**
 * Apakah role ini level managerial (bisa audit)?
 */
export function isManagerRole(role) {
  return ['district_manager', 'area_manager', 'ops_manager'].includes(role)
}
