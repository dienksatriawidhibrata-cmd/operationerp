from datetime import date, datetime, timedelta, timezone


JAKARTA_TZ = timezone(timedelta(hours=7))
STORE_ROLES = {"staff", "barista", "kitchen", "waitress", "asst_head_store", "head_store"}
SUPPORT_ROLES = {"support_spv", "support_admin"}
SUPPLY_CHAIN_ROLES = {
    "sc_supervisor",
    "purchasing_admin",
    "warehouse_admin",
    "warehouse_spv",
    "picking_spv",
    "qc_spv",
    "distribution_spv",
}
SOP_ALLOWED_ROLES = STORE_ROLES | {"district_manager", "area_manager", "ops_manager", "trainer"} | SUPPORT_ROLES | SUPPLY_CHAIN_ROLES


def jakarta_today() -> date:
    return datetime.now(JAKARTA_TZ).date()


def jakarta_yesterday() -> date:
    return jakarta_today() - timedelta(days=1)


def parse_iso_date(value: str | None, fallback: date) -> date:
    if not value:
        return fallback
    return date.fromisoformat(value)


def score_percent(total_score: int | float | None, max_score: int | float | None) -> int:
    total = float(total_score or 0)
    maximum = float(max_score or 0)
    if maximum <= 0:
        return 0
    return round((total / maximum) * 100)


def profile_can_access_branch(profile: dict | None, branch: dict | None) -> bool:
    if not profile or not branch or profile.get("is_active") is False:
        return False

    role = profile.get("role")
    branch_id = branch.get("id")

    if role in STORE_ROLES:
        return branch_id == profile.get("branch_id")
    if role == "district_manager":
        return branch.get("district") in (profile.get("managed_districts") or [])
    if role == "area_manager":
        return branch.get("area") in (profile.get("managed_areas") or [])
    if role in {"ops_manager", "finance_supervisor", "auditor"} | SUPPORT_ROLES | SUPPLY_CHAIN_ROLES:
        return True

    return False


def scope_branches(branches: list[dict], profile: dict | None) -> list[dict]:
    return [branch for branch in (branches or []) if profile_can_access_branch(profile, branch)]


def can_access_sop(profile: dict | None) -> bool:
    return bool(profile and profile.get("is_active") is not False and profile.get("role") in SOP_ALLOWED_ROLES)
