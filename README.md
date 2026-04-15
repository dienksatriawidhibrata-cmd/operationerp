# Bagi Kopi Ops

ERP mini operasional untuk Bagi Kopi — berbasis React + Vite + Supabase, deploy di Netlify.

---

## Stack

| Layer       | Teknologi                              |
|-------------|----------------------------------------|
| Frontend    | React 18 + Vite + Tailwind CSS         |
| Database    | Supabase (PostgreSQL + Auth + RLS)     |
| File Upload | Google Drive via Google Apps Script    |
| Hosting     | Netlify                                |

---

## Setup — Urutan Langkah

### 1. Supabase

1. Buat project baru di [supabase.com](https://supabase.com)
2. Masuk ke **SQL Editor**
3. Jalankan file `supabase/migrations/001_schema.sql` (copy-paste seluruh isi)
4. Catat:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **Anon Key** → `VITE_SUPABASE_ANON_KEY`

### 2. Google Apps Script (Upload Foto)

1. Buat folder baru di [Google Drive](https://drive.google.com) untuk menyimpan foto
2. Klik kanan folder → **Get Link** → Salin ID dari URL
   ```
   drive.google.com/drive/folders/INI_ADALAH_FOLDER_ID
   ```
3. Buka [script.google.com](https://script.google.com) → **New Project**
4. Copy-paste seluruh isi `google-apps-script/upload.gs`
5. Ganti `YOUR_GOOGLE_DRIVE_FOLDER_ID_HERE` dengan ID folder tadi
6. Klik **Deploy** → **New Deployment**
   - Type: **Web App**
   - Execute as: **Me**
   - Who has access: **Anyone**
7. Klik **Deploy** → Salin **Web App URL**
   → Ini adalah `VITE_APPS_SCRIPT_URL`

### 3. Environment Variables

Duplikat `.env.example` menjadi `.env`:

```bash
cp .env.example .env
```

Isi semua nilai:

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/.../exec
```

### 4. Install dan Jalankan Lokal

```bash
npm install
npm run dev
```

Buka: `http://localhost:5173`

### 5. Buat User Pertama (Admin / OM)

1. Di Supabase → **Authentication** → **Users** → **Invite user**
2. Masukkan email dan kirim undangan
3. Setelah user klik link, login ke app
4. Di Supabase → **Table Editor** → `profiles`
5. Cari user tersebut, update kolom:
   - `role` → `ops_manager`
   - `managed_areas` → `{JKT,SBY,JBR,BTN}` (semua area)

### 6. Buat User Lainnya

Untuk setiap user (HS, Asst HS, DM, AM, Finance):

1. Invite via Supabase Auth atau minta register
2. Update profile di tabel `profiles`:

| Role                | `role`             | `branch_id` | `managed_districts` | `managed_areas` |
|---------------------|--------------------|--------------|--------------------|----------------|
| Staff               | `staff`            | ✓            | —                  | —              |
| Asst. Head Store    | `asst_head_store`  | ✓            | —                  | —              |
| Head Store          | `head_store`       | ✓            | —                  | —              |
| District Manager    | `district_manager` | —            | `{JKT}` atau lainnya | —            |
| Area Manager (JBR)  | `area_manager`     | —            | —                  | `{JBR}`        |
| Ops Manager         | `ops_manager`      | —            | —                  | `{JKT,SBY,JBR,BTN}` |
| Finance Supervisor  | `finance_supervisor`| —           | —                  | —              |

### 7. Deploy ke Netlify

**Cara otomatis (recommended):**

1. Push repo ke GitHub
2. Login ke [app.netlify.com](https://app.netlify.com)
3. **Add new site** → **Import from Git** → pilih repo
4. Build settings sudah otomatis terbaca dari `netlify.toml`
5. Tambahkan Environment Variables di Netlify:
   - Site settings → Environment variables
   - Tambahkan ketiga env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APPS_SCRIPT_URL`)
6. **Deploy site**

---

## Struktur Roles & Akses

| Role               | Akses                                                              |
|--------------------|--------------------------------------------------------------------|
| Staff / Asst. HS   | Ceklis harian, laporan, setoran, opex — cabang sendiri             |
| Head Store         | Sama seperti staff + bisa approve setoran di level toko            |
| District Manager   | Dashboard semua toko di district + approval setoran + daily visit  |
| Area Manager       | Sama DM tapi semua district di areanya                             |
| Ops Manager        | Full access semua toko + konfigurasi KPI                           |
| Finance Supervisor | Read-only semua setoran + audit approval (finance_status)          |

---

## Modul yang Tersedia

| Modul               | Who     | Fitur                                                    |
|---------------------|---------|----------------------------------------------------------|
| Ceklis Harian       | Staff   | Toggle per area, foto wajib, OOS list, timestamp otomatis |
| Laporan Harian      | Staff   | Net sales, kunjungan, staff hadir, avg spend auto        |
| Setoran Harian      | Staff   | Cash POS vs setor, foto slip, selisih auto, → DM approval |
| Beban Operasional   | Staff   | Search master code, qty × harga, foto nota               |
| DM Dashboard        | DM/AM   | Status semua toko real-time, compliance overview         |
| Daily Visit / Audit | DM/AM   | Scoring 22 item (1-5) + foto wajib per item             |
| Approval Setoran    | DM/AM   | Review, lihat foto, approve/reject dengan alasan         |
| Audit Setoran       | Finance | View semua setoran + foto inline, audit + flag           |

---

## Foto Upload — Alur

```
User upload foto (kamera/galeri)
    ↓
PhotoUpload component
    ↓
Base64 encode di browser
    ↓
POST ke Google Apps Script URL
    ↓
Apps Script simpan ke Drive folder
    ↓
Return: { url: "https://drive.google.com/uc?id=..." }
    ↓
URL disimpan di Supabase (TEXT[] column)
    ↓
PhotoViewer menampilkan inline via embed URL
```

---

## Tips Troubleshoot

**Upload foto gagal?**
- Pastikan `VITE_APPS_SCRIPT_URL` sudah benar
- Pastikan Apps Script di-deploy sebagai "Anyone" access
- Cek console browser untuk error CORS

**Tidak bisa login?**
- Pastikan user sudah confirm email (cek di Supabase Auth)
- Cek tabel `profiles` — harus ada row untuk user tersebut

**Dashboard DM kosong?**
- Cek kolom `managed_districts` di profiles: harus berisi array, e.g. `{JKT}`
- Cek kolom `district` di tabel `branches` — harus match persis
