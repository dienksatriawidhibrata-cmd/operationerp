# Bagi Kopi Ops

ERP operasional berbasis React, Vite, dan Supabase.

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
- Semua user harus login dengan password akun masing-masing.

## Setup Singkat

1. Buat project Supabase dan jalankan migration di `supabase/migrations/`.
2. Deploy `google-apps-script/upload.gs` sebagai web app dan isi `VITE_APPS_SCRIPT_URL`.
3. Isi seluruh env di `.env`.
4. Jalankan `npm install` lalu `npm run dev`.

## Auth

- Login memakai email + password Supabase untuk semua role.
- Profil user harus tersedia di tabel `profiles`.
- Role dan scope akses dikontrol dari database dan helper access di frontend.

## Deploy

1. Push repo ke GitHub.
2. Deploy ke hosting statis pilihan.
3. Isi environment variables yang sama di dashboard hosting.

## Security Checklist

- Rotate key jika `.env` pernah masuk git history.
- Restrict Google API key ke domain produksi.
- Review akses Google Apps Script karena endpoint upload bersifat publik.
- Hindari commit CSV staf atau data personal ke repo.
