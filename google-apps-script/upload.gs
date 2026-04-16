/**
 * BAGI KOPI OPS — Google Apps Script
 * Upload foto ke Google Drive dan return URL-nya.
 *
 * CARA SETUP:
 * 1. Buka script.google.com → New Project
 * 2. Copy-paste seluruh kode ini
 * 3. Ganti FOLDER_ID di bawah dengan ID folder Drive tujuan
 * 4. Deploy → New Deployment → Web App
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. Copy Deployment URL → paste ke .env sebagai VITE_APPS_SCRIPT_URL
 */

// ── KONFIGURASI ──────────────────────────────────────────
// Buat folder di Google Drive, klik kanan → Get Link
// Ambil bagian ID-nya: drive.google.com/drive/folders/FOLDER_ID_INI
const ROOT_FOLDER_ID = 'YOUR_GOOGLE_DRIVE_FOLDER_ID_HERE';

// ── HANDLER ───────────────────────────────────────────────

function doPost(e) {
  try {
    const payload  = JSON.parse(e.postData.contents);
    const folder   = getOrCreateFolder(payload.folder || 'general');
    const fileName = generateFileName(payload.fileName || 'foto.jpg');
    const mimeType = payload.mimeType || 'image/jpeg';
    const base64   = payload.data;

    // Decode base64 dan buat file
    const bytes = Utilities.base64Decode(base64);
    const blob  = Utilities.newBlob(bytes, mimeType, fileName);
    const file  = folder.createFile(blob);

    const fileId = file.getId();
    let shared = false;
    let sharingError = null;

    try {
      // Set sharing: siapapun dengan link bisa lihat (untuk embed di app)
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      shared = true;
    } catch (shareErr) {
      sharingError = shareErr.message;
    }

    return jsonResponse({
      success: true,
      fileId:  fileId,
      url:     `https://drive.google.com/uc?id=${fileId}&export=view`,
      viewUrl: `https://drive.google.com/file/d/${fileId}/view`,
      previewUrl: getPreviewUrl(fileId),
      shared: shared,
      sharingError: sharingError,
    });

  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

// GET juga didukung untuk test
function doGet(e) {
  if (e && e.parameter && e.parameter.action === 'preview' && e.parameter.id) {
    return HtmlService
      .createHtmlOutput(
        `<html><body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center;min-height:100vh;">
          <img src="${getDriveViewUrl(e.parameter.id)}" style="max-width:100%;max-height:100vh;object-fit:contain;" />
        </body></html>`
      )
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  return jsonResponse({ status: 'ok', message: 'Bagi Kopi Drive Uploader' });
}

// ── HELPERS ───────────────────────────────────────────────

/**
 * Ambil atau buat subfolder di dalam root folder.
 * folder param bisa berisi path: "ceklis/2026-04-15"
 */
function getOrCreateFolder(path) {
  let current = DriveApp.getFolderById(ROOT_FOLDER_ID);
  const parts = path.split('/');

  for (const part of parts) {
    if (!part) continue;
    const existing = current.getFoldersByName(part);
    if (existing.hasNext()) {
      current = existing.next();
    } else {
      current = current.createFolder(part);
    }
  }

  return current;
}

/**
 * Generate nama file unik dengan timestamp.
 */
function generateFileName(original) {
  const ext  = original.split('.').pop() || 'jpg';
  const ts   = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const rand = Math.random().toString(36).slice(2, 7);
  return `${ts}_${rand}.${ext}`;
}

function getDriveViewUrl(fileId) {
  return `https://drive.google.com/uc?id=${fileId}&export=view`;
}

function getPreviewUrl(fileId) {
  return ScriptApp.getService().getUrl() + `?action=preview&id=${fileId}`;
}

/**
 * Return JSON response dengan CORS headers.
 */
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
