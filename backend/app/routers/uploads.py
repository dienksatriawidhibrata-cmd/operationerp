from io import BytesIO
import json

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload

from ..config import get_settings
from ..dependencies import require_auth

router = APIRouter(tags=["uploads"])
UPLOAD_SCOPES = ["https://www.googleapis.com/auth/drive"]


def _folder_query(parent_id: str, name: str) -> str:
    safe_name = name.replace("'", "\\'")
    return (
        f"'{parent_id}' in parents and trashed = false and "
        "mimeType = 'application/vnd.google-apps.folder' and "
        f"name = '{safe_name}'"
    )


def _build_upload_credentials():
    settings = get_settings()

    if settings.google_service_account_json:
        info = json.loads(settings.google_service_account_json)
        return service_account.Credentials.from_service_account_info(info, scopes=UPLOAD_SCOPES)

    if settings.google_service_account_file:
        return service_account.Credentials.from_service_account_file(
            settings.google_service_account_file,
            scopes=UPLOAD_SCOPES,
        )

    raise HTTPException(
        status_code=503,
        detail="Google Drive upload belum dikonfigurasi di backend.",
    )


def _get_drive_service():
    credentials = _build_upload_credentials()
    return build("drive", "v3", credentials=credentials, cache_discovery=False)


def _ensure_folder_path(drive, root_folder_id: str, folder_path: str) -> str:
    current_parent = root_folder_id
    for raw_part in (folder_path or "general").split("/"):
        part = raw_part.strip()
        if not part:
            continue

        response = (
            drive.files()
            .list(
                q=_folder_query(current_parent, part),
                fields="files(id,name)",
                pageSize=1,
            )
            .execute()
        )
        items = response.get("files", [])
        if items:
            current_parent = items[0]["id"]
            continue

        created = (
            drive.files()
            .create(
                body={
                    "name": part,
                    "mimeType": "application/vnd.google-apps.folder",
                    "parents": [current_parent],
                },
                fields="id",
            )
            .execute()
        )
        current_parent = created["id"]

    return current_parent


@router.post("/uploads/drive")
async def upload_drive_file(
    current_user: dict = Depends(require_auth),
    file: UploadFile = File(...),
    folder: str = Form(default="general"),
) -> dict:
    role = current_user.get("role")
    if role in {"auditor", "finance_supervisor"}:
        raise HTTPException(status_code=403, detail="Role ini tidak diizinkan upload file.")

    settings = get_settings()
    root_folder_id = settings.resolved_google_upload_root_folder_id
    if not root_folder_id:
        raise HTTPException(status_code=503, detail="GOOGLE_UPLOAD_ROOT_FOLDER_ID belum diisi.")

    payload = await file.read()
    if not payload:
        raise HTTPException(status_code=400, detail="File kosong.")

    drive = _get_drive_service()
    target_folder_id = _ensure_folder_path(drive, root_folder_id, folder)
    media = MediaIoBaseUpload(BytesIO(payload), mimetype=file.content_type or "application/octet-stream", resumable=False)
    created = (
        drive.files()
        .create(
            body={
                "name": file.filename or "upload.bin",
                "parents": [target_folder_id],
            },
            media_body=media,
            fields="id,name,webViewLink",
        )
        .execute()
    )

    try:
        drive.permissions().create(
            fileId=created["id"],
            body={"type": "anyone", "role": "reader"},
        ).execute()
    except Exception:
        # Preview tetap bisa memakai webViewLink jika permission publik gagal dibuat.
        pass

    file_id = created["id"]
    return {
        "fileId": file_id,
        "url": f"https://drive.google.com/uc?id={file_id}&export=view",
        "viewUrl": created.get("webViewLink") or f"https://drive.google.com/file/d/{file_id}/view",
    }
