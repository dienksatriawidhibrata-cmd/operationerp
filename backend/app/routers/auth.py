import time
from collections import defaultdict, deque

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from ..config import get_settings
from ..dependencies import get_supabase, get_supabase_anon
from ..utils import STORE_ROLES

router = APIRouter(tags=["auth"])

_ATTEMPTS: dict[str, deque[float]] = defaultdict(deque)
_WINDOW_SECONDS = 300
_MAX_ATTEMPTS = 8
_STAFF_LOGIN_ROLES = STORE_ROLES | {"auditor"}


class StaffLoginPayload(BaseModel):
    email: str


def _consume_attempt(key: str) -> None:
    now = time.time()
    bucket = _ATTEMPTS[key]

    while bucket and now - bucket[0] > _WINDOW_SECONDS:
        bucket.popleft()

    if len(bucket) >= _MAX_ATTEMPTS:
        raise HTTPException(status_code=429, detail="Terlalu banyak percobaan login. Coba lagi sebentar.")

    bucket.append(now)


@router.post("/auth/staff-login")
def staff_login(payload: StaffLoginPayload, request: Request) -> dict:
    settings = get_settings()
    if not settings.staff_shared_password:
        raise HTTPException(status_code=503, detail="STAFF_SHARED_PASSWORD belum diisi di backend.")

    normalized_email = payload.email.strip().lower()
    remote_ip = request.client.host if request.client else "unknown"
    _consume_attempt(f"{remote_ip}:{normalized_email}")

    supabase = get_supabase()
    try:
        profile_res = (
            supabase.table("profiles")
            .select("id,email,role,is_active")
            .ilike("email", normalized_email)
            .maybe_single()
            .execute()
        )
        profile = profile_res.data
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Gagal menghubungi database. Coba lagi.") from exc

    if not profile or profile.get("role") not in _STAFF_LOGIN_ROLES or profile.get("is_active") is False:
        raise HTTPException(status_code=401, detail="Email tidak terdaftar untuk login staff.")

    auth_client = get_supabase_anon()
    try:
        result = auth_client.auth.sign_in_with_password(
            {
                "email": normalized_email,
                "password": settings.staff_shared_password,
            }
        )
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Login staff gagal diproses.") from exc

    session = getattr(result, "session", None)
    user = getattr(result, "user", None)
    if not session or not user:
        raise HTTPException(status_code=401, detail="Login staff gagal diproses.")

    return {
        "access_token": session.access_token,
        "refresh_token": session.refresh_token,
        "expires_at": session.expires_at,
        "user": {
            "id": user.id,
            "email": user.email,
        },
    }
