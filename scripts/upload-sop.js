/**
 * upload-sop.js
 * Upload semua file .docx dari folder SOP/ ke Supabase Storage
 * lalu insert/upsert ke tabel sop_cards.
 *
 * Jalankan:
 *   node scripts/upload-sop.js
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync } from 'fs'
import { resolve, dirname, extname, basename } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadEnv(path) {
  try {
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/)
      if (m) process.env[m[1].trim()] ??= m[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch {}
}
loadEnv(resolve(__dirname, '../.env'))
loadEnv(resolve(__dirname, '../.env.local'))

const URL_    = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SVC_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_ || !SVC_KEY) { console.error('Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY'); process.exit(1) }

const supabase = createClient(URL_, SVC_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const BUCKET   = 'sop-files'
const SOP_DIR  = resolve(__dirname, '../SOP')

// Kategori berdasarkan nama file (bisa disesuaikan)
function guessCategory(title) {
  const t = title.toLowerCase()
  if (t.includes('cash') || t.includes('dana') || t.includes('pos') || t.includes('retur') || t.includes('pembelian')) return 'Keuangan & Pembelian'
  if (t.includes('bahan baku') || t.includes('penyimpanan') || t.includes('kelayakan') || t.includes('kalibrasi') || t.includes('quality')) return 'Produksi & QC'
  if (t.includes('customer') || t.includes('komplain') || t.includes('promo') || t.includes('pemesanan')) return 'Customer Service'
  if (t.includes('perawatan') || t.includes('store operation') || t.includes('keselamatan') || t.includes('halal') || t.includes('stock')) return 'Operasional Toko'
  if (t.includes('hr') || t.includes('people') || t.includes('staff') || t.includes('qna')) return 'SDM & HR'
  if (t.includes('company')) return 'Perusahaan'
  return 'Umum'
}

async function main() {
  // 1. Buat bucket kalau belum ada
  const { data: buckets } = await supabase.storage.listBuckets()
  const exists = buckets?.some((b) => b.name === BUCKET)
  if (!exists) {
    const { error } = await supabase.storage.createBucket(BUCKET, { public: true })
    if (error) { console.error('Gagal buat bucket:', error.message); process.exit(1) }
    console.log(`Bucket "${BUCKET}" dibuat.`)
  } else {
    console.log(`Bucket "${BUCKET}" sudah ada.`)
  }

  // 2. Ambil semua .docx
  const files = readdirSync(SOP_DIR).filter((f) => extname(f).toLowerCase() === '.docx')
  console.log(`\nDitemukan ${files.length} file SOP.\n`)

  let ok = 0, fail = 0
  for (let i = 0; i < files.length; i++) {
    const fileName = files[i]
    const title    = basename(fileName, '.docx')
    const filePath = resolve(SOP_DIR, fileName)
    const fileData = readFileSync(filePath)
    const storagePath = fileName  // simpan langsung di root bucket

    // Upload ke storage (upsert: timpa kalau sudah ada)
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, fileData, {
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        upsert: true,
      })

    if (upErr) {
      console.error(`  FAIL upload "${fileName}": ${upErr.message}`)
      fail++
      continue
    }

    // Ambil URL (signed atau public path)
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
    const fileUrl = urlData?.publicUrl || `${URL_}/storage/v1/object/${BUCKET}/${storagePath}`

    // Upsert ke sop_cards (match by file_name)
    const { error: dbErr } = await supabase
      .from('sop_cards')
      .upsert({
        title,
        category:   guessCategory(title),
        file_name:  fileName,
        file_url:   fileUrl,
        sort_order: i + 1,
        is_active:  true,
      }, { onConflict: 'file_name' })

    if (dbErr) {
      console.error(`  FAIL DB "${title}": ${dbErr.message}`)
      fail++
    } else {
      console.log(`  OK [${guessCategory(title).padEnd(28)}] ${title}`)
      ok++
    }
  }

  console.log(`\nSelesai: ${ok} berhasil, ${fail} gagal.`)
}

main().catch((e) => { console.error(e); process.exit(1) })
