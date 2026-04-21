import * as XLSX from 'xlsx'
import { writeFileSync } from 'fs'

const CHECKLIST_ITEMS = [
  { key: 'toko_buka',              label: 'Toko sudah buka',          shift: 'pagi',   type: 'toggle',     requiresPhoto: false },
  { key: 'toko_close',             label: 'Toko sudah Close',         shift: 'malam',  type: 'toggle',     requiresPhoto: false },
  { key: 'gofood_aktif',           label: 'GoFood aktif',             shift: 'pagi',   type: 'toggle',     requiresPhoto: false },
  { key: 'gofood_close',           label: 'GoFood sudah Close',       shift: 'malam',  type: 'toggle',     requiresPhoto: false },
  { key: 'grabfood_aktif',         label: 'GrabFood aktif',           shift: 'pagi',   type: 'toggle',     requiresPhoto: false },
  { key: 'grabfood_close',         label: 'GrabFood sudah Close',     shift: 'malam',  type: 'toggle',     requiresPhoto: false },
  { key: 'shopeefood_aktif',       label: 'ShopeeFood aktif',         shift: 'pagi',   type: 'toggle',     requiresPhoto: false },
  { key: 'shopeefood_close',       label: 'ShopeeFood sudah Close',   shift: 'malam',  type: 'toggle',     requiresPhoto: false },
  { key: 'bar_bersih',             label: 'Area Bar',                 shift: 'both',   type: 'toggle',     requiresPhoto: true  },
  { key: 'kitchen_bersih',         label: 'Area Kitchen',             shift: 'both',   type: 'toggle',     requiresPhoto: true  },
  { key: 'indoor_ns_bersih',       label: 'Indoor Non-Smoking',       shift: 'both',   type: 'toggle',     requiresPhoto: true  },
  { key: 'indoor_sm_bersih',       label: 'Indoor Smoking',           shift: 'both',   type: 'toggle',     requiresPhoto: true  },
  { key: 'outdoor_bersih',         label: 'Area Outdoor',             shift: 'both',   type: 'toggle',     requiresPhoto: true  },
  { key: 'toilet_pria_bersih',     label: 'Toilet Pria',              shift: 'both',   type: 'toggle',     requiresPhoto: true  },
  { key: 'toilet_wanita_bersih',   label: 'Toilet Wanita',            shift: 'both',   type: 'toggle',     requiresPhoto: true  },
  { key: 'musholla_bersih',        label: 'Musholla',                 shift: 'both',   type: 'toggle',     requiresPhoto: true  },
  { key: 'staff_grooming',         label: 'Staff Grooming',           shift: 'pagi',   type: 'toggle',     requiresPhoto: true  },
  { key: 'stok_bahan_cukup',       label: 'Stok Bahan Baku Cukup',   shift: 'middle', type: 'toggle',     requiresPhoto: false },
  { key: 'peralatan_bersih',       label: 'Peralatan Bersih & Siap', shift: 'middle', type: 'toggle',     requiresPhoto: false },
  { key: 'item_oos',               label: 'Item Out of Stock',        shift: 'both',   type: 'text_array', requiresPhoto: false },
]

const rows = CHECKLIST_ITEMS.map((item) => ({
  'Key (jangan diubah)': item.key,
  'Label (nama tampil)': item.label,
  'Shift': item.shift,
  'Foto Wajib (YES/NO)': item.requiresPhoto ? 'YES' : 'NO',
  'Tipe (toggle / text_array)': item.type,
}))

const wb = XLSX.utils.book_new()
const ws = XLSX.utils.json_to_sheet(rows)

// Column widths
ws['!cols'] = [
  { wch: 28 },
  { wch: 32 },
  { wch: 10 },
  { wch: 20 },
  { wch: 26 },
]

// Info sheet
const info = [
  ['PETUNJUK PENGISIAN'],
  [''],
  ['Kolom', 'Keterangan'],
  ['Key', 'ID unik item — JANGAN diubah untuk item yang sudah ada. Untuk item BARU, isi dengan snake_case tanpa spasi (contoh: kasir_aktif)'],
  ['Label', 'Nama yang tampil di aplikasi — bebas diubah'],
  ['Shift', 'pagi = hanya shift pagi | malam = hanya shift malam | middle = hanya shift middle | both = semua shift'],
  ['Foto Wajib', 'YES = staff wajib upload foto | NO = tidak perlu foto'],
  ['Tipe', 'toggle = checklist biasa (centang/tidak) | text_array = input teks OOS (jangan diubah)'],
  [''],
  ['CARA EDIT:'],
  ['- Ubah Label, Shift, atau Foto Wajib sesuai kebutuhan'],
  ['- Hapus baris untuk menghapus item (data lama di database tetap ada, hanya tidak tampil)'],
  ['- Tambah baris baru di bawah untuk menambah item baru'],
  ['- Untuk item baru, isi Key dengan nama unik (snake_case), Tipe isi "toggle"'],
]
const wsInfo = XLSX.utils.aoa_to_sheet(info)
wsInfo['!cols'] = [{ wch: 18 }, { wch: 80 }]

XLSX.utils.book_append_sheet(wb, wsInfo, 'Petunjuk')
XLSX.utils.book_append_sheet(wb, ws, 'Checklist Items')

const outPath = 'checklist_items.xlsx'
writeFileSync(outPath, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
console.log(`✓ File disimpan: ${outPath}`)
