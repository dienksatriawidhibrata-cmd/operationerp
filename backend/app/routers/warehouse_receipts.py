from datetime import datetime

from fastapi import APIRouter, Depends, Query
from fastapi.responses import PlainTextResponse

from ..dependencies import get_supabase, require_auth

router = APIRouter(tags=["warehouse-receipts"], dependencies=[Depends(require_auth)])


def _csv_cell(value) -> str:
    text = str(value if value is not None else "").replace('"', '""')
    return f'"{text}"'


def _matches_range(value: str | None, date_from: str | None, date_to: str | None) -> bool:
    if not value:
        return False
    base = value[:10]
    if date_from and base < date_from:
        return False
    if date_to and base > date_to:
        return False
    return True


def _load_receipts(status: str | None, date_from: str | None, date_to: str | None) -> list[dict]:
    supabase = get_supabase()

    sj_query = (
        supabase.table("surat_jalan")
        .select("id,sj_number,order_id,branch_id,tanggal_kirim,status,pengirim,issued_at,received_at,receive_note")
        .order("issued_at", desc=True)
    )
    if status:
        sj_query = sj_query.eq("status", status)
    sj_res = sj_query.execute()
    surat_jalan = sj_res.data or []

    if date_from or date_to:
        surat_jalan = [
            row for row in surat_jalan if _matches_range(row.get("received_at") or row.get("issued_at") or row.get("tanggal_kirim"), date_from, date_to)
        ]

    branch_ids = sorted({row["branch_id"] for row in surat_jalan})
    order_ids = sorted({row["order_id"] for row in surat_jalan if row.get("order_id")})
    sj_ids = [row["id"] for row in surat_jalan]

    branches_res = (
        supabase.table("branches")
        .select("id,name,store_id,district,area")
        .in_("id", branch_ids)
        .execute()
        if branch_ids
        else None
    )
    orders_res = (
        supabase.table("supply_orders")
        .select("id,order_number,status")
        .in_("id", order_ids)
        .execute()
        if order_ids
        else None
    )
    items_res = (
        supabase.table("surat_jalan_items")
        .select("id,sj_id,sku_code,sku_name,qty_kirim,qty_received,unit,receive_note")
        .in_("sj_id", sj_ids)
        .order("sku_name")
        .execute()
        if sj_ids
        else None
    )

    branches = {row["id"]: row for row in ((branches_res.data or []) if branches_res else [])}
    orders = {row["id"]: row for row in ((orders_res.data or []) if orders_res else [])}
    items = {}
    for row in ((items_res.data or []) if items_res else []):
        items.setdefault(row["sj_id"], []).append(row)

    results = []
    for sj in surat_jalan:
        receipt_items = items.get(sj["id"], [])
        discrepancy_count = len(
            [item for item in receipt_items if float(item.get("qty_received") or item.get("qty_kirim") or 0) != float(item.get("qty_kirim") or 0)]
        )
        results.append(
            {
                **sj,
                "branch": branches.get(sj["branch_id"]),
                "order": orders.get(sj.get("order_id")),
                "item_count": len(receipt_items),
                "discrepancy_count": discrepancy_count,
                "items": receipt_items,
            }
        )

    return results


@router.get("/warehouse/receipts")
def get_warehouse_receipts(
    status: str | None = Query(default="delivered"),
    date_from: str | None = Query(default=None, description="Filter tanggal awal YYYY-MM-DD"),
    date_to: str | None = Query(default=None, description="Filter tanggal akhir YYYY-MM-DD"),
) -> dict:
    items = _load_receipts(status, date_from, date_to)
    return {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "count": len(items),
        "items": items,
    }


@router.get("/warehouse/receipts.csv", response_class=PlainTextResponse)
def download_warehouse_receipts_csv(
    status: str | None = Query(default="delivered"),
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
) -> str:
    items = _load_receipts(status, date_from, date_to)
    rows = [
        [
            "SJ Number",
            "Store",
            "Store ID",
            "Order Number",
            "Tanggal Kirim",
            "Status",
            "Received At",
            "Item Count",
            "Discrepancy Count",
            "Receive Note",
        ]
    ]

    for item in items:
        rows.append(
            [
                item.get("sj_number"),
                item.get("branch", {}).get("name"),
                item.get("branch", {}).get("store_id"),
                item.get("order", {}).get("order_number"),
                item.get("tanggal_kirim"),
                item.get("status"),
                item.get("received_at"),
                item.get("item_count"),
                item.get("discrepancy_count"),
                item.get("receive_note"),
            ]
        )

    return "\n".join(",".join(_csv_cell(cell) for cell in row) for row in rows)
