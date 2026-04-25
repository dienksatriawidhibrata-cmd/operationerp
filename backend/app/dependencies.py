from functools import lru_cache

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from supabase import Client, create_client

from .config import get_settings

_bearer = HTTPBearer(auto_error=False)
_PROFILE_FIELDS = "id,full_name,email,role,branch_id,managed_districts,managed_areas,is_active,branch:branches(id,name,store_id,district,area)"


@lru_cache
def get_supabase() -> Client:
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_key)


@lru_cache
def get_supabase_anon() -> Client:
    settings = get_settings()
    if not settings.supabase_anon_key:
        raise HTTPException(status_code=503, detail="SUPABASE_ANON_KEY belum diisi di backend.")
    return create_client(settings.supabase_url, settings.supabase_anon_key)


def get_profile_by_user_id(user_id: str, supabase: Client) -> dict:
    response = (
        supabase.table("profiles")
        .select(_PROFILE_FIELDS)
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )
    profile = response.data
    if not profile:
        raise HTTPException(status_code=403, detail="Profil user tidak ditemukan.")
    return profile


def require_auth(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    supabase: Client = Depends(get_supabase),
) -> dict:
    if not credentials:
        raise HTTPException(status_code=401, detail="Authorization header diperlukan.")
    try:
        result = supabase.auth.get_user(credentials.credentials)
        if not result.user:
            raise HTTPException(status_code=401, detail="Token tidak valid.")
        profile = get_profile_by_user_id(result.user.id, supabase)
        if profile.get("is_active") is False:
            raise HTTPException(status_code=403, detail="Akun dinonaktifkan.")
        profile["auth_email"] = result.user.email
        return profile
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Token tidak valid atau kedaluwarsa.") from exc
