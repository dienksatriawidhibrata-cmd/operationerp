#!/usr/bin/env pwsh
# update-pos-data.ps1
# Rebuild bagikopi.db dari CSV/XLSX terbaru, lalu sync ke Supabase.
# Jalankan setiap kali ada file CSV/XLSX baru di Data Sales / Data Komplain.
#
# Usage (dari root project):
#   powershell -ExecutionPolicy Bypass -File scripts\update-pos-data.ps1

$SALES_PROJECT = "C:\Users\dksat\Project\2026-bagikopi-sales-complain"
$OPS_ROOT      = $PSScriptRoot | Split-Path -Parent

Write-Host ""
Write-Host "=== Step 1: Rebuild bagikopi.db dari CSV/XLSX ===" -ForegroundColor Cyan
python "$SALES_PROJECT\app\etl.py"
if ($LASTEXITCODE -ne 0) {
    Write-Host "ETL gagal. Sync dibatalkan." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== Step 2: Sync ke Supabase ===" -ForegroundColor Cyan
python "$OPS_ROOT\scripts\sync-pos-to-supabase.py"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Sync gagal." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Selesai! Data Sales & Komplain sudah diperbarui di Supabase." -ForegroundColor Green
