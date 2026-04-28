#!/usr/bin/env python3
"""
Sync SQLite POS data (bagikopi.db) → Supabase pos_sales_monthly + pos_complaints.
UPSERT-safe: aman dijalankan berulang.

Usage:
    python scripts/sync-pos-to-supabase.py

Requires .env in project root:
    SUPABASE_URL=https://xxx.supabase.co
    SUPABASE_SERVICE_ROLE_KEY=eyJ...
"""

import os
import sqlite3
import sys
from pathlib import Path

import httpx
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = Path(r"C:\Users\dksat\Project\2026-bagikopi-sales-complain\bagikopi.db")

load_dotenv(ROOT / ".env")

SUPABASE_URL = os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib di .env")
    sys.exit(1)

UPSERT_HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates",
}
INSERT_HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}

BATCH = 500


def supabase_upsert(table: str, rows: list[dict], on_conflict: str):
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    params = {"on_conflict": on_conflict}
    for i in range(0, len(rows), BATCH):
        chunk = rows[i : i + BATCH]
        resp = httpx.post(url, json=chunk, headers=UPSERT_HEADERS, params=params, timeout=60)
        if resp.status_code not in (200, 201):
            print(f"  ERROR batch {i}–{i+len(chunk)}: {resp.status_code} {resp.text[:300]}")
            sys.exit(1)
        print(f"  upsert {table}: {i+len(chunk)}/{len(rows)}", end="\r")
    print(f"  upsert {table}: {len(rows)} rows OK     ")


def supabase_delete_all(table: str):
    """Delete semua baris dari tabel (untuk table tanpa unique key)."""
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    resp = httpx.delete(url, headers=INSERT_HEADERS, params={"id": "not.is.null"}, timeout=60)
    if resp.status_code not in (200, 204):
        print(f"  ERROR delete {table}: {resp.status_code} {resp.text[:300]}")
        sys.exit(1)
    print(f"  Cleared {table}")


def supabase_insert(table: str, rows: list[dict]):
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    for i in range(0, len(rows), BATCH):
        chunk = rows[i : i + BATCH]
        resp = httpx.post(url, json=chunk, headers=INSERT_HEADERS, timeout=60)
        if resp.status_code not in (200, 201):
            print(f"  ERROR batch {i}–{i+len(chunk)}: {resp.status_code} {resp.text[:300]}")
            sys.exit(1)
        print(f"  insert {table}: {i+len(chunk)}/{len(rows)}", end="\r")
    print(f"  insert {table}: {len(rows)} rows OK     ")


def fetch_branch_map(conn: sqlite3.Connection) -> dict[str, str | None]:
    """outlet_name → branch_id from Supabase branches (name matching)."""
    outlets = [row[0] for row in conn.execute("SELECT DISTINCT name FROM outlets")]
    resp = httpx.get(
        f"{SUPABASE_URL}/rest/v1/branches",
        params={"select": "id,name", "is_active": "eq.true"},
        headers=INSERT_HEADERS,
        timeout=30,
    )
    branches = resp.json() if resp.status_code == 200 else []
    branch_map: dict[str, str | None] = {}
    for outlet in outlets:
        match = next(
            (b["id"] for b in branches if outlet.lower() in b["name"].lower() or b["name"].lower() in outlet.lower()),
            None,
        )
        branch_map[outlet] = match
    return branch_map


def build_sales_rows(conn: sqlite3.Connection, branch_map: dict) -> list[dict]:
    rows = conn.execute("""
        SELECT outlet, year, month,
               SUM(total_net)       AS net_sales,
               SUM(total_gross)     AS gross_sales,
               SUM(total_discounts) AS discounts,
               SUM(txn_count)       AS transactions
        FROM sales_agg
        GROUP BY outlet, year, month
    """).fetchall()
    result = []
    for outlet, year, month, net, gross, disc, txns in rows:
        result.append({
            "outlet_name": outlet,
            "branch_id": branch_map.get(outlet),
            "year": year,
            "month": month,
            "net_sales": round(float(net or 0), 2),
            "gross_sales": round(float(gross or 0), 2),
            "discounts": round(float(disc or 0), 2),
            "transactions": int(txns or 0),
        })
    return result


def build_complaints_rows(conn: sqlite3.Connection, branch_map: dict) -> list[dict]:
    rows = conn.execute("""
        SELECT complaint_date, year, month, app, outlet,
               complaint_text, priority, topic, follow_up
        FROM complaints
    """).fetchall()
    result = []
    for date, year, month, app, outlet, text, priority, topic, follow_up in rows:
        result.append({
            "outlet_name": outlet or "",
            "branch_id": branch_map.get(outlet),
            "complaint_date": date,
            "year": year,
            "month": month,
            "app": app,
            "topic": topic,
            "priority": priority,
            "complaint_text": text,
            "follow_up": follow_up,
        })
    return result


def main():
    if not DB_PATH.exists():
        print(f"ERROR: DB tidak ditemukan di {DB_PATH}")
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH)

    print("Fetching branch map dari Supabase...")
    branch_map = fetch_branch_map(conn)
    matched = sum(1 for v in branch_map.values() if v)
    print(f"  {matched}/{len(branch_map)} outlet ter-match ke branches")

    print("\nBuilding pos_sales_monthly...")
    sales_rows = build_sales_rows(conn, branch_map)
    print(f"  {len(sales_rows)} rows")
    supabase_upsert("pos_sales_monthly", sales_rows, on_conflict="outlet_name,year,month")

    print("\nBuilding pos_complaints...")
    complaint_rows = build_complaints_rows(conn, branch_map)
    print(f"  {len(complaint_rows)} rows")
    supabase_delete_all("pos_complaints")
    supabase_insert("pos_complaints", complaint_rows)

    conn.close()
    print("\nSync selesai.")


if __name__ == "__main__":
    main()
