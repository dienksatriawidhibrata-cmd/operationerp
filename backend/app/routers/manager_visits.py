from fastapi import APIRouter, Query

from ..dependencies import get_supabase
from ..utils import jakarta_today, parse_iso_date, score_percent

router = APIRouter(tags=["manager-visits"])


def _can_manager_access_branch(manager: dict, branch: dict) -> bool:
    if manager.get("role") == "district_manager":
        return branch.get("district") in (manager.get("managed_districts") or [])
    if manager.get("role") == "area_manager":
        return branch.get("area") in (manager.get("managed_areas") or [])
    return False


@router.get("/manager-visits/summary")
def get_manager_visit_summary(date: str | None = Query(default=None, description="Tanggal visit format YYYY-MM-DD")) -> dict:
    target_date = parse_iso_date(date, jakarta_today()).isoformat()
    supabase = get_supabase()

    managers_res = (
        supabase.table("profiles")
        .select("id,full_name,role,managed_districts,managed_areas,is_active")
        .in_("role", ["district_manager", "area_manager"])
        .eq("is_active", True)
        .order("full_name")
        .execute()
    )
    branches_res = (
        supabase.table("branches")
        .select("id,name,store_id,district,area,is_active")
        .eq("is_active", True)
        .order("name")
        .execute()
    )
    visits_res = (
        supabase.table("daily_visits")
        .select("id,branch_id,tanggal,total_score,max_score,auditor_id,created_at")
        .eq("tanggal", target_date)
        .order("created_at")
        .execute()
    )

    managers = managers_res.data or []
    branches = branches_res.data or []
    visits = visits_res.data or []

    items = []
    for manager in managers:
        scoped_branches = [branch for branch in branches if _can_manager_access_branch(manager, branch)]
        scoped_branch_ids = {branch["id"] for branch in scoped_branches}
        manager_visits = [visit for visit in visits if visit.get("auditor_id") == manager["id"] and visit.get("branch_id") in scoped_branch_ids]

        branch_visit_details = []
        visited_branch_ids = set()
        for visit in manager_visits:
            branch = next((item for item in scoped_branches if item["id"] == visit.get("branch_id")), None)
            if not branch:
                continue
            visited_branch_ids.add(branch["id"])
            branch_visit_details.append(
                {
                    "visit_id": visit["id"],
                    "branch_id": branch["id"],
                    "branch_name": branch["name"],
                    "store_id": branch["store_id"],
                    "score_percent": score_percent(visit.get("total_score"), visit.get("max_score")),
                    "total_score": visit.get("total_score"),
                    "max_score": visit.get("max_score"),
                }
            )

        items.append(
            {
                "id": manager["id"],
                "full_name": manager["full_name"],
                "role": manager["role"],
                "role_label": "District Manager" if manager["role"] == "district_manager" else "Area Manager",
                "managed_store_count": len(scoped_branches),
                "daily_target": 1,
                "submitted_count": 1 if manager_visits else 0,
                "visits_today": len(manager_visits),
                "visited_store_count": len(visited_branch_ids),
                "unvisited_store_count": max(len(scoped_branches) - len(visited_branch_ids), 0),
                "branches_visited": branch_visit_details,
            }
        )

    items = [item for item in items if item["managed_store_count"] > 0]
    items.sort(key=lambda item: (0 if item["role"] == "district_manager" else 1, item["full_name"].lower()))

    return {
        "date": target_date,
        "total_managers": len(items),
        "submitted_managers": len([item for item in items if item["submitted_count"] > 0]),
        "items": items,
    }
