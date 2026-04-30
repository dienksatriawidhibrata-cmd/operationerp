// ============================================================
// Bagi Kopi Ops — Sync Opex Harian ke Google Sheets
// ============================================================
// Cara setup:
//   1. Buka Google Sheet target
//   2. Extensions → Apps Script → paste seluruh file ini
//   3. Isi CONFIG di bawah
//   4. Jalankan sekali manual (Run → syncOpexToSheets) untuk test
//   5. Triggers → Add Trigger:
//        Function  : syncOpexToSheets
//        Event     : Time-driven → Day timer → 10:00 – 11:00 (WIB = GMT+7)
// ============================================================

var CONFIG = {
  supabaseUrl: 'https://GANTI_PROJECT_REF.supabase.co',
  serviceRoleKey: 'GANTI_SERVICE_ROLE_KEY',
  sheetName: 'Log Opex',
};

var HEADERS = [
  'Tanggal', 'Toko', 'Store ID', 'District/Area',
  'Kode', 'Kategori', 'Item', 'Detail',
  'Qty', 'Harga Satuan', 'Total', 'Diinput Oleh',
];

function getYesterdayWIB() {
  var wibNow = new Date(Date.now() + 7 * 3600 * 1000);
  var yesterday = new Date(wibNow.getTime() - 24 * 3600 * 1000);
  var y = yesterday.getUTCFullYear();
  var m = String(yesterday.getUTCMonth() + 1).padStart(2, '0');
  var d = String(yesterday.getUTCDate()).padStart(2, '0');
  return y + '-' + m + '-' + d;
}

function fmtRp(val) {
  if (val == null || val === '') return '';
  return Number(val).toLocaleString('id-ID');
}

function fetchOpexData(tanggal) {
  var select = [
    '*',
    'branch:branches(name,store_id,district,area)',
    'submitter:profiles!submitted_by(full_name)',
  ].join(',');

  var url = CONFIG.supabaseUrl
    + '/rest/v1/operational_expenses'
    + '?select=' + encodeURIComponent(select)
    + '&tanggal=eq.' + tanggal
    + '&order=branch_id,created_at';

  var res = UrlFetchApp.fetch(url, {
    method: 'GET',
    headers: {
      'apikey': CONFIG.serviceRoleKey,
      'Authorization': 'Bearer ' + CONFIG.serviceRoleKey,
      'Content-Type': 'application/json',
    },
    muteHttpExceptions: true,
  });

  if (res.getResponseCode() !== 200) {
    throw new Error('Supabase error ' + res.getResponseCode() + ': ' + res.getContentText());
  }

  return JSON.parse(res.getContentText());
}

function getOrCreateSheet(spreadsheet, sheetName) {
  var sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }
  return sheet;
}

function ensureHeaders(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    var headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#1e293b');
    headerRange.setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  }
}

function syncOpexToSheets() {
  var yesterday = getYesterdayWIB();
  var expenses = fetchOpexData(yesterday);

  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getOrCreateSheet(spreadsheet, CONFIG.sheetName);
  ensureHeaders(sheet);

  if (!expenses || expenses.length === 0) {
    sheet.appendRow([yesterday, '(tidak ada data opex)', '', '', '', '', '', '', '', '', '', '']);
    return;
  }

  var rows = expenses.map(function(exp) {
    var branch = exp.branch || {};
    var storeName = (branch.name || '-').replace('Bagi Kopi ', '');
    var location = branch.district || branch.area || '-';
    return [
      exp.tanggal,
      storeName,
      branch.store_id || '-',
      location,
      exp.code || '',
      exp.category || '',
      exp.item_name || '',
      exp.detail || '',
      exp.qty != null ? Number(exp.qty) : '',
      exp.harga_satuan != null ? Number(exp.harga_satuan) : '',
      exp.total != null ? Number(exp.total) : '',
      (exp.submitter && exp.submitter.full_name) ? exp.submitter.full_name : '-',
    ];
  });

  // Tulis semua baris sekaligus (lebih cepat dari appendRow satu-satu)
  var startRow = sheet.getLastRow() + 1;
  sheet.getRange(startRow, 1, rows.length, HEADERS.length).setValues(rows);

  // Format kolom Harga Satuan dan Total sebagai angka
  var hargaCol = 10;
  var totalCol = 11;
  var numFmt = '#,##0';
  sheet.getRange(startRow, hargaCol, rows.length, 1).setNumberFormat(numFmt);
  sheet.getRange(startRow, totalCol, rows.length, 1).setNumberFormat(numFmt);

  Logger.log('Sync selesai: ' + rows.length + ' baris ditulis untuk ' + yesterday);
}
