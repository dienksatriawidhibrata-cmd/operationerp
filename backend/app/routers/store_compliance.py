from fastapi import APIRouter, Query

from ..dependencies import get_supabase
from ..utils import jakarta_today, jakarta_yesterday, parse_iso_date

router = APIRouter(tags=["store-compliance"])


def _bool_map(rows: list[dict], branch_id: str, shift: str) -> bool:
    return any(row.get("branch_id") == branch_id and row.get("shift") == shift for row in rows)


@router.get("/store-compliance/summary")
def get_store_compliance_summary(
    date: str | None = Query(default=None, description="Tanggal ceklis format YYYY-MM-DD"),
    report_date: str | None = Query(default=None, description="Tanggal laporan/setoran format YYYY-MM-DD"),
) -> dict:
    target_date = parse_iso_date(date, jakarta_today())
    target_report_date = parse_iso_date(report_date, jakarta_yesterday())
    supabase = get_supabase()

    branches_res = (
        supabase.table("branches")
        .select("id,name,store_id,district,area,is_active")
        .eq("is_active", True)
        .order("name")
        .execute()
    )
    branches = branches_res.data or []
    branch_ids = [branch["id"] for branch in branches]

    checklists_res = (
        supabase.table("daily_checklists")
        .select("id,branch_id,shift,tanggal,submitted_at")
        .in_("branch_id", branch_ids)
        .eq("tanggal", target_date.isoformat())
        .execute()
    )
    preparation_res = (
        supabase.table("daily_preparation")
        .select("id,branch_id,shift,tanggal")
        .in_("branch_id", branch_ids)
        .eq("tanggal", target_date.isoformat())
        .execute()
    )
    reports_res = (
        supabase.table("daily_reports")
        .select("id,branch_id,tanggal,submitted_at,net_sales")
        .in_("branch_id", branch_ids)
        .eq("tanggal", target_report_date.isoformat())
        .execute()
    )
    deposits_res = (
        supabase.table("daily_deposits")
        .select("id,branch_id,tanggal,status,submitted_at,approved_at,selisih")
        .in_("branch_id", branch_ids)
        .eq("tanggal", target_report_date.isoformat())
        .execute()
    )

    checklists = checklists_res.data or []
    preparations = preparation_res.data or []
    reports = reports_res.data or []
    deposits = deposits_res.data or []

    report_by_branch = {item["branch_id"]: item for item in reports}
    deposit_by_branch = {item["branch_id"]: item for item in deposits}

    stores = []
    for branch in branches:
        branch_id = branch["id"]
        stores.append(
            {
                "branch_id": branch_id,
                "store_id": branch["store_id"],
                "name": branch["name"],
                "district": branch["district"],
                "area": branch["area"],
                "checklist": {
                    "pagi": _bool_map(checklists, branch_id, "pagi"),
                    "middle": _bool_map(checklists, branch_id, "middle"),
                    "malam": _bool_map(checklists, branch_id, "malam"),
                },
                "preparation": {
                    "pagi": _bool_map(preparations, branch_id, "pagi"),
                    "middle": _bool_map(preparations, branch_id, "middle"),
                    "malam": _bool_map(preparations, branch_id, "malam"),
                },
                "daily_report": bool(report_by_branch.get(branch_id)),
                "deposit": {
                    "exists": bool(deposit_by_branch.get(branch_id)),
                    "status": deposit_by_branch.get(branch_id, {}).get("status"),
                    "selisih": deposit_by_branch.get(branch_id, {}).get("selisih"),
                },
            }
        )

    def count_true(selector):
        return len([store for store in stores if selector(store)])

    return {
        "date": target_date.isoformat(),
        "report_date": target_report_date.isoformat(),
        "total_stores": len(stores),
        "summary": {
            "checklist_pagi": count_true(lambda store: store["checklist"]["pagi"]),
            "checklist_middle": count_true(lambda store: store["checklist"]["middle"]),
            "checklist_malam": count_true(lambda store: store["checklist"]["malam"]),
            "prep_pagi": count_true(lambda store: store["preparation"]["pagi"]),
            "prep_middle": count_true(lambda store: store["preparation"]["middle"]),
            "prep_malam": count_true(lambda store: store["preparation"]["malam"]),
            "daily_report": count_true(lambda store: store["daily_report"]),
            "deposit_submitted_or_better": count_true(lambda store: store["deposit"]["exists"]),
            "deposit_approved": count_true(lambda store: store["deposit"]["status"] == "approved"),
        },
        "stores": stores,
    }
