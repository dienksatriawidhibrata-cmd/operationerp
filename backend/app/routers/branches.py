from fastapi import APIRouter, Depends, HTTPException

from ..dependencies import get_supabase, require_auth
from ..utils import scope_branches

router = APIRouter(tags=["branches"])


@router.get("/branches")
def list_active_branches(current_user: dict = Depends(require_auth)) -> dict:
    supabase = get_supabase()
    response = (
        supabase.table("branches")
        .select("id,name,store_id,district,area,is_active")
        .eq("is_active", True)
        .order("name")
        .execute()
    )

    if getattr(response, "error", None):
        raise HTTPException(status_code=500, detail=str(response.error))

    rows = scope_branches(response.data or [], current_user)
    return {
        "count": len(rows),
        "items": rows,
    }
