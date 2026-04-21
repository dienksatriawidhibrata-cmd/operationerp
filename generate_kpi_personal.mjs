// node generate_kpi_personal.mjs  →  creates KPI_Personal_Rekomendasi.xlsx
import xlsx from 'xlsx'

const ROLES = ['BARISTA', 'KITCHEN', 'WAITRESS', 'ASST_HEAD_STORE']

const items = {
  BARISTA: [
    { item_key: 'auto_checklist',    item_name: 'Checklist Completion',     weight_pct: 13, description: 'Persentase penyelesaian ceklis harian shift pagi+middle+malam (otomatis)', score_1: '<60% ceklis selesai', score_2: '60-69%', score_3: '70-79%', score_4: '80-89%', score_5: '≥90% ceklis selesai' },
    { item_key: 'auto_preparation',  item_name: 'Prep Bar Completion',      weight_pct: 13, description: 'Persentase penyelesaian preparation bar harian (otomatis)', score_1: '<60%', score_2: '60-69%', score_3: '70-79%', score_4: '80-89%', score_5: '≥90%' },
    { item_key: 'kualitas_minuman',  item_name: 'Kualitas Minuman',         weight_pct: 18, description: 'Konsistensi rasa, presentasi, dan standar resep', score_1: 'Banyak keluhan kualitas', score_2: 'Sering tidak konsisten', score_3: 'Cukup konsisten', score_4: 'Konsisten, jarang keluhan', score_5: 'Konsisten sempurna, 0 keluhan' },
    { item_key: 'kecepatan',         item_name: 'Kecepatan Penyajian',      weight_pct: 13, description: 'Waktu penyajian sesuai SOP', score_1: '>10 menit rata-rata', score_2: '8-10 menit', score_3: '6-8 menit', score_4: '4-6 menit', score_5: '<4 menit, konsisten' },
    { item_key: 'kebersihan_bar',    item_name: 'Kebersihan Bar',            weight_pct: 13, description: 'Kebersihan area bar sesuai standar audit', score_1: 'Sangat kotor', score_2: 'Kotor, sering ditegur', score_3: 'Cukup bersih', score_4: 'Bersih, jarang catatan', score_5: 'Sangat bersih, selalu rapi' },
    { item_key: 'waste_spoil',       item_name: 'Waste & Spoil Control',    weight_pct: 10, description: 'Pengendalian bahan baku dan pengurangan waste', score_1: 'Waste sangat tinggi', score_2: 'Waste di atas rata-rata', score_3: 'Waste normal', score_4: 'Waste rendah', score_5: 'Waste minimal, efisien' },
    { item_key: 'kedisiplinan',      item_name: 'Kedisiplinan',             weight_pct: 10, description: 'Kehadiran, ketepatan waktu, dan mengikuti aturan', score_1: '≥5 keterlambatan/absen', score_2: '3-4 pelanggaran', score_3: '2 pelanggaran', score_4: '1 pelanggaran', score_5: 'Tidak pernah terlambat/absen' },
    { item_key: 'auto_360',          item_name: 'Penilaian 360°',           weight_pct: 10, description: 'Rata-rata skor peer review dari rekan setim (otomatis)', score_1: 'avg < 2.0', score_2: 'avg 2.0-2.4', score_3: 'avg 2.5-2.9', score_4: 'avg 3.0-3.9', score_5: 'avg ≥ 4.0' },
  ],
  KITCHEN: [
    { item_key: 'auto_checklist',    item_name: 'Checklist Completion',     weight_pct: 13, description: 'Persentase penyelesaian ceklis harian (otomatis)', score_1: '<60%', score_2: '60-69%', score_3: '70-79%', score_4: '80-89%', score_5: '≥90%' },
    { item_key: 'auto_preparation',  item_name: 'Prep Kitchen Completion',  weight_pct: 13, description: 'Persentase penyelesaian preparation kitchen harian (otomatis)', score_1: '<60%', score_2: '60-69%', score_3: '70-79%', score_4: '80-89%', score_5: '≥90%' },
    { item_key: 'kualitas_makanan',  item_name: 'Kualitas Makanan',         weight_pct: 18, description: 'Konsistensi rasa, presentasi, dan standar resep makanan', score_1: 'Banyak keluhan kualitas', score_2: 'Sering tidak konsisten', score_3: 'Cukup konsisten', score_4: 'Konsisten, jarang keluhan', score_5: 'Konsisten sempurna, 0 keluhan' },
    { item_key: 'kecepatan',         item_name: 'Kecepatan Penyajian',      weight_pct: 13, description: 'Waktu penyajian sesuai SOP', score_1: '>15 menit rata-rata', score_2: '12-15 menit', score_3: '9-12 menit', score_4: '6-9 menit', score_5: '<6 menit, konsisten' },
    { item_key: 'kebersihan_dapur',  item_name: 'Kebersihan Dapur',         weight_pct: 13, description: 'Kebersihan area dapur dan peralatan', score_1: 'Sangat kotor', score_2: 'Kotor, sering ditegur', score_3: 'Cukup bersih', score_4: 'Bersih, jarang catatan', score_5: 'Sangat bersih, selalu rapi' },
    { item_key: 'waste_spoil',       item_name: 'Waste & Spoil Control',    weight_pct: 10, description: 'Pengendalian bahan baku dan pengurangan waste dapur', score_1: 'Waste sangat tinggi', score_2: 'Waste di atas rata-rata', score_3: 'Waste normal', score_4: 'Waste rendah', score_5: 'Waste minimal, efisien' },
    { item_key: 'kedisiplinan',      item_name: 'Kedisiplinan',             weight_pct: 10, description: 'Kehadiran, ketepatan waktu, dan mengikuti aturan', score_1: '≥5 keterlambatan/absen', score_2: '3-4 pelanggaran', score_3: '2 pelanggaran', score_4: '1 pelanggaran', score_5: 'Tidak pernah terlambat/absen' },
    { item_key: 'auto_360',          item_name: 'Penilaian 360°',           weight_pct: 10, description: 'Rata-rata skor peer review dari rekan setim (otomatis)', score_1: 'avg < 2.0', score_2: 'avg 2.0-2.4', score_3: 'avg 2.5-2.9', score_4: 'avg 3.0-3.9', score_5: 'avg ≥ 4.0' },
  ],
  WAITRESS: [
    { item_key: 'auto_checklist',    item_name: 'Checklist Completion',     weight_pct: 15, description: 'Persentase penyelesaian ceklis harian (otomatis)', score_1: '<60%', score_2: '60-69%', score_3: '70-79%', score_4: '80-89%', score_5: '≥90%' },
    { item_key: 'kualitas_layanan',  item_name: 'Kualitas Pelayanan',       weight_pct: 25, description: 'Keramahan, kecepatan, dan kepuasan tamu', score_1: 'Banyak keluhan tamu', score_2: 'Sering ada keluhan', score_3: 'Pelayanan standar', score_4: 'Pelayanan baik, jarang keluhan', score_5: 'Pelayanan luar biasa, 0 keluhan' },
    { item_key: 'kebersihan_area',   item_name: 'Kebersihan Area',          weight_pct: 20, description: 'Kebersihan meja, lantai, dan area tamu', score_1: 'Sangat kotor', score_2: 'Kotor, sering ditegur', score_3: 'Cukup bersih', score_4: 'Bersih, jarang catatan', score_5: 'Sangat bersih, selalu rapi' },
    { item_key: 'complain_handling', item_name: 'Complain Handling',        weight_pct: 15, description: 'Kemampuan menangani keluhan tamu dengan baik', score_1: 'Tidak bisa handle, eskalasi selalu', score_2: 'Sering gagal handle', score_3: 'Handle dengan bantuan', score_4: 'Bisa handle mandiri', score_5: 'Excellent, tamu puas' },
    { item_key: 'kedisiplinan',      item_name: 'Kedisiplinan',             weight_pct: 10, description: 'Kehadiran, ketepatan waktu, dan mengikuti aturan', score_1: '≥5 keterlambatan/absen', score_2: '3-4 pelanggaran', score_3: '2 pelanggaran', score_4: '1 pelanggaran', score_5: 'Tidak pernah terlambat/absen' },
    { item_key: 'auto_360',          item_name: 'Penilaian 360°',           weight_pct: 15, description: 'Rata-rata skor peer review dari rekan setim (otomatis)', score_1: 'avg < 2.0', score_2: 'avg 2.0-2.4', score_3: 'avg 2.5-2.9', score_4: 'avg 3.0-3.9', score_5: 'avg ≥ 4.0' },
  ],
  ASST_HEAD_STORE: [
    { item_key: 'auto_checklist',    item_name: 'Checklist Monitoring',     weight_pct: 8,  description: 'Persentase ceklis harian branch diselesaikan (otomatis)', score_1: '<60%', score_2: '60-69%', score_3: '70-79%', score_4: '80-89%', score_5: '≥90%' },
    { item_key: 'auto_preparation',  item_name: 'Preparation Monitoring',   weight_pct: 8,  description: 'Persentase preparation harian diselesaikan (otomatis)', score_1: '<60%', score_2: '60-69%', score_3: '70-79%', score_4: '80-89%', score_5: '≥90%' },
    { item_key: 'sales_kpi',         item_name: 'Sales KPI Achievement',    weight_pct: 20, description: 'Pencapaian target sales toko vs target', score_1: '<80% target', score_2: '80-84%', score_3: '85-89%', score_4: '90-99%', score_5: '≥100% target' },
    { item_key: 'coaching',          item_name: 'Coaching Tim',             weight_pct: 13, description: 'Aktif membimbing dan meningkatkan performa tim', score_1: 'Tidak pernah coaching', score_2: 'Jarang coaching', score_3: 'Coaching kadang-kadang', score_4: 'Coaching rutin', score_5: 'Coaching efektif, tim berkembang' },
    { item_key: 'stock_fifo',        item_name: 'Stock & FIFO',             weight_pct: 13, description: 'Pengelolaan stok dan penerapan FIFO', score_1: 'Banyak expired/waste', score_2: 'FIFO sering tidak dijalankan', score_3: 'FIFO cukup baik', score_4: 'FIFO konsisten', score_5: 'FIFO sempurna, 0 expired' },
    { item_key: 'opex_control',      item_name: 'Opex Control',             weight_pct: 10, description: 'Pengendalian biaya operasional sesuai budget', score_1: '>20% di atas budget', score_2: '10-20% di atas budget', score_3: '0-10% di atas budget', score_4: 'Sesuai budget', score_5: 'Di bawah budget' },
    { item_key: 'sop_kebersihan',    item_name: 'SOP & Kebersihan',         weight_pct: 8,  description: 'Kepatuhan SOP dan standar kebersihan seluruh area', score_1: 'Banyak pelanggaran SOP', score_2: 'Sering pelanggaran', score_3: 'Cukup patuh', score_4: 'Patuh SOP', score_5: 'Patuh sempurna' },
    { item_key: 'kedisiplinan',      item_name: 'Kedisiplinan',             weight_pct: 10, description: 'Kehadiran, ketepatan waktu, dan mengikuti aturan', score_1: '≥5 keterlambatan/absen', score_2: '3-4 pelanggaran', score_3: '2 pelanggaran', score_4: '1 pelanggaran', score_5: 'Tidak pernah terlambat/absen' },
    { item_key: 'auto_360',          item_name: 'Penilaian 360°',           weight_pct: 10, description: 'Rata-rata skor peer review dari rekan setim (otomatis)', score_1: 'avg < 2.0', score_2: 'avg 2.0-2.4', score_3: 'avg 2.5-2.9', score_4: 'avg 3.0-3.9', score_5: 'avg ≥ 4.0' },
  ],
}

const items360 = {
  STORE: [
    { item_key: 'kerjasama_tim',    item_name: 'Kerjasama Tim',           description: 'Kemampuan bekerja sama dan saling bantu', score_1: 'Tidak mau kerjasama', score_2: 'Jarang bantu tim', score_3: 'Kerjasama standar', score_4: 'Aktif bantu tim', score_5: 'Selalu proaktif bantu tim' },
    { item_key: 'komunikasi_sikap', item_name: 'Komunikasi & Sikap',      description: 'Komunikasi yang baik dan sikap positif', score_1: 'Sering konflik/negatif', score_2: 'Komunikasi buruk', score_3: 'Komunikasi cukup', score_4: 'Komunikasi baik', score_5: 'Komunikasi excellent, positif' },
    { item_key: 'inisiatif',        item_name: 'Inisiatif & Proaktif',    description: 'Mengambil inisiatif tanpa perlu diminta', score_1: 'Selalu pasif', score_2: 'Jarang inisiatif', score_3: 'Kadang berinisiatif', score_4: 'Sering inisiatif', score_5: 'Selalu proaktif dan inovatif' },
    { item_key: 'kedisiplinan_360', item_name: 'Kedisiplinan',            description: 'Disiplin waktu dan aturan sesuai penilaian rekan', score_1: 'Sering melanggar aturan', score_2: 'Kadang melanggar', score_3: 'Cukup disiplin', score_4: 'Disiplin', score_5: 'Sangat disiplin, jadi contoh' },
    { item_key: 'tanggung_jawab',   item_name: 'Tanggung Jawab Kerja',    description: 'Bertanggung jawab terhadap pekerjaan', score_1: 'Sering menghindari tanggung jawab', score_2: 'Kadang tidak bertanggung jawab', score_3: 'Cukup bertanggung jawab', score_4: 'Bertanggung jawab', score_5: 'Sangat bertanggung jawab' },
  ],
  MANAGER: [
    { item_key: 'kepemimpinan',       item_name: 'Kepemimpinan',              description: 'Kemampuan memimpin dan mengarahkan tim', score_1: 'Tidak menunjukkan kepemimpinan', score_2: 'Kepemimpinan lemah', score_3: 'Kepemimpinan cukup', score_4: 'Kepemimpinan baik', score_5: 'Kepemimpinan kuat dan inspiratif' },
    { item_key: 'komunikasi_arahan',  item_name: 'Komunikasi & Arahan',       description: 'Memberikan arahan yang jelas dan mudah dipahami', score_1: 'Arahan membingungkan', score_2: 'Arahan sering tidak jelas', score_3: 'Arahan cukup jelas', score_4: 'Arahan jelas', score_5: 'Arahan sangat jelas dan efektif' },
    { item_key: 'coaching_mgr',       item_name: 'Coaching Tim',              description: 'Membimbing dan mengembangkan anggota tim', score_1: 'Tidak ada coaching', score_2: 'Coaching sangat jarang', score_3: 'Coaching kadang-kadang', score_4: 'Coaching rutin', score_5: 'Coaching efektif, tim berkembang' },
    { item_key: 'integritas',         item_name: 'Integritas & Konsistensi',  description: 'Konsisten antara ucapan dan tindakan', score_1: 'Sering inkonsisten', score_2: 'Kadang tidak konsisten', score_3: 'Cukup konsisten', score_4: 'Konsisten', score_5: 'Sangat konsisten dan dipercaya' },
    { item_key: 'kolaborasi',         item_name: 'Kolaborasi Antar Divisi',   description: 'Bekerja sama lintas fungsi/divisi', score_1: 'Tidak mau kolaborasi', score_2: 'Jarang kolaborasi', score_3: 'Kolaborasi standar', score_4: 'Aktif kolaborasi', score_5: 'Kolaborasi excellent, jadi jembatan' },
  ],
}

const wb = xlsx.utils.book_new()

for (const role of ROLES) {
  const rows = items[role].map(i => ({
    item_key: i.item_key,
    item_name: i.item_name,
    weight_pct: i.weight_pct,
    description: i.description,
    score_1: i.score_1,
    score_2: i.score_2,
    score_3: i.score_3,
    score_4: i.score_4,
    score_5: i.score_5,
  }))
  const ws = xlsx.utils.json_to_sheet(rows)
  ws['!cols'] = [
    { wch: 22 }, { wch: 28 }, { wch: 12 }, { wch: 50 },
    { wch: 28 }, { wch: 28 }, { wch: 28 }, { wch: 28 }, { wch: 28 },
  ]
  xlsx.utils.book_append_sheet(wb, ws, role)
}

// 360° items sheets
for (const [group, list] of Object.entries(items360)) {
  const rows = list.map(i => ({
    item_key: i.item_key,
    item_name: i.item_name,
    description: i.description,
    score_1: i.score_1,
    score_2: i.score_2,
    score_3: i.score_3,
    score_4: i.score_4,
    score_5: i.score_5,
  }))
  const ws = xlsx.utils.json_to_sheet(rows)
  ws['!cols'] = [{ wch: 22 }, { wch: 28 }, { wch: 50 }, { wch: 28 }, { wch: 28 }, { wch: 28 }, { wch: 28 }, { wch: 28 }]
  xlsx.utils.book_append_sheet(wb, ws, `360_${group}`)
}

xlsx.writeFile(wb, 'KPI_Personal_Rekomendasi.xlsx')
console.log('Done: KPI_Personal_Rekomendasi.xlsx')
