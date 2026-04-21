# Project Map

Dokumen ini dibuat untuk memudahkan sesi baru di Codex, Claude Code, atau developer lain memahami letak file penting tanpa perlu menebak-nebak.

## Mulai Dari Sini

- `README.md`
  Ringkasan proyek, setup, auth, dan lokasi dokumentasi utama.
- `docs/PROJECT_MAP.md`
  Peta struktur repo dan fungsi setiap folder penting.
- `src/App.jsx`
  Pusat routing dan pembagian akses halaman berdasarkan role.
- `src/lib/access.js`
  Sumber utama daftar role, akses KPI, supply chain, task, dan helper scope.
- `src/contexts/AuthContext.jsx`
  Alur login, session hydration, load profile, dan sign out.

## Struktur Utama

### `src/`

Frontend React + Vite.

- `src/App.jsx`
  Semua route utama.
- `src/pages/`
  Halaman berdasarkan domain:
  - `staff/` untuk operasional toko
  - `dm/` untuk district/area manager
  - `ops/` untuk ops/support
  - `kpi/` untuk KPI personal, input KPI, KPI report, dan 360
  - `trainer/`, `finance/`, `sc/`, `support/`, `tasks/`
- `src/components/`
  Komponen reusable dan navigasi.
- `src/components/ui/AppKit.jsx`
  UI primitives utama.
- `src/lib/`
  Helper aplikasi:
  - `access.js` role dan permission
  - `supabase.js` client
  - `utils.js` formatter + helper period/date
  - `googleApis.js` akses Google Drive/Sheets
- `src/data/`
  Data statis yang sudah dikonversi dari file referensi.

### `supabase/`

Semua yang berkaitan dengan database.

- `supabase/migrations/`
  Migration resmi yang harus dijalankan berurutan.
- `supabase/auth_profile_audit.sql`
- `supabase/auth_profile_fix.sql`
- `supabase/ops_manager_account_setup.sql`
  Script manual tambahan di luar urutan migration utama.

### `scripts/`

Script utilitas manual. Tidak dipakai runtime frontend.

- `convert-kpi.cjs`
  Konversi `reference/kpi/2026-kpi-retail.xlsx` ke `src/data/kpi2026.js`
- `export-kpi-sql.cjs`
  Generate seed SQL KPI report dari `src/data/kpi2026.js`
- `generate-kpi-personal.mjs`
  Generator Excel rekomendasi KPI personal
- `import-staff.js`
  Bulk create user staff
- `fix-branch.js`
  Audit dan perbaiki `branch_id` di profiles
- `upload-sop.js`
  Upload SOP
- script lain di folder ini adalah utilitas operasional/manual

### `docs/`

Dokumentasi kerja.

- `ROLE_GUIDE.md`
  Panduan penggunaan aplikasi per role
- `CHANGE_NOTIFICATION_TEMPLATES.md`
  Template pengumuman perubahan
- `MANUAL_INPUT_SOP.md`
  SOP input manual
- `handover/`
  Snapshot/handover lama yang masih berguna sebagai konteks, bukan sumber kebenaran terbaru

### `reference/`

File referensi non-runtime. Aman disimpan untuk acuan, tapi tidak dibaca langsung oleh aplikasi saat runtime.

- `reference/kpi/2026-kpi-retail.xlsx`
  Master KPI Excel acuan konversi
- `reference/warehouse/ContohAdminWH.pdf`
  Contoh dokumen warehouse/admin
- `reference/imports/expense_codes_import.csv`
  CSV referensi import kode biaya

### `google-apps-script/`

Script terpisah untuk deployment Apps Script.

## File Yang Biasanya Dicari Dulu

Kalau tugasnya tentang:

- Login / auth:
  `src/pages/Login.jsx`, `src/contexts/AuthContext.jsx`, `src/App.jsx`
- Routing / role access:
  `src/App.jsx`, `src/lib/access.js`
- KPI personal:
  `src/pages/kpi/KPIPersonalPage.jsx`, `src/pages/kpi/KPIPersonalInputPage.jsx`, `supabase/migrations/013_kpi_personal.sql`, `014_kpi_personal_manager_workflow.sql`, `015_seed_manager_kpi_items.sql`
- KPI 360:
  `src/pages/kpi/PeerReview360Page.jsx`, `supabase/migrations/013_kpi_personal.sql`
- Dashboard store:
  `src/pages/staff/Home.jsx`
- Dashboard manager:
  `src/pages/dm/Dashboard.jsx`
- Ops / support:
  `src/pages/ops/Hub.jsx`
- Supply chain:
  `src/pages/sc/*`
- OJE / trainer:
  `src/pages/trainer/*`, `supabase/migrations/010_oje_tables.sql`

## Aturan Praktis Biar Tidak Bingung

- Jangan taruh file referensi baru di root jika bukan file runtime/config proyek.
- Simpan file Excel/PDF/CSV acuan ke `reference/`.
- Simpan dokumentasi kerja ke `docs/`.
- Simpan script sekali-jalankan atau utilitas manual ke `scripts/`.
- Untuk perubahan database resmi, pakai `supabase/migrations/` dengan nomor urut baru.
- Jika hanya script SQL manual/audit, simpan tetap di `supabase/` dan beri nama yang menjelaskan tujuan.

## Root Folder Yang Seharusnya Tersisa

Root repo idealnya hanya berisi:

- config proyek (`package.json`, `vite.config.js`, `tailwind.config.js`, `.env.example`)
- folder utama (`src`, `supabase`, `scripts`, `docs`, `reference`, `google-apps-script`)
- artefak build lokal (`dist`) bila ada

Kalau nanti ada file loose baru di root, besar kemungkinan file itu perlu dipindahkan ke salah satu folder di atas.
