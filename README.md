# Bagi Kopi Ops

ERP operasional berbasis React, Vite, dan Supabase.

Sekarang repo ini juga punya starter backend Python di folder `backend/` untuk kebutuhan API server-side memakai FastAPI + `supabase-py`.

## Stack

| Layer | Teknologi |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS |
| Database | Supabase (PostgreSQL + Auth + RLS) |
| File Upload | Google Drive via Google Apps Script |
| Hosting | Cloudflare Pages / static hosting |

## Environment Variables

Salin `.env.example` menjadi `.env`, lalu isi:

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/.../exec
VITE_GOOGLE_API_KEY=AIza...
VITE_GOOGLE_SOP_FOLDER_ID=your_google_sop_folder_id_here
VITE_GOOGLE_KPI_SHEET_ID=your_google_kpi_sheet_id_here
```

Catatan keamanan:
- Jangan commit `.env`.
- Jangan simpan `SUPABASE_SERVICE_ROLE_KEY` di frontend.
- Staff/store team bisa login dengan email saja memakai password bersama dari `VITE_STAFF_PASS`.
- Head Store dan role manager tetap login dengan email + password akun masing-masing.

## Setup Singkat

1. Buat project Supabase dan jalankan migration di `supabase/migrations/`.
2. Deploy `google-apps-script/upload.gs` sebagai web app dan isi `VITE_APPS_SCRIPT_URL`.
3. Isi seluruh env di `.env`.
4. Jalankan `npm install` lalu `npm run dev`.

## Python Backend Starter

Jika butuh backend terpisah untuk logic server-side:

1. Masuk ke folder `backend/`
2. Buat virtual environment Python
3. Install dependency dari `backend/requirements.txt`
4. Salin `backend/.env.example` menjadi `backend/.env`
5. Isi `SUPABASE_URL` dan `SUPABASE_KEY`
6. Jalankan `uvicorn app.main:app --reload`

Dokumentasi ringkasnya ada di `backend/README.md`.

## Auth

- Login staff toko menggunakan email + password bersama dari `VITE_STAFF_PASS`.
- Login Head Store, manager, finance, trainer, dan support memakai email + password Supabase masing-masing.
- Profil user harus tersedia di tabel `profiles`.
- Role dan scope akses dikontrol dari database dan helper access di frontend.

## Deploy

1. Push repo ke GitHub.
2. Deploy ke hosting statis pilihan.
3. Isi environment variables yang sama di dashboard hosting.

## Dokumentasi Operasional

Dokumen internal yang perlu dijaga tetap sinkron dengan aplikasi:

- `docs/ROLE_GUIDE.md` untuk panduan penggunaan per role
- `docs/CHANGE_NOTIFICATION_TEMPLATES.md` untuk draft pengumuman perubahan
- `docs/MANUAL_INPUT_SOP.md` untuk SOP pengisian data manual
- `docs/PROJECT_MAP.md` untuk peta struktur repo dan titik masuk file penting

## Struktur Folder

Folder yang paling sering dipakai:

- `src/` frontend app utama
- `supabase/migrations/` schema dan perubahan database yang harus berurutan
- `scripts/` script manual untuk import, export, dan konversi data
- `docs/` panduan operasional, handover, dan dokumentasi kerja
- `reference/` file referensi non-runtime seperti Excel master, PDF contoh, dan CSV acuan
- `google-apps-script/` script Apps Script terpisah

File referensi yang dulu tercecer di root sekarang dipindahkan ke:

- `reference/kpi/2026-kpi-retail.xlsx`
- `reference/warehouse/ContohAdminWH.pdf`
- `reference/imports/expense_codes_import.csv`
- `docs/handover/SYSTEM_SUMMARY_2026-04-21.txt`

## Security Checklist

- Rotate key jika `.env` pernah masuk git history.
- Restrict Google API key ke domain produksi.
- Review akses Google Apps Script karena endpoint upload bersifat publik.
- Hindari commit CSV staf atau data personal ke repo.
