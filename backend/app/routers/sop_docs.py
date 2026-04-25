import json
from functools import lru_cache
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from google.oauth2 import service_account
from googleapiclient.discovery import build

from ..config import get_settings
from ..dependencies import require_auth
from ..utils import can_access_sop

router = APIRouter(tags=["sop"])

DOCS_SCOPES = [
    "https://www.googleapis.com/auth/documents.readonly",
    "https://www.googleapis.com/auth/drive.readonly",
]


def _normalize_text(value: str) -> str:
    return " ".join((value or "").replace("\u00a0", " ").split())


def _extract_text_runs(elements: list[dict[str, Any]]) -> str:
    parts: list[str] = []

    for element in elements or []:
        text_run = element.get("textRun")
        if not text_run:
            continue
        parts.append(text_run.get("content", ""))

    return "".join(parts).rstrip("\n")


def _extract_table(table: dict[str, Any]) -> dict[str, Any]:
    rows: list[list[str]] = []

    for row in table.get("tableRows", []):
        cells: list[str] = []
        for cell in row.get("tableCells", []):
            cell_parts: list[str] = []
            for item in cell.get("content", []):
                paragraph = item.get("paragraph")
                if paragraph:
                    text = _extract_text_runs(paragraph.get("elements", []))
                    if text:
                        cell_parts.append(text)
                nested_table = item.get("table")
                if nested_table:
                    nested_rows = _extract_table(nested_table).get("rows", [])
                    for nested_row in nested_rows:
                        nested_text = " | ".join(value for value in nested_row if value)
                        if nested_text:
                            cell_parts.append(nested_text)
            cells.append("\n".join(cell_parts).strip())
        rows.append(cells)

    return {"type": "table", "rows": rows}


def _extract_blocks(content: list[dict[str, Any]]) -> list[dict[str, Any]]:
    blocks: list[dict[str, Any]] = []

    for item in content or []:
        paragraph = item.get("paragraph")
        if paragraph:
            text = _extract_text_runs(paragraph.get("elements", []))
            if not text.strip():
                continue

            paragraph_style = paragraph.get("paragraphStyle", {})
            named_style = paragraph_style.get("namedStyleType", "NORMAL_TEXT")
            block_type = "list_item" if paragraph.get("bullet") else "paragraph"

            if named_style.startswith("HEADING_"):
                block_type = "heading"

            blocks.append(
                {
                    "type": block_type,
                    "style": named_style,
                    "text": text.strip(),
                }
            )
            continue

        table = item.get("table")
        if table:
            blocks.append(_extract_table(table))

    return blocks


def _flatten_tabs(tabs: list[dict[str, Any]], depth: int = 0) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []

    for tab in tabs or []:
        tab_props = tab.get("tabProperties", {})
        document_tab = tab.get("documentTab", {})
        items.append(
            {
                "id": tab_props.get("tabId"),
                "title": tab_props.get("title") or "Untitled",
                "depth": depth,
                "blocks": _extract_blocks(document_tab.get("body", {}).get("content", [])),
            }
        )
        items.extend(_flatten_tabs(tab.get("childTabs", []), depth + 1))

    return items


def _build_credentials():
    settings = get_settings()

    if settings.google_service_account_json:
        info = json.loads(settings.google_service_account_json)
        return service_account.Credentials.from_service_account_info(info, scopes=DOCS_SCOPES)

    if settings.google_service_account_file:
        return service_account.Credentials.from_service_account_file(
            settings.google_service_account_file,
            scopes=DOCS_SCOPES,
        )

    raise HTTPException(
        status_code=503,
        detail="Google Docs belum dikonfigurasi di backend. Isi GOOGLE_SERVICE_ACCOUNT_JSON atau GOOGLE_SERVICE_ACCOUNT_FILE.",
    )


@lru_cache
def get_docs_service():
    credentials = _build_credentials()
    return build("docs", "v1", credentials=credentials, cache_discovery=False)


@lru_cache
def get_drive_service():
    credentials = _build_credentials()
    return build("drive", "v3", credentials=credentials, cache_discovery=False)


@router.get("/sop/docs")
def list_sop_docs(current_user: dict = Depends(require_auth)) -> dict[str, Any]:
    if not can_access_sop(current_user):
        raise HTTPException(status_code=403, detail="Role ini tidak diizinkan mengakses SOP.")

    settings = get_settings()
    folder_id = settings.resolved_google_sop_folder_id
    if not folder_id:
        raise HTTPException(status_code=503, detail="GOOGLE_SOP_FOLDER_ID belum diisi.")

    drive = get_drive_service()
    response = (
        drive.files()
        .list(
            q=(
                f"'{folder_id}' in parents and trashed = false and "
                "mimeType = 'application/vnd.google-apps.document'"
            ),
            fields="files(id,name,modifiedTime,webViewLink)",
            orderBy="name",
            pageSize=100,
        )
        .execute()
    )

    files = response.get("files", [])
    return {
        "count": len(files),
        "items": [
            {
                "id": item["id"],
                "name": item["name"],
                "modifiedTime": item.get("modifiedTime"),
                "webViewLink": item.get("webViewLink"),
            }
            for item in files
        ],
    }


@router.get("/sop/docs/{document_id}")
def get_sop_doc(document_id: str, current_user: dict = Depends(require_auth)) -> dict[str, Any]:
    if not can_access_sop(current_user):
        raise HTTPException(status_code=403, detail="Role ini tidak diizinkan mengakses SOP.")

    docs = get_docs_service()

    try:
        response = (
            docs.documents()
            .get(documentId=document_id, includeTabsContent=True)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Gagal mengambil dokumen Google Docs: {exc}") from exc

    tabs = _flatten_tabs(response.get("tabs", []))
    title = response.get("title") or "SOP"
    summary = _normalize_text(" ".join(block.get("text", "") for tab in tabs for block in tab["blocks"][:3]))

    return {
        "id": document_id,
        "title": title,
        "summary": summary[:220],
        "tabs": tabs,
    }
