# Panduan Penggunaan Aplikasi per Role

Dokumen ini adalah panduan operasional per role untuk aplikasi `Bagi Kopi Ops`.

Aturan update:
- Perbarui dokumen ini setiap kali ada perubahan `route`, `role access`, dashboard, atau alur approval.
- Sumber kebenaran utama untuk akses role ada di `src/App.jsx` dan `src/lib/access.js`.

## Ringkasan Role

| Role | Landing Page | Fokus Utama |
|---|---|---|
| `staff` | `/staff` lalu operasional harian | Ceklis, preparation, terima barang |
| `barista` | `/staff` lalu operasional harian | Ceklis, preparation, KPI personal, 360 |
| `kitchen` | `/staff` lalu operasional harian | Ceklis, preparation, KPI personal, 360 |
| `waitress` | `/staff` lalu operasional harian | Ceklis, preparation, KPI personal, 360 |
| `asst_head_store` | `/staff` lalu operasional harian | Ceklis, KPI personal, 360, tugas |
| `head_store` | `/staff` | Laporan harian, setoran, OPEX, KPI team, KPI personal, 360, tugas |
| `district_manager` | `/dm` | Monitoring toko, visit, approval setoran, input KPI Head Store, KPI report |
| `area_manager` | `/dm` | Monitoring area, visit, input KPI District Manager, verifikasi KPI Head Store |
| `ops_manager` | `/ops` | Command center, input/verifikasi KPI manager tertentu, monitoring retail, supply chain, trainer |
| `support_spv` | `/ops` | Input KPI Head Store dan District Manager, monitoring ops, support workflow |
| `support_admin` | `/ops` | Support operasional dan manajemen staf |
| `finance_supervisor` | `/finance` | Audit setoran dan monitoring finance |
| `trainer` | `/trainer` | Penilaian staff baru, staff lama, OJE |
| `purchasing_admin` | `/sc` | Supply order dan monitoring SC |
| `warehouse_admin` | `/sc` | Supply order, dashboard, SJ |
| `warehouse_spv` | `/sc` | Dashboard, order, SJ, monitoring gudang |
| `picking_spv` | `/sc/picking` | Picking |
| `qc_spv` | `/sc/qc` | QC |
| `distribution_spv` | `/sc/distribution` | Distribusi |
| `sc_supervisor` | `/sc` | Monitoring end-to-end supply chain |

## Panduan per Role

### 1. Staff Store: `staff`, `barista`, `kitchen`, `waitress`

Tujuan utama:
- Menyelesaikan operasional harian toko sesuai shift.
- Mengisi data harian yang menjadi dasar monitoring manager.

Menu utama:
- `/staff/ceklis`
- `/staff/preparation`
- `/sc/sj`
- `/kpi/personal`
- `/kpi/360`

Yang harus dilakukan:
- Isi ceklis sesuai shift aktif.
- Isi preparation sesuai shift bila memang bertugas.
- Lihat KPI personal untuk mengecek hasil penilaian.
- Isi penilaian 360 bila periode sedang dibuka.
- Konfirmasi penerimaan barang bila ada surat jalan.

Catatan:
- `barista`, `kitchen`, `waitress`, dan `asst_head_store` memiliki KPI personal.
- `staff` umum tidak menjadi target KPI personal di modul sekarang.

### 2. Asisten Kepala Toko: `asst_head_store`

Fokus:
- Operasional harian toko.
- Menyelesaikan tugas yang di-assign.
- Menjadi subjek KPI personal dan penilaian 360.

Menu utama:
- Semua menu store-level yang relevan.
- `/tasks`
- `/kpi/personal`
- `/kpi/360`

### 3. Kepala Toko: `head_store`

Fokus:
- Menutup operasional harian toko.
- Mengirim laporan dan setoran.
- Menginput OPEX.
- Menilai staff store.

Menu utama:
- `/staff/laporan`
- `/staff/opex`
- `/kpi/personal/input`
- `/kpi/personal`
- `/kpi/360`
- `/tasks`

Tanggung jawab utama:
- Submit laporan harian toko.
- Submit setoran cash untuk approval DM.
- Input pengeluaran operasional harian.
- Input KPI untuk `barista`, `kitchen`, `waitress`, dan `asst_head_store`.
- Isi penilaian 360 sesuai kebutuhan.

Catatan KPI:
- `head_store` sekarang juga menjadi target KPI manager-level.
- Penilaian `head_store` diisi oleh `district_manager` dan `support_spv`.
- Verifikasi KPI `head_store` dilakukan `area_manager`.

### 4. District Manager: `district_manager`

Fokus:
- Monitoring seluruh toko dalam distrik.
- Approval setoran.
- Audit visit.
- Input KPI untuk Head Store.

Menu utama:
- `/dm`
- `/dm/stores`
- `/dm/visits`
- `/dm/visit`
- `/dm/approval`
- `/kpi`
- `/kpi/personal/input`
- `/kpi/personal`

Tanggung jawab utama:
- Pantau ceklis, laporan, setoran, dan OPEX toko.
- Approve atau reject setoran.
- Lakukan daily visit/audit.
- Isi KPI `head_store` dalam scope distrik.

Catatan KPI:
- `district_manager` menjadi evaluator KPI untuk `head_store`.
- `district_manager` juga menjadi target KPI manager-level.
- Jika distrik memiliki `area_manager`, KPI `district_manager` diisi oleh `area_manager` dan `support_spv`.
- Jika distrik tidak memiliki `area_manager`, KPI `district_manager` diisi oleh `ops_manager` dan `support_spv`.

### 5. Area Manager: `area_manager`

Fokus:
- Monitoring area.
- Menutup gap district yang belum ter-cover penuh.
- Menilai District Manager.
- Memverifikasi KPI Head Store.

Menu utama:
- `/dm`
- `/dm/visits`
- `/dm/approval`
- `/ops/visits`
- `/kpi`
- `/kpi/personal/input`
- `/kpi/personal`

Tanggung jawab utama:
- Monitoring performa distrik dalam area.
- Isi KPI `district_manager`.
- Verifikasi KPI `head_store`.

### 6. Ops Manager: `ops_manager`

Fokus:
- Command center lintas retail, support, trainer, finance, dan supply chain.
- Menjadi verifier KPI manager-level tertentu.

Menu utama:
- `/ops`
- `/dm`
- `/tasks`
- `/support/staff`
- `/finance`
- `/opex`
- `/kpi`
- `/kpi/personal/input`
- `/kpi/personal`

Tanggung jawab utama:
- Pantau kondisi global operasional.
- Isi KPI `district_manager` untuk area yang belum punya `area_manager`.
- Verifikasi KPI `district_manager`.
- Kelola tugas support dan staff management.

### 7. Support Supervisor: `support_spv`

Fokus:
- Mendampingi workflow operasional lintas retail.
- Menjadi evaluator tambahan pada KPI manager-level.

Menu utama:
- `/ops`
- `/dm`
- `/tasks`
- `/kpi`
- `/kpi/personal/input`
- `/kpi/personal`
- `/trainer`
- `/sc`

Tanggung jawab utama:
- Isi KPI `head_store`.
- Isi KPI `district_manager`.
- Membantu tindak lanjut operasional dari pusat.

### 8. Support Admin: `support_admin`

Fokus:
- Operasional support dan administrasi pusat.

Menu utama:
- `/ops`
- `/support/staff`
- beberapa menu monitoring retail, trainer, dan SC sesuai akses

### 9. Finance Supervisor: `finance_supervisor`

Fokus:
- Audit setoran.
- Monitoring anomali finance.

Menu utama:
- `/finance`
- `/opex`

### 10. Trainer: `trainer`

Fokus:
- Penilaian staff baru.
- Penilaian staff lama.
- OJE individual dan batch.

Menu utama:
- `/trainer/staff-baru`
- `/trainer/staff-lama`
- `/trainer/oje`

### 11. Supply Chain Roles

#### `purchasing_admin`, `warehouse_admin`, `warehouse_spv`, `sc_supervisor`
- Gunakan `/sc` untuk dashboard.
- Gunakan `/sc/orders/new` untuk order bila role mengizinkan.
- Gunakan `/sc/sj` untuk surat jalan.

#### `picking_spv`
- Fokus di `/sc/picking`.

#### `qc_spv`
- Fokus di `/sc/qc`.

#### `distribution_spv`
- Fokus di `/sc/distribution`.

## Panduan Pemeliharaan Dokumen

Perbarui panduan ini jika ada perubahan berikut:
- role baru ditambahkan
- route baru ditambahkan
- flow approval berubah
- form manual berubah
- aturan KPI dan verifikasi berubah
- dashboard / quick action berubah

Checklist update cepat:
- cek `src/App.jsx`
- cek `src/lib/access.js`
- cek `src/components/BottomNav.jsx`
- cek halaman dashboard untuk quick actions
