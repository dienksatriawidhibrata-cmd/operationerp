# Python Backend Starter

Starter backend terpisah untuk kebutuhan server-side memakai FastAPI dan `supabase-py`.

## Fitur awal

- FastAPI app dengan route `/health`
- route contoh `/api/branches` untuk baca toko aktif dari Supabase
- `/api/manager-visits/summary` untuk status submit AM/DM
- `/api/store-compliance/summary` untuk ringkasan ceklis, prep, laporan, dan setoran toko
- `/api/warehouse/receipts` dan `/api/warehouse/receipts.csv` untuk laporan penerimaan barang toko
- config env terpusat
- CORS untuk frontend lokal

## Setup

1. Masuk ke folder `backend/`
2. Buat virtual environment
3. Install dependency
4. Salin `.env.example` menjadi `.env`
5. Isi `SUPABASE_URL` dan `SUPABASE_KEY`
6. Jalankan server

## Command

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

## Catatan

- Gunakan `SUPABASE_KEY` dari service role hanya di backend, jangan di frontend.
- Endpoint contoh ini memang membaca semua branch aktif, jadi cocok untuk logic server-side atau admin API.
