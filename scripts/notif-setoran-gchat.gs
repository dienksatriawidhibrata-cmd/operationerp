// ─── WEBHOOK HANDLER (Real-time Notifications) ────────────────

/**
 * Handle incoming POST requests from Supabase Webhooks.
 * To use this: 
 * 1. Deploy this script as a Web App (Deploy > New Deployment > Web App > Execute as: Me, Who has access: Anyone).
 * 2. Copy the Web App URL.
 * 3. Go to Supabase > Database > Webhooks.
 * 4. Create a webhook for 'surat_jalan' table on 'INSERT' and 'UPDATE'.
 */
function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    if (payload.table === 'surat_jalan') {
      handleSJWebhook(payload);
    }
    return ContentService.createTextOutput(JSON.stringify({ status: 'ok' })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.message })).setMimeType(ContentService.MimeType.JSON);
  }
}

function handleSJWebhook(payload) {
  var record = payload.record;
  var old = payload.old_record;
  
  // 1. SHIPMENT NOTIFICATION
  // Trigger when status changes to 'shipped' or 'issued'
  // (Usually 'issued' is the first step of creation, 'shipped' is distribution)
  var isNowShipped = (record.status === 'shipped' || record.status === 'issued') && (!old || old.status === 'draft');
  
  // Special case: if status is updated directly to 'shipped'
  if (!isNowShipped && record.status === 'shipped' && old && old.status !== 'shipped') {
    isNowShipped = true;
  }

  if (isNowShipped) {
    sendDirectShipmentNotif(record);
  }

  // 2. DELIVERY NOTIFICATION
  // Trigger when status changes to 'delivered'
  var isNowDelivered = record.status === 'delivered' && (!old || old.status !== 'delivered');

  if (isNowDelivered) {
    sendDirectDeliveryNotif(record);
  }
}

function sendDirectShipmentNotif(sj) {
  const config = getConfig();
  const branch = fetchBranchById(config.baseUrl, config.apiKey, sj.branch_id);
  if (!branch) return;

  // Fetch items and order items for comparison
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
    '⏰ Jam Kirim: ' + fmtJamWIB(sj.issued_at || new Date().toISOString()),
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
  sendToGChatWithDistricts(branch.district, text);
}

function sendDirectDeliveryNotif(sj) {
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
    '⏰ Jam Terima: ' + fmtJamWIB(sj.received_at || new Date().toISOString()),
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
  sendToGChatWithDistricts(branch.district, text);
}

function sendToGChatWithDistricts(district, text) {
  const config = getConfig();
  if (config.webhookAll) sendToGChat(config.webhookAll, { text: text });
  if (district === 'JKT' && config.webhookJKT) sendToGChat(config.webhookJKT, { text: text });
  if (district === 'BTN' && config.webhookBTN) sendToGChat(config.webhookBTN, { text: text });
}

function fetchBranchById(baseUrl, apiKey, branchId) {
  const data = fetchJson(baseUrl + '/rest/v1/branches?id=eq.' + branchId + '&select=id,name,district', apiKey);
  return data && data.length > 0 ? data[0] : null;
}

// ─── TRIGGER FUNCTIONS ───────────────────────────────────────

function triggerClosing() { combinedNotifCheckPrep('malam', getYesterdayWIB(), '05:00', 'Closing 🌙', true); }
function triggerPagi()    { combinedNotifCheckPrep('pagi',   getTodayWIB(),     '09:30', 'Pagi ☀️'); }
function triggerMiddle()  { combinedNotifCheckPrep('middle', getTodayWIB(),     '15:30', 'Middle 🌤'); }
function triggerMalam()   { combinedNotifCheckPrep('malam',  getTodayWIB(),     '20:00', 'Malam 🌙'); }

function triggerFinanceOpexLaporan() {
  notifikasiBeluSetoran(); 
  notifOpex();             
  notifLaporan();          
}

function triggerVisit() { notifVisit(); }

// ─── CORE LOGIC (Ceklis & Preparation) ───────────────────────

function combinedNotifCheckPrep(shift, tanggal, deadline, labelShift, skipPrep) {
  const config = getConfig();
  if (!config.baseUrl || !config.apiKey) return;

  const branches = fetchBranches(config.baseUrl, config.apiKey);
  if (!branches) return;

  const ceklisDone = fetchJson(config.baseUrl + '/rest/v1/daily_checklists?shift=eq.' + shift + '&tanggal=eq.' + tanggal + '&select=branch_id', config.apiKey) || [];
  const ceklisSet = new Set(ceklisDone.map(function(r) { return r.branch_id }));

  let prepSet = new Set();
  if (!skipPrep) {
    const prepDone = fetchJson(config.baseUrl + '/rest/v1/daily_preparation?shift=eq.' + shift + '&tanggal=eq.' + tanggal + '&select=branch_id', config.apiKey) || [];
    prepSet = new Set(prepDone.map(function(r) { return r.branch_id }));
  }

  var sendFilteredMessage = function(webhookUrl, filterFn, groupName) {
    if (!webhookUrl) return; 
    
    var filteredBranches = branches.filter(filterFn);
    var belumCeklis = filteredBranches.filter(function(b) { return !ceklisSet.has(b.id) });
    var belumPrep = skipPrep ? [] : filteredBranches.filter(function(b) { return !prepSet.has(b.id) });

    if (belumCeklis.length === 0 && belumPrep.length === 0) {
      sendToGChat(webhookUrl, { text: '✅ *[' + groupName + '] ' + labelShift + ' Aman* — ' + formatTanggal(tanggal) });
      return;
    }

    var icon = labelShift.indexOf('Closing') !== -1 ? '🔒' : '📋';
    var lines = [icon + ' *[' + groupName + '] Belum Submit ' + labelShift + '* — Deadline ' + deadline + ' WIB', '📅 ' + formatTanggal(tanggal) + ' (' + getJamWIBNow() + ' WIB)', ''];
    
    if (belumCeklis.length > 0) {
      lines.push('❌ *Belum Ceklis (' + belumCeklis.length + '):*');
      belumCeklis.forEach(function(b) { lines.push('   • ' + shortName(b.name) + ' _[' + b.district + ']_') });
    }
    if (!skipPrep && belumPrep.length > 0) {
      lines.push('', '❌ *Belum Preparation (' + belumPrep.length + '):*');
      belumPrep.forEach(function(b) { lines.push('   • ' + shortName(b.name) + ' _[' + b.district + ']_') });
    }
    sendToGChat(webhookUrl, { text: lines.join('\n') });
  };

  sendFilteredMessage(config.webhookAll, function() { return true; }, "ALL");
  sendFilteredMessage(config.webhookJKT, function(b) { return b.district === 'JKT'; }, "JKT");
  sendFilteredMessage(config.webhookBTN, function(b) { return b.district === 'BTN'; }, "BTN");
}

// ─── FINANCE & REPORT LOGIC ──────────────────────────────────

function notifikasiBeluSetoran() {
  const config = getConfig();
  const tanggal = getYesterdayWIB();
  const branches = fetchBranches(config.baseUrl, config.apiKey);
  const deposits = fetchJson(config.baseUrl + '/rest/v1/daily_deposits?tanggal=eq.' + tanggal + '&select=branch_id,status', config.apiKey) || [];

  const submitted = new Set();
  deposits.forEach(function(d) {
    if (d.status !== 'rejected') submitted.add(d.branch_id);
  });

  // Ambil data setoran sukses terakhir untuk info "Terakhir Setor"
  const lastSuccessRows = fetchJson(config.baseUrl + '/rest/v1/daily_deposits?status=in.(submitted,approved)&select=branch_id,tanggal&order=tanggal.desc&limit=200', config.apiKey) || [];
  const lastSetorMap = {};
  lastSuccessRows.forEach(function(r) {
    if (!lastSetorMap[r.branch_id]) lastSetorMap[r.branch_id] = r.tanggal;
  });

  var sendFilteredMessage = function(webhookUrl, filterFn, groupName) {
    if (!webhookUrl) return;
    var filteredBranches = branches.filter(filterFn);
    var belumSetor = filteredBranches.filter(function(b) { return !submitted.has(b.id) });

    if (belumSetor.length === 0) {
      sendToGChat(webhookUrl, { text: '✅ *[' + groupName + '] Semua toko sudah setoran* — ' + formatTanggal(tanggal) });
      return;
    }

    var lines = ['🔴 *[' + groupName + '] Toko Belum Setoran* — ' + formatTanggal(tanggal), '', '*' + belumSetor.length + ' Toko* belum setor:'];
    belumSetor.forEach(function(b) { 
      var lastDate = lastSetorMap[b.id] ? formatTanggal(lastSetorMap[b.id]) : 'Belum pernah';
      lines.push('   • ' + shortName(b.name) + ' _(Terakhir: ' + lastDate + ')_'); 
    });
    sendToGChat(webhookUrl, { text: lines.join('\n') });
  };

  sendFilteredMessage(config.webhookAll, function() { return true; }, "ALL");
  sendFilteredMessage(config.webhookJKT, function(b) { return b.district === 'JKT'; }, "JKT");
  sendFilteredMessage(config.webhookBTN, function(b) { return b.district === 'BTN'; }, "BTN");
}

function notifOpex() {
  const config = getConfig();
  const today = getTodayWIB();
  const branches = fetchBranches(config.baseUrl, config.apiKey);
  const opexRows = fetchJson(config.baseUrl + '/rest/v1/operational_expenses?tanggal=eq.' + today + '&category=eq.' + encodeURIComponent('Beban Operasional Harian') + '&select=branch_id', config.apiKey) || [];

  var doneSet = new Set(opexRows.map(function(r) { return r.branch_id }));
  
  var sendFilteredMessage = function(webhookUrl, filterFn, groupName) {
    if (!webhookUrl) return;
    var filteredBranches = branches.filter(filterFn);
    var belum = filteredBranches.filter(function(b) { return !doneSet.has(b.id); });
    
    if (belum.length === 0) return;

    var lines = ['💰 *[' + groupName + '] Belum Input Opex (BOH)* — ' + formatTanggal(today), ''];
    belum.forEach(function(b) { lines.push('   • ' + shortName(b.name) + ' _[' + b.district + ']_'); });
    sendToGChat(webhookUrl, { text: lines.join('\n') });
  };

  sendFilteredMessage(config.webhookAll, function() { return true; }, "ALL");
  sendFilteredMessage(config.webhookJKT, function(b) { return b.district === 'JKT'; }, "JKT");
  sendFilteredMessage(config.webhookBTN, function(b) { return b.district === 'BTN'; }, "BTN");
}

function notifLaporan() {
  const config = getConfig();
  const yesterday = getYesterdayWIB();
  const branches = fetchBranches(config.baseUrl, config.apiKey);
  const reports = fetchJson(config.baseUrl + '/rest/v1/daily_reports?tanggal=eq.' + yesterday + '&select=branch_id', config.apiKey) || [];
  const reportSet = new Set(reports.map(function(r) { return r.branch_id; }));

  var sendFilteredMessage = function(webhookUrl, filterFn, groupName) {
    if (!webhookUrl) return;
    var filteredBranches = branches.filter(filterFn);
    var belum = filteredBranches.filter(function(b) { return !reportSet.has(b.id); });
    if (belum.length === 0) return;

    var lines = ['📝 *[' + groupName + '] Belum Laporan Harian* — ' + formatTanggal(yesterday), ''];
    belum.forEach(function(b) { lines.push('   • ' + shortName(b.name) + ' _[' + b.district + ']_'); });
    sendToGChat(webhookUrl, { text: lines.join('\n') });
  };

  sendFilteredMessage(config.webhookAll, function() { return true; }, "ALL");
  sendFilteredMessage(config.webhookJKT, function(b) { return b.district === 'JKT'; }, "JKT");
  sendFilteredMessage(config.webhookBTN, function(b) { return b.district === 'BTN'; }, "BTN");
}

function notifVisit() {
  const config = getConfig();
  const today = getTodayWIB();
  const managers = fetchJson(config.baseUrl + '/rest/v1/profiles?role=in.(district_manager,area_manager)&select=id,full_name,managed_districts', config.apiKey) || [];
  const visits = fetchJson(config.baseUrl + '/rest/v1/daily_visits?tanggal=eq.' + today + '&select=auditor_id', config.apiKey) || [];

  const visitMap = new Set(visits.map(function(v) { return v.auditor_id }));

  var sendFilteredMessage = function(webhookUrl, district, groupName) {
    if (!webhookUrl) return;
    var filteredManagers = district 
      ? managers.filter(function(m) { return m.managed_districts && m.managed_districts.indexOf(district) !== -1; })
      : managers;
    var belum = filteredManagers.filter(function(m) { return !visitMap.has(m.id); });
    if (belum.length === 0) return;
    var lines = ['🚗 *[' + groupName + '] DM/AM Belum Visit* — ' + formatTanggal(today), ''];
    belum.forEach(function(m) { lines.push('   • ' + m.full_name); });
    sendToGChat(webhookUrl, { text: lines.join('\n') });
  };

  sendFilteredMessage(config.webhookAll, null, "ALL");
  sendFilteredMessage(config.webhookJKT, "JKT", "JKT");
  sendFilteredMessage(config.webhookBTN, "BTN", "BTN");
}

// ─── HELPERS ─────────────────────────────────────────────────

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

function fetchBranches(baseUrl, apiKey) {
  return fetchJson(baseUrl + '/rest/v1/branches?is_active=eq.true&select=id,name,district&order=district,name', apiKey);
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

function getTodayWIB() {
  var wib = new Date(new Date().getTime() + 7 * 3600000);
  return wib.getUTCFullYear() + '-' + String(wib.getUTCMonth() + 1).padStart(2, '0') + '-' + String(wib.getUTCDate()).padStart(2, '0');
}

function getYesterdayWIB() {
  var wib = new Date(new Date().getTime() + 7 * 3600000 - 86400000);
  return wib.getUTCFullYear() + '-' + String(wib.getUTCMonth() + 1).padStart(2, '0') + '-' + String(wib.getUTCDate()).padStart(2, '0');
}

function getJamWIBNow() {
  var wib = new Date(new Date().getTime() + 7 * 3600000);
  return String(wib.getUTCHours()).padStart(2, '0') + ':' + String(wib.getUTCMinutes()).padStart(2, '0');
}

function formatTanggal(iso) {
  if (!iso) return '';
  var p = iso.split('-'), m = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  return parseInt(p[2]) + ' ' + m[parseInt(p[1]) - 1] + ' ' + p[0];
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

function setupTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t) { ScriptApp.deleteTrigger(t); });
  
  ScriptApp.newTrigger('triggerClosing').timeBased().everyDays(1).atHour(22).inTimezone('UTC').create();
  ScriptApp.newTrigger('triggerPagi').timeBased().everyDays(1).atHour(2).nearMinute(30).inTimezone('UTC').create();
  ScriptApp.newTrigger('triggerMiddle').timeBased().everyDays(1).atHour(8).nearMinute(30).inTimezone('UTC').create();
  ScriptApp.newTrigger('triggerFinanceOpexLaporan').timeBased().everyDays(1).atHour(12).nearMinute(30).inTimezone('UTC').create();
  ScriptApp.newTrigger('triggerMalam').timeBased().everyDays(1).atHour(13).inTimezone('UTC').create();
  ScriptApp.newTrigger('triggerVisit').timeBased().everyDays(1).atHour(15).inTimezone('UTC').create();
}
