/**
 * NOTIFIKASI SURAT JALAN (REAL-TIME POLLING)
 * ─────────────────────────────────────────────────────────────
 * Script ini mengecek Surat Jalan baru (Kiriman & Terima) secara berkala.
 * 
 * SETUP:
 * 1. Tambahkan ke project Apps Script yang sama atau berbeda.
 * 2. Jalankan setupSJTrigger() sekali.
 */

// ─── TRIGGER ENTRYPOINT ──────────────────────────────────────

function triggerSJPolling() {
  const config = getConfig();
  if (!config.baseUrl || !config.apiKey) return;

  const props = PropertiesService.getScriptProperties();
  const lastShipCheck = props.getProperty('LAST_SJ_SHIP_CHECK') || new Date(new Date().getTime() - 3600000).toISOString(); // Default 1 jam lalu
  const lastRecCheck  = props.getProperty('LAST_SJ_REC_CHECK')  || new Date(new Date().getTime() - 3600000).toISOString();

  let newestShip = lastShipCheck;
  let newestRec  = lastRecCheck;

  // 1. CEK PENGIRIMAN BARU (Status: issued/shipped)
  const newShipments = fetchJson(
    config.baseUrl + '/rest/v1/surat_jalan?status=in.(issued,shipped)&issued_at=gt.' + lastShipCheck + '&order=issued_at.asc',
    config.apiKey
  ) || [];

  newShipments.forEach(function(sj) {
    sendShipmentNotif(sj);
    if (sj.issued_at > newestShip) newestShip = sj.issued_at;
  });

  // 2. CEK PENERIMAAN BARU (Status: delivered)
  const newDeliveries = fetchJson(
    config.baseUrl + '/rest/v1/surat_jalan?status=eq.delivered&received_at=gt.' + lastRecCheck + '&order=received_at.asc',
    config.apiKey
  ) || [];

  newDeliveries.forEach(function(sj) {
    sendDeliveryNotif(sj);
    if (sj.received_at > newestRec) newestRec = sj.received_at;
  });

  // Simpan timestamp terakhir
  props.setProperties({
    'LAST_SJ_SHIP_CHECK': newestShip,
    'LAST_SJ_REC_CHECK': newestRec
  });
}

// ─── NOTIFICATION LOGIC ──────────────────────────────────────

function sendShipmentNotif(sj) {
  const config = getConfig();
  const branch = fetchBranchById(config.baseUrl, config.apiKey, sj.branch_id);
  if (!branch) return;

  // Fetch items dan order items untuk perbandingan
  const sjItems = fetchJson(config.baseUrl + '/rest/v1/surat_jalan_items?sj_id=eq.' + sj.id, config.apiKey) || [];
  const orderItems = fetchJson(config.baseUrl + '/rest/v1/supply_order_items?order_id=eq.' + sj.order_id, config.apiKey) || [];
  
  const orderItemMap = {};
  orderItems.forEach(function(it) { orderItemMap[it.sku_code] = it.qty_ordered || it.qty || 0; });

  const mismatches = [];
  sjItems.forEach(function(it) {
    const qtyOrdered = orderItemMap[it.sku_code] || 0;
    if (Number(it.qty_kirim) !== Number(qtyOrdered)) {
      mismatches.push({ name: it.sku_name, kirim: it.qty_kirim, order: qtyOrdered, unit: it.unit });
    }
  });

  const lines = [
    '📦 *Pengiriman Barang (SC)*',
    '📍 *' + shortName(branch.name) + '*',
    '🔢 No. SJ: ' + sj.sj_number,
    '⏰ Jam Kirim: ' + fmtJamWIB(sj.issued_at),
    ''
  ];

  if (mismatches.length > 0) {
    lines.push('⚠️ *Item tidak sesuai PO:*');
    mismatches.forEach(function(it) {
      lines.push('   • ' + it.name + ': ' + it.kirim + ' ' + it.unit + ' (PO: ' + it.order + ')');
    });
  } else {
    lines.push('✅ Semua item sesuai PO.');
  }

  const text = lines.join('\n');
  sendToGChatDistricts(branch.district, text);
}

function sendDeliveryNotif(sj) {
  const config = getConfig();
  const branch = fetchBranchById(config.baseUrl, config.apiKey, sj.branch_id);
  if (!branch) return;

  const sjItems = fetchJson(config.baseUrl + '/rest/v1/surat_jalan_items?sj_id=eq.' + sj.id, config.apiKey) || [];
  
  const mismatches = [];
  sjItems.forEach(function(it) {
    const qtyReceived = it.qty_received !== null ? it.qty_received : it.qty_kirim;
    if (Number(qtyReceived) !== Number(it.qty_kirim)) {
      mismatches.push({ name: it.sku_name, terima: qtyReceived, kirim: it.qty_kirim, unit: it.unit });
    }
  });

  const lines = [
    '✅ *Barang Diterima (Store)*',
    '📍 *' + shortName(branch.name) + '*',
    '🔢 No. SJ: ' + sj.sj_number,
    '⏰ Jam Terima: ' + fmtJamWIB(sj.received_at),
    ''
  ];

  if (mismatches.length > 0) {
    lines.push('⚠️ *Item tidak sesuai SJ:*');
    mismatches.forEach(function(it) {
      lines.push('   • ' + it.name + ': ' + it.terima + ' ' + it.unit + ' (SJ: ' + it.kirim + ')');
    });
  } else {
    lines.push('🎉 Barang diterima lengkap sesuai SJ.');
  }

  const text = lines.join('\n');
  sendToGChatDistricts(branch.district, text);
}

// ─── HELPERS ─────────────────────────────────────────────────

function sendToGChatDistricts(district, text) {
  const config = getConfig();
  if (config.webhookAll) sendToGChat(config.webhookAll, { text: text });
  if (district === 'JKT' && config.webhookJKT) sendToGChat(config.webhookJKT, { text: text });
  if (district === 'BTN' && config.webhookBTN) sendToGChat(config.webhookBTN, { text: text });
}

function fetchBranchById(baseUrl, apiKey, id) {
  const data = fetchJson(baseUrl + '/rest/v1/branches?id=eq.' + id + '&select=name,district', apiKey);
  return data && data.length > 0 ? data[0] : null;
}

function getConfig() {
  const props = PropertiesService.getScriptProperties();
  return {
    baseUrl: props.getProperty('SUPABASE_URL'),
    apiKey: props.getProperty('SUPABASE_SERVICE_KEY'),
    webhookAll: props.getProperty('WEBHOOK_ALL'),
    webhookJKT: props.getProperty('WEBHOOK_JKT'),
    webhookBTN: props.getProperty('WEBHOOK_BTN')
  };
}

function fetchJson(url, apiKey) {
  try {
    var res = UrlFetchApp.fetch(url, {
      method: 'GET',
      headers: { 'apikey': apiKey, 'Authorization': 'Bearer ' + apiKey },
      muteHttpExceptions: true,
    });
    if (res.getResponseCode() !== 200) return null;
    return JSON.parse(res.getContentText());
  } catch (e) { return null; }
}

function sendToGChat(webhookUrl, payload) {
  if (!webhookUrl) return;
  UrlFetchApp.fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
}

function fmtJamWIB(isoStr) {
  if (!isoStr) return '-';
  var d = new Date(isoStr);
  var wib = new Date(d.getTime() + 7 * 3600000);
  return String(wib.getUTCHours()).padStart(2, '0') + ':' + String(wib.getUTCMinutes()).padStart(2, '0');
}

function shortName(name) {
  return (name || '').replace(/^Bagi Kopi\s+/i, '');
}

// Jalankan ini sekali untuk mengaktifkan pengecekan berkala (tiap 10 menit)
function setupSJTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t) { 
    if (t.getHandlerFunction() === 'triggerSJPolling') ScriptApp.deleteTrigger(t); 
  });
  ScriptApp.newTrigger('triggerSJPolling').timeBased().everyMinutes(10).create();
}
