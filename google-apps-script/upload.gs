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
const ROOT_FOLDER_ID = '1zsX4nKXk4xCzrwAgIlO135Zix8H13G_e';
const APP_SHARED_TOKEN = PropertiesService.getScriptProperties().getProperty('APP_SHARED_TOKEN') || '';

// ── HANDLER ───────────────────────────────────────────────

function doPost(e) {
  try {
    const payload  = JSON.parse(e.postData.contents);
    assertAuthorized_(payload && payload.token);
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
  assertAuthorized_(e && e.parameter ? e.parameter.token : '');

  if (e && e.parameter && e.parameter.action === 'listSops') {
    return jsonResponse(listSopDocs_());
  }

  if (e && e.parameter && e.parameter.action === 'getSopDoc' && e.parameter.id) {
    return jsonResponse(getSopDoc_(e.parameter.id));
  }

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

function assertAuthorized_(token) {
  if (APP_SHARED_TOKEN && token !== APP_SHARED_TOKEN) {
    throw new Error('Unauthorized');
  }
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

function listSopDocs_() {
  const folderId = PropertiesService.getScriptProperties().getProperty('GOOGLE_SOP_FOLDER_ID') || ROOT_FOLDER_ID;
  if (!folderId) {
    throw new Error('GOOGLE_SOP_FOLDER_ID belum diatur di Script Properties.');
  }

  const folder = DriveApp.getFolderById(folderId);
  const items = [];
  collectSopDocs_(folder, '', items);

  items.sort((a, b) => a.name.localeCompare(b.name));
  return { count: items.length, items: items };
}

function collectSopDocs_(folder, parentPath, items) {
  const currentPath = parentPath ? `${parentPath} / ${folder.getName()}` : folder.getName();
  const files = folder.getFiles();

  while (files.hasNext()) {
    const file = files.next();
    const mimeType = file.getMimeType();
    if (!isSupportedSopMimeType_(mimeType)) continue;

    items.push({
      id: file.getId(),
      name: file.getName(),
      mimeType: mimeType,
      modifiedTime: file.getLastUpdated().toISOString(),
      webViewLink: file.getUrl(),
      folderPath: currentPath,
    });
  }

  const subfolders = folder.getFolders();
  while (subfolders.hasNext()) {
    collectSopDocs_(subfolders.next(), currentPath, items);
  }
}

function getSopDoc_(documentId) {
  const file = DriveApp.getFileById(documentId);
  const mimeType = file.getMimeType();

  if (mimeType === MimeType.GOOGLE_DOCS) {
    const doc = DocumentApp.openById(documentId);
    const tabs = flattenTabs_(doc.getTabs());
    const summary = tabs
      .slice(0, 3)
      .flatMap((tab) => tab.blocks.slice(0, 2))
      .map((block) => block.text || '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 220);

    return {
      id: documentId,
      title: doc.getName(),
      summary: summary,
      tabs: tabs,
      mimeType: mimeType,
    };
  }

  if (isDocxMimeType_(mimeType)) {
    const parsed = extractDocxDocument_(file);
    return {
      id: documentId,
      title: file.getName(),
      summary: parsed.summary,
      tabs: [
        {
          id: `${documentId}-main`,
          title: file.getName(),
          depth: 0,
          blocks: parsed.blocks,
        },
      ],
      mimeType: mimeType,
    };
  }

  throw new Error(`Format SOP belum didukung: ${mimeType}`);
}

function isSupportedSopMimeType_(mimeType) {
  return mimeType === MimeType.GOOGLE_DOCS || isDocxMimeType_(mimeType);
}

function isDocxMimeType_(mimeType) {
  return mimeType === MimeType.MICROSOFT_WORD || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
}

function extractDocxDocument_(file) {
  const zipBlob = Utilities.newBlob(file.getBlob().getBytes(), 'application/zip', file.getName());
  const entries = Utilities.unzip(zipBlob);
  const documentEntry = entries.filter((entry) => entry.getName() === 'word/document.xml')[0];
  if (!documentEntry) {
    throw new Error('Isi file DOCX tidak ditemukan.');
  }

  const xml = XmlService.parse(documentEntry.getDataAsString());
  const root = xml.getRootElement();
  const ns = root.getNamespace();
  const body = root.getChild('body', ns);
  if (!body) {
    return { summary: '', blocks: [] };
  }

  const blocks = [];
  const children = body.getChildren();

  children.forEach((child) => {
    const name = child.getName();
    if (name === 'p') {
      const paragraphBlock = extractDocxParagraph_(child, ns);
      if (paragraphBlock) blocks.push(paragraphBlock);
      return;
    }

    if (name === 'tbl') {
      const tableBlock = extractDocxTable_(child, ns);
      if (tableBlock.rows.length) blocks.push(tableBlock);
    }
  });

  const summary = blocks
    .filter((block) => block.type !== 'table')
    .slice(0, 4)
    .map((block) => block.text || '')
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 220);

  return { summary: summary, blocks: blocks };
}

function extractDocxParagraph_(paragraph, ns) {
  const text = extractDocxNodeText_(paragraph, ns).replace(/\s+/g, ' ').trim();
  if (!text) return null;

  const props = paragraph.getChild('pPr', ns);
  const styleNode = props ? props.getChild('pStyle', ns) : null;
  const numPr = props ? props.getChild('numPr', ns) : null;
  const styleVal = styleNode ? getAttributeValue_(styleNode, ns, 'val') : '';

  if (numPr) {
    return {
      type: 'list_item',
      style: 'NORMAL_TEXT',
      text: text,
    };
  }

  if (/Heading ?1/i.test(styleVal)) {
    return { type: 'heading', style: 'HEADING_1', text: text };
  }
  if (/Heading ?2/i.test(styleVal)) {
    return { type: 'heading', style: 'HEADING_2', text: text };
  }
  if (/Heading ?3/i.test(styleVal)) {
    return { type: 'heading', style: 'HEADING_3', text: text };
  }

  return {
    type: 'paragraph',
    style: 'NORMAL_TEXT',
    text: text,
  };
}

function extractDocxTable_(table, ns) {
  const rows = [];

  table.getChildren('tr', ns).forEach((row) => {
    const cells = [];
    row.getChildren('tc', ns).forEach((cell) => {
      const text = extractDocxNodeText_(cell, ns).replace(/\s+/g, ' ').trim();
      cells.push(text);
    });
    rows.push(cells);
  });

  return { type: 'table', rows: rows };
}

function extractDocxNodeText_(node, ns) {
  let text = '';

  node.getChildren().forEach((child) => {
    const name = child.getName();
    if (name === 't') {
      text += child.getText();
      return;
    }
    if (name === 'tab') {
      text += '\t';
      return;
    }
    if (name === 'br' || name === 'cr') {
      text += '\n';
      return;
    }
    text += extractDocxNodeText_(child, ns);
  });

  return text;
}

function getAttributeValue_(element, ns, attributeName) {
  const attr = element.getAttribute(attributeName, ns) || element.getAttribute(attributeName);
  return attr ? attr.getValue() : '';
}

function flattenTabs_(tabs, depth) {
  const currentDepth = depth || 0;
  const rows = [];

  (tabs || []).forEach((tab) => {
    const docTab = tab.asDocumentTab();
    rows.push({
      id: tab.getId(),
      title: tab.getTitle() || 'Untitled',
      depth: currentDepth,
      blocks: extractBodyBlocks_(docTab.getBody()),
    });
    rows.push.apply(rows, flattenTabs_(tab.getChildTabs(), currentDepth + 1));
  });

  return rows;
}

function extractBodyBlocks_(body) {
  const blocks = [];
  const totalChildren = body.getNumChildren();

  for (let index = 0; index < totalChildren; index += 1) {
    const child = body.getChild(index);
    const type = child.getType();

    if (type === DocumentApp.ElementType.PARAGRAPH || type === DocumentApp.ElementType.LIST_ITEM) {
      const text = child.asText().getText().trim();
      if (!text) continue;

      const heading = child.getHeading ? child.getHeading() : null;
      let style = 'NORMAL_TEXT';
      if (heading && heading !== DocumentApp.ParagraphHeading.NORMAL) {
        style = String(heading).replace('DocumentApp.ParagraphHeading.', '');
      }

      blocks.push({
        type: type === DocumentApp.ElementType.LIST_ITEM ? 'list_item' : (style !== 'NORMAL_TEXT' ? 'heading' : 'paragraph'),
        style: style,
        text: text,
      });
      continue;
    }

    if (type === DocumentApp.ElementType.TABLE) {
      const table = child.asTable();
      const rows = [];
      for (let rowIndex = 0; rowIndex < table.getNumRows(); rowIndex += 1) {
        const row = table.getRow(rowIndex);
        const cells = [];
        for (let cellIndex = 0; cellIndex < row.getNumCells(); cellIndex += 1) {
          const cell = row.getCell(cellIndex);
          cells.push(cell.getText().trim());
        }
        rows.push(cells);
      }
      blocks.push({ type: 'table', rows: rows });
    }
  }

  return blocks;
}

/**
 * Return JSON response dengan CORS headers.
 */
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
