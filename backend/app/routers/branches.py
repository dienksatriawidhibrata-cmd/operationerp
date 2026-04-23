from fastapi import APIRouter, Depends, HTTPException

from ..dependencies import get_supabase, require_auth

router = APIRouter(tags=["branches"], dependencies=[Depends(require_auth)])


@router.get("/branches")
def list_active_branches() -> dict:
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

    rows = response.data or []
    return {
        "count": len(rows),
        "items": rows,
    }
