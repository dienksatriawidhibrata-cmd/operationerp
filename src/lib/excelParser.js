/**
 * excelParser.js
 * Parses uploaded Excel/CSV files into supply order items.
 *
 * Expected column format (flexible):
 *   Description / Item  → "[SKU.CODE] Item Name"  OR  separate SKU + Name
 *   Quantity            → numeric (may include commas)
 *   Unit                → GR | ML | PCS | Pack | Botol | etc.
 *   Unit Price          → numeric (optional)
 */

import * as XLSX from 'xlsx'

// SKU code pattern: [COF.068], [BBFO.247], [PAC.048], etc.
const SKU_RE = /^\[([A-Z]+\.[A-Z0-9]+)\]\s*(.+)$/

/**
 * Parse number string: "10,000.00" → 10000, "1.735,00" → 1735 (ID locale) or as-is
 */
function parseQty(raw) {
  if (raw === null || raw === undefined || raw === '') return null
  if (typeof raw === 'number') return raw
  const s = String(raw).replace(/[^\d.,]/g, '').trim()
  if (!s) return null
  // Detect locale: if last separator is comma → ID locale "1.000,50"
  const lastComma = s.lastIndexOf(',')
  const lastDot   = s.lastIndexOf('.')
  if (lastComma > lastDot) {
    // ID locale: dots as thousands, comma as decimal
    return parseFloat(s.replace(/\./g, '').replace(',', '.'))
  }
  // EN locale: commas as thousands, dot as decimal
  return parseFloat(s.replace(/,/g, ''))
}

function str(v) { return String(v ?? '').trim() }

/**
 * Try to detect which column index serves which purpose.
 * Returns { descCol, qtyCol, unitCol, priceCol } (0-based indices or null)
 */
function detectColumns(headerRow) {
  const DESC_HINTS  = ['description','item','barang','sku','nama','product']
  const QTY_HINTS   = ['qty','quantity','jumlah','kuantitas']
  const UNIT_HINTS  = ['unit','satuan','uom']
  const PRICE_HINTS = ['price','harga','unit price','harga satuan']

  const lower = headerRow.map(h => str(h).toLowerCase())

  function find(hints) {
    for (const hint of hints) {
      const idx = lower.findIndex(h => h.includes(hint))
      if (idx !== -1) return idx
    }
    return null
  }

  return {
    descCol:  find(DESC_HINTS),
    qtyCol:   find(QTY_HINTS),
    unitCol:  find(UNIT_HINTS),
    priceCol: find(PRICE_HINTS),
  }
}

/**
 * Parse a single cell that might contain "10,000.00 GR" (qty + unit merged)
 * Returns { qty, unit }
 */
function parseQtyUnit(cell) {
  const s = str(cell)
  // Pattern: number then unit, e.g. "10,000.00 GR" or "400.00 PCS"
  const m = s.match(/^([\d,.\s]+)\s*([A-Za-z]+)$/)
  if (m) {
    return { qty: parseQty(m[1].trim()), unit: m[2].trim().toUpperCase() }
  }
  return { qty: parseQty(s), unit: null }
}

/**
 * Main parse function.
 * @param {File} file - uploaded File object
 * @returns {Promise<ParseResult>}
 */
export async function parseOrderFile(file) {
  const buffer = await file.arrayBuffer()
  const wb     = XLSX.read(buffer, { type: 'array' })

  // Use first sheet
  const sheetName = wb.SheetNames[0]
  const ws        = wb.Sheets[sheetName]
  const rows      = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

  if (rows.length < 2) {
    return { items: [], warnings: ['File kosong atau tidak ada data.'], meta: {} }
  }

  // Find header row (first row with recognizable column names OR row 0)
  let headerRowIdx = 0
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const lower = rows[i].map(h => str(h).toLowerCase()).join(' ')
    if (lower.includes('qty') || lower.includes('quantity') || lower.includes('description') || lower.includes('item')) {
      headerRowIdx = i
      break
    }
  }

  const headerRow = rows[headerRowIdx]
  const cols      = detectColumns(headerRow)
  const items     = []
  const warnings  = []

  // Try to detect order metadata (order number, store, date) from rows before header
  const meta = {}
  for (let i = 0; i < headerRowIdx; i++) {
    const rowStr = rows[i].join(' ')
    const orderMatch = rowStr.match(/(?:order|po|po#|po number)[:#\s]*([A-Z0-9\-]+)/i)
    if (orderMatch) meta.externalOrderRef = orderMatch[1]
    const dateMatch = rowStr.match(/(\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})/)
    if (dateMatch) meta.tanggalDoc = dateMatch[1]
  }

  // Parse data rows
  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i]
    if (row.every(c => c === '' || c === null || c === undefined)) continue

    // ── Detect description column ──
    let rawDesc = cols.descCol !== null ? str(row[cols.descCol]) : ''

    // Fallback: scan all columns for a SKU pattern
    if (!rawDesc || !SKU_RE.test(rawDesc)) {
      for (let c = 0; c < row.length; c++) {
        const candidate = str(row[c])
        if (SKU_RE.test(candidate)) { rawDesc = candidate; break }
      }
    }

    if (!rawDesc) continue

    // ── Parse SKU from description ──
    let skuCode = '', skuName = rawDesc
    const skuMatch = rawDesc.match(SKU_RE)
    if (skuMatch) {
      skuCode = skuMatch[1]
      skuName = skuMatch[2].trim()
    } else {
      // Maybe SKU and name are in separate cells
      // Try to find a short all-caps cell as the SKU code
      for (let c = 0; c < row.length; c++) {
        const v = str(row[c])
        if (/^[A-Z]+\.[A-Z0-9]+$/.test(v)) { skuCode = v; break }
      }
    }

    if (!skuName) continue

    // ── Parse quantity ──
    let qty  = null
    let unit = null

    if (cols.qtyCol !== null) {
      const rawQty = row[cols.qtyCol]
      // Check if qty cell also contains unit ("10,000.00 GR")
      const parsed = parseQtyUnit(rawQty)
      qty  = parsed.qty
      unit = parsed.unit
    }

    // ── Parse unit (if not embedded in qty) ──
    if (!unit && cols.unitCol !== null) {
      unit = str(row[cols.unitCol]).toUpperCase() || null
    }

    // Fallback: if no qty column detected, try all numeric columns
    if (qty === null) {
      for (let c = 0; c < row.length; c++) {
        if (c === cols.descCol) continue
        const v = row[c]
        if (typeof v === 'number' && v > 0) {
          qty = v
          break
        }
        const parsed = parseQty(v)
        if (parsed !== null && parsed > 0) {
          qty = parsed
          // Check if adjacent cell is a unit string
          const nextCell = str(row[c + 1])
          if (/^[A-Z]+$/.test(nextCell) && nextCell.length <= 6) unit = nextCell
          break
        }
      }
    }

    // ── Parse unit price ──
    let unitPrice = null
    if (cols.priceCol !== null) {
      unitPrice = parseQty(row[cols.priceCol])
    }

    if (qty === null || qty <= 0) {
      warnings.push(`Baris ${i + 1}: qty tidak terbaca untuk "${skuName}" — dilewati.`)
      continue
    }

    items.push({
      sku_code:   skuCode || `UNK-${i}`,
      sku_name:   skuName,
      qty_ordered: qty,
      unit:        unit || 'PCS',
      unit_price:  unitPrice,
    })
  }

  if (items.length === 0) {
    warnings.push('Tidak ada item yang berhasil dibaca. Pastikan format kolom: [SKU.CODE] Nama Item | Qty | Unit.')
  }

  return { items, warnings, meta }
}
