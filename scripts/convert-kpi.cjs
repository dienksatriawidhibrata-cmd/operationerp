/**
 * convert-kpi.cjs
 * Converts "2026 - KPI Retail.xlsx" → src/data/kpi2026.js
 * Run: node scripts/convert-kpi.cjs
 */

const XLSX = require('xlsx')
const fs   = require('fs')
const path = require('path')

const ROOT   = path.join(__dirname, '..')
const XLSX_FILE = path.join(ROOT, '2026 - KPI Retail.xlsx')
const OUT_FILE  = path.join(ROOT, 'src', 'data', 'kpi2026.js')

const wb = XLSX.readFile(XLSX_FILE)
const MONTHS = ['Jan', 'Feb', 'Mar']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function str(v) { return String(v ?? '').trim() }
function num(v) { const n = Number(v); return isNaN(n) ? null : n }

function getRows(sheetName) {
  const ws = wb.Sheets[sheetName]
  if (!ws) return []
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
}

// ─── 1. Monthly scorecard sheets (Jan / Feb / Mar) ────────────────────────────
// Actual layout: col0=Nama Outlet, col1=DM, col2=Store short, cols3-11=scores, col12=Total
//                col13=empty, col14=Orang (DM ranking), col15=Score (DM ranking)

function parseMonthlySheet(month) {
  const rows = getRows(month)
  if (!rows.length) return null

  const headerRow = rows[0]
  // Item keys are in cols 3–11 (9 KPI items), col 12 = Total
  const itemKeys  = headerRow.slice(3, 12).map(str).filter(Boolean)

  const stores    = []
  const dmRanking = []

  for (let i = 1; i < rows.length; i++) {
    const row   = rows[i]
    const store = str(row[2])
    if (!store || store === 'Store') continue

    stores.push({
      dm:     str(row[1]),
      store,
      scores: itemKeys.map((_, j) => {
        const v = row[3 + j]
        return v !== '' ? Number(v) : null
      }),
      total: num(row[12]) ?? 0,
    })

    // DM ranking lives in cols 14–15 (not every row has it)
    if (str(row[14]) && row[15] !== '') {
      dmRanking.push({ name: str(row[14]), score: num(row[15]) ?? 0 })
    }
  }

  stores.sort((a, b) => b.total - a.total)
  dmRanking.sort((a, b) => b.score - a.score)

  return { itemKeys, stores, dmRanking }
}

// ─── 2. Sales & AVG (TARGET / ACH pairs per month) ────────────────────────────

function parsePivot2(sheetName) {
  const rows   = getRows(sheetName)
  const result = {}
  // Data starts at row 2 (row 0 = STORE/month headers, row 1 = FILTER/TARGET/ACH)
  for (let i = 2; i < rows.length; i++) {
    const row   = rows[i]
    const store = str(row[0])
    if (!store) continue
    result[store] = {}
    MONTHS.forEach((month, mi) => {
      const col    = 1 + mi * 2
      const target = row[col]  !== '' ? Number(row[col])  : null
      const actual = row[col+1] !== '' ? Number(row[col+1]) : null
      if (target !== null || actual !== null) {
        result[store][month] = { target, actual }
      }
    })
  }
  return result
}

// ─── 3. Simple numeric per store per month ────────────────────────────────────

function parseSimple(sheetName) {
  const rows   = getRows(sheetName)
  const result = {}
  for (let i = 1; i < rows.length; i++) {
    const row   = rows[i]
    const store = str(row[0])
    if (!store) continue
    result[store] = {}
    MONTHS.forEach((month, mi) => {
      const v = row[1 + mi]
      if (v !== '' && v !== null) result[store][month] = Number(v)
    })
  }
  return result
}

// ─── 4. Large Attach Rate: LARGE / (SMALL + LARGE) ───────────────────────────

function parseLarge() {
  const rows   = getRows('Large')
  const result = {}
  for (let i = 2; i < rows.length; i++) {
    const row   = rows[i]
    const store = str(row[0])
    if (!store) continue
    result[store] = {}
    MONTHS.forEach((month, mi) => {
      const small = Number(row[1 + mi * 2]) || 0
      const large = Number(row[2 + mi * 2]) || 0
      const total = small + large
      if (total > 0) result[store][month] = { small, large, total, rate: +(large / total).toFixed(4) }
    })
  }
  return result
}

// ─── 5. Oatside Attach Rate: OATSIDE / ITEM_DRINK ────────────────────────────

function parseOatside() {
  const rows   = getRows('Oatside')
  const result = {}
  for (let i = 2; i < rows.length; i++) {
    const row   = rows[i]
    const store = str(row[0])
    if (!store) continue
    result[store] = {}
    MONTHS.forEach((month, mi) => {
      const drinks = Number(row[1 + mi * 2]) || 0
      const oat    = Number(row[2 + mi * 2]) || 0
      if (drinks > 0) result[store][month] = { drinks, oat, rate: +(oat / drinks).toFixed(4) }
    })
  }
  return result
}

// ─── 6. Bundling Asik: B.ASIK / TOTAL ITEM ───────────────────────────────────

function parseBundling() {
  const rows   = getRows('Bundling Asik')
  const result = {}
  for (let i = 2; i < rows.length; i++) {
    const row   = rows[i]
    const store = str(row[0])
    if (!store) continue
    result[store] = {}
    MONTHS.forEach((month, mi) => {
      const total = Number(row[1 + mi * 2]) || 0
      const asik  = Number(row[2 + mi * 2]) || 0
      if (total > 0) result[store][month] = { total, asik, rate: +(asik / total).toFixed(4) }
    })
  }
  return result
}

// ─── 7. Complain rate: COUNT / TRX ───────────────────────────────────────────

function parseComplain() {
  const rows   = getRows('Complain')
  const result = {}
  for (let i = 2; i < rows.length; i++) {
    const row   = rows[i]
    const store = str(row[0])
    if (!store) continue
    result[store] = {}
    MONTHS.forEach((month, mi) => {
      const trx   = Number(row[1 + mi * 2]) || 0
      const count = Number(row[2 + mi * 2]) || 0
      if (trx > 0) result[store][month] = { trx, count, rate: +(count / trx).toFixed(6) }
    })
  }
  return result
}

// ─── 8. Retention: RESIGN / TOTAL ────────────────────────────────────────────

function parseRetention() {
  const rows   = getRows('Retention')
  const result = {}
  for (let i = 2; i < rows.length; i++) {
    const row   = rows[i]
    const store = str(row[0])
    if (!store) continue
    result[store] = {}
    MONTHS.forEach((month, mi) => {
      const total  = Number(row[1 + mi * 2]) || 0
      const resign = Number(row[2 + mi * 2]) || 0
      if (total > 0) result[store][month] = { total, resign, rate: +(resign / total).toFixed(4) }
    })
  }
  return result
}

// ─── 9. HPP: Gross Sales & HPP per month ─────────────────────────────────────

function parseHPP() {
  const rows   = getRows('HPP')
  const result = {}
  // Row 1 header: FILTER, Gross Sales, HPP, %HPP, Gross Sales, HPP, Gross Sales, HPP...
  // Jan = cols 1,2 (+ %HPP at col 3), Feb = cols 4,5, Mar = cols 6,7
  // Row 0: STORE, JAN(empty,empty), FEB(empty,empty), MAR(empty,empty)...
  // Row 1: FILTER, Gross Sales, HPP, %HPP, Gross Sales, HPP, %HPP, Gross Sales, HPP, %HPP
  // Jan=cols1,2  Feb=cols4,5  Mar=cols7,8
  const colMap = [
    { month: 'Jan', gross: 1, hpp: 2 },
    { month: 'Feb', gross: 4, hpp: 5 },
    { month: 'Mar', gross: 7, hpp: 8 },
  ]
  for (let i = 2; i < rows.length; i++) {
    const row   = rows[i]
    const store = str(row[0])
    if (!store) continue
    result[store] = {}
    colMap.forEach(({ month, gross, hpp }) => {
      // Some cells contain formatted strings like "Rp62,515,471" — strip them
      const parseCell = (v) => {
        if (typeof v === 'number') return v
        if (typeof v === 'string') {
          const stripped = v.replace(/[^0-9]/g, '')
          return stripped ? Number(stripped) : null
        }
        return null
      }
      const g = parseCell(row[gross])
      const h = parseCell(row[hpp])
      if (g && h) result[store][month] = { gross: g, hpp: h, rate: +(h / g).toFixed(4) }
    })
  }
  return result
}

// ─── Assemble ─────────────────────────────────────────────────────────────────

const monthly = {}
MONTHS.forEach(m => {
  const parsed = parseMonthlySheet(m)
  if (parsed) monthly[m] = parsed
})

const data = {
  lastUpdated:     new Date().toISOString().split('T')[0],
  availableMonths: MONTHS,
  monthly,
  sales:      parsePivot2('Sales'),
  avg:        parsePivot2('AVG'),
  audit:      parseSimple('Audit'),
  mysteryShoppers: parseSimple('Mistery Shopper'),
  large:      parseLarge(),
  oatside:    parseOatside(),
  bundling:   parseBundling(),
  complain:   parseComplain(),
  retention:  parseRetention(),
  hpp:        parseHPP(),
}

// ─── Write output ─────────────────────────────────────────────────────────────

const output = `// AUTO-GENERATED — do not edit manually.
// Regenerate by running: node scripts/convert-kpi.cjs
// Last updated: ${data.lastUpdated}

export const KPI_2026 = ${JSON.stringify(data, null, 2)}
`

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true })
fs.writeFileSync(OUT_FILE, output, 'utf8')

const kb = Math.round(fs.statSync(OUT_FILE).size / 1024)
console.log(`✓ Written ${kb} KB → ${OUT_FILE}`)
console.log(`  Months:  ${MONTHS.join(', ')}`)
MONTHS.forEach(m => {
  if (monthly[m]) console.log(`  ${m}: ${monthly[m].stores.length} stores, ${monthly[m].dmRanking.length} DMs`)
})
