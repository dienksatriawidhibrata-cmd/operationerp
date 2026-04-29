/**
 * NOTIFIKASI HARIAN — Google Chat (BagiKopi Ops)
 * ─────────────────────────────────────────────────────────────
 * Script Apps Script BARU — project terpisah dari script foto/SOP.
 *
 * SETUP (lakukan sekali):
 * 1. Buat project baru di script.google.com
 * 2. Paste seluruh isi file ini
 * 3. Project > Project settings > Script Properties, tambahkan:
 *      SUPABASE_URL         → https://xxxxxx.supabase.co
 *      SUPABASE_SERVICE_KEY → service_role key (Supabase > Settings > API)
 *      GCHAT_WEBHOOK_URL    → webhook URL dari Google Chat space
 * 4. Jalankan setupTrigger() SEKALI dari menu Run
 * 5. Authorize permission yang diminta Google
 *
 * JADWAL TRIGGER (WIB):
 *   08:30 → Ceklis Pagi          (shift pagi, tanggal hari ini)
 *   09:00 → Preparation Pagi     (shift pagi, tanggal hari ini)
 *   15:00 → Ceklis Middle        (shift middle, tanggal hari ini)
 *   15:30 → Preparation Middle   (shift middle, tanggal hari ini)
 *   17:00 → Visit DM/AM          (siapa sudah visit + di toko mana)
 *   20:00 → Preparation Malam    (shift malam, tanggal hari ini)
 *   21:00 → Setoran              (daily_deposits, tanggal hari ini)
 *   04:00 → Ceklis Malam         (shift malam, tanggal KEMARIN WIB)
 */

// ═══════════════════════════════════════════════════════════════
// ENTRYPOINTS — dipanggil oleh masing-masing trigger
// ═══════════════════════════════════════════════════════════════

function notifCeklisPagi()   { notifCeklis('pagi',   getTodayWIB())     }
function notifCeklisMiddle() { notifCeklis('middle', getTodayWIB())     }
function notifCeklisMalam()  { notifCeklis('malam',  getYesterdayWIB()) } // trigger 21:00 UTC = 04:00 WIB besok, cek kemarin

function notifPrepPagi()     { notifPrep('pagi',   getTodayWIB()) }
function notifPrepMiddle()   { notifPrep('middle', getTodayWIB()) }
function notifPrepMalam()    { notifPrep('malam',  getTodayWIB()) }

function notifikasiBeluSetoran() {
  const { baseUrl, apiKey, webhook } = getConfig()
  if (!baseUrl) return

  const today    = getTodayWIB()
  const branches = fetchBranches(baseUrl, apiKey)
  if (!branches) { Logger.log('ERROR: Gagal fetch branches'); return }

  const deposits = fetchJson(baseUrl + '/rest/v1/daily_deposits?tanggal=eq.' + today + '&select=branch_id,status', apiKey)
  if (deposits === null) { Logger.log('ERROR: Gagal fetch deposits'); return }

  const submitted = new Set()
  const rejected  = new Set()
  deposits.forEach(function(d) {
    if (d.status === 'rejected') rejected.add(d.branch_id)
    else submitted.add(d.branch_id)
  })

  const belumSama   = []
  const perluRevisi = []
  branches.forEach(function(b) {
    if (submitted.has(b.id)) return
    if (rejected.has(b.id)) perluRevisi.push(b)
    else belumSama.push(b)
  })

  const totalBelum = belumSama.length + perluRevisi.length
  if (totalBelum === 0) {
    sendToGChat(webhook, { text: '✅ *Semua toko sudah setoran* — ' + formatTanggal(today) + '\n' + branches.length + ' toko ✔️' })
    return
  }

  var lines = ['🔴 *Toko Belum Setoran* — ' + formatTanggal(today) + ' (' + getJamWIBNow() + ' WIB)', '']
  lines.push('*' + totalBelum + ' dari ' + branches.length + ' toko* belum setor:')
  if (belumSama.length > 0) {
    lines.push('', '📋 *Belum submit (' + belumSama.length + '):*')
    belumSama.forEach(function(b) { lines.push('  • ' + shortName(b.name) + ' _[' + b.district + ']_') })
  }
  if (perluRevisi.length > 0) {
    lines.push('', '⚠️ *Perlu revisi (' + perluRevisi.length + '):*')
    perluRevisi.forEach(function(b) { lines.push('  • ' + shortName(b.name) + ' _[' + b.district + ']_') })
  }
  lines.push('', '_Cek detail di operationerp.pages.dev_')
  sendToGChat(webhook, { text: lines.join('\n') })
}

// ═══════════════════════════════════════════════════════════════
// LOGIKA UTAMA
// ═══════════════════════════════════════════════════════════════

function notifCeklis(shift, tanggal) {
  const { baseUrl, apiKey, webhook } = getConfig()
  if (!baseUrl) return

  const branches = fetchBranches(baseUrl, apiKey)
  if (!branches) { Logger.log('ERROR: Gagal fetch branches'); return }

  const done = fetchJson(
    baseUrl + '/rest/v1/daily_checklists?shift=eq.' + shift + '&tanggal=eq.' + tanggal + '&select=branch_id',
    apiKey
  )
  if (done === null) { Logger.log('ERROR: Gagal fetch ceklis ' + shift); return }

  const doneSet = new Set(done.map(function(r) { return r.branch_id }))
  const belum   = branches.filter(function(b) { return !doneSet.has(b.id) })

  const LABEL = { pagi: 'Pagi ☀️', middle: 'Middle 🌤', malam: 'Malam 🌙' }
  const EMOJI = { pagi: '📋', middle: '📋', malam: '📋' }

  if (belum.length === 0) {
    sendToGChat(webhook, { text: '✅ *Ceklis ' + LABEL[shift] + ' — semua sudah submit* — ' + formatTanggal(tanggal) })
    return
  }

  var lines = [
    EMOJI[shift] + ' *Ceklis ' + LABEL[shift] + ' Belum Submit* — ' + formatTanggal(tanggal) + ' (' + getJamWIBNow() + ' WIB)',
    '',
    '*' + belum.length + ' dari ' + branches.length + ' toko* belum submit:',
  ]
  belum.forEach(function(b) { lines.push('  • ' + shortName(b.name) + ' _[' + b.district + ']_') })
  sendToGChat(webhook, { text: lines.join('\n') })
}

function notifPrep(shift, tanggal) {
  const { baseUrl, apiKey, webhook } = getConfig()
  if (!baseUrl) return

  const branches = fetchBranches(baseUrl, apiKey)
  if (!branches) { Logger.log('ERROR: Gagal fetch branches'); return }

  const done = fetchJson(
    baseUrl + '/rest/v1/daily_preparation?shift=eq.' + shift + '&tanggal=eq.' + tanggal + '&select=branch_id',
    apiKey
  )
  if (done === null) { Logger.log('ERROR: Gagal fetch preparation ' + shift); return }

  const doneSet = new Set(done.map(function(r) { return r.branch_id }))
  const belum   = branches.filter(function(b) { return !doneSet.has(b.id) })

  const LABEL = { pagi: 'Pagi ☀️', middle: 'Middle 🌤', malam: 'Malam 🌙' }

  if (belum.length === 0) {
    sendToGChat(webhook, { text: '✅ *Preparation ' + LABEL[shift] + ' — semua sudah submit* — ' + formatTanggal(tanggal) })
    return
  }

  var lines = [
    '🍳 *Preparation ' + LABEL[shift] + ' Belum Submit* — ' + formatTanggal(tanggal) + ' (' + getJamWIBNow() + ' WIB)',
    '',
    '*' + belum.length + ' dari ' + branches.length + ' toko* belum submit:',
  ]
  belum.forEach(function(b) { lines.push('  • ' + shortName(b.name) + ' _[' + b.district + ']_') })
  sendToGChat(webhook, { text: lines.join('\n') })
}

function notifVisit() {
  const { baseUrl, apiKey, webhook } = getConfig()
  if (!baseUrl) return

  const today    = getTodayWIB()
  const branches = fetchBranches(baseUrl, apiKey)
  if (!branches) { Logger.log('ERROR: Gagal fetch branches'); return }

  // Ambil semua DM + AM
  const managers = fetchJson(
    baseUrl + '/rest/v1/profiles?role=in.(district_manager,area_manager)&select=id,full_name,role',
    apiKey
  )
  if (!managers) { Logger.log('ERROR: Gagal fetch managers'); return }

  // Ambil visit hari ini
  const visits = fetchJson(
    baseUrl + '/rest/v1/daily_visits?tanggal=eq.' + today + '&select=auditor_id,branch_id',
    apiKey
  )
  if (visits === null) { Logger.log('ERROR: Gagal fetch visits'); return }

  // Map branch_id → nama
  const branchMap = {}
  branches.forEach(function(b) { branchMap[b.id] = shortName(b.name) })

  // Kelompokkan visit per auditor
  const visitMap = {} // auditor_id → [branch names]
  visits.forEach(function(v) {
    if (!visitMap[v.auditor_id]) visitMap[v.auditor_id] = []
    if (branchMap[v.branch_id]) visitMap[v.auditor_id].push(branchMap[v.branch_id])
  })

  const sudah = managers.filter(function(m) { return visitMap[m.id] && visitMap[m.id].length > 0 })
  const belum = managers.filter(function(m) { return !visitMap[m.id] || visitMap[m.id].length === 0 })

  const ROLE_LABEL = { district_manager: 'DM', area_manager: 'AM' }

  var lines = ['🚗 *Visit DM/AM* — ' + formatTanggal(today) + ' (' + getJamWIBNow() + ' WIB)', '']

  if (sudah.length > 0) {
    lines.push('✅ *Sudah visit (' + sudah.length + '):*')
    sudah.forEach(function(m) {
      lines.push('  • ' + m.full_name + ' [' + (ROLE_LABEL[m.role] || m.role) + '] → ' + visitMap[m.id].join(', '))
    })
  }

  if (belum.length > 0) {
    lines.push('')
    lines.push('❌ *Belum visit (' + belum.length + '):*')
    belum.forEach(function(m) {
      lines.push('  • ' + m.full_name + ' [' + (ROLE_LABEL[m.role] || m.role) + ']')
    })
  }

  if (sudah.length === 0 && belum.length === 0) {
    lines.push('_Tidak ada data DM/AM._')
  }

  sendToGChat(webhook, { text: lines.join('\n') })
}

// ═══════════════════════════════════════════════════════════════
// HELPERS — Supabase
// ═══════════════════════════════════════════════════════════════

function getConfig() {
  const props   = PropertiesService.getScriptProperties()
  const baseUrl = props.getProperty('SUPABASE_URL')
  const apiKey  = props.getProperty('SUPABASE_SERVICE_KEY')
  const webhook = props.getProperty('GCHAT_WEBHOOK_URL')
  if (!baseUrl || !apiKey || !webhook) {
    Logger.log('ERROR: Script Properties belum lengkap')
    return {}
  }
  return { baseUrl: baseUrl, apiKey: apiKey, webhook: webhook }
}

function fetchBranches(baseUrl, apiKey) {
  return fetchJson(baseUrl + '/rest/v1/branches?is_active=eq.true&select=id,name,district&order=district,name', apiKey)
}

function fetchJson(url, apiKey) {
  try {
    var res  = UrlFetchApp.fetch(url, {
      method: 'GET',
      headers: { 'apikey': apiKey, 'Authorization': 'Bearer ' + apiKey },
      muteHttpExceptions: true,
    })
    var code = res.getResponseCode()
    if (code !== 200) { Logger.log('HTTP ' + code + ' — ' + res.getContentText()); return null }
    return JSON.parse(res.getContentText())
  } catch (e) {
    Logger.log('Fetch error: ' + e.message)
    return null
  }
}

function sendToGChat(webhookUrl, payload) {
  UrlFetchApp.fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  })
}

// ═══════════════════════════════════════════════════════════════
// HELPERS — Tanggal & Format
// ═══════════════════════════════════════════════════════════════

function getTodayWIB() {
  var wib = new Date(new Date().getTime() + 7 * 3600000)
  return wib.getUTCFullYear() + '-' +
    String(wib.getUTCMonth() + 1).padStart(2, '0') + '-' +
    String(wib.getUTCDate()).padStart(2, '0')
}

function getYesterdayWIB() {
  var wib = new Date(new Date().getTime() + 7 * 3600000 - 86400000)
  return wib.getUTCFullYear() + '-' +
    String(wib.getUTCMonth() + 1).padStart(2, '0') + '-' +
    String(wib.getUTCDate()).padStart(2, '0')
}

function getJamWIBNow() {
  var wib = new Date(new Date().getTime() + 7 * 3600000)
  return String(wib.getUTCHours()).padStart(2, '0') + ':' + String(wib.getUTCMinutes()).padStart(2, '0')
}

function formatTanggal(iso) {
  var p = iso.split('-')
  var m = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']
  return parseInt(p[2]) + ' ' + m[parseInt(p[1]) - 1] + ' ' + p[0]
}

function shortName(name) {
  return name.replace(/^Bagi Kopi\s+/i, '')
}

// ═══════════════════════════════════════════════════════════════
// SETUP TRIGGER — jalankan SATU KALI secara manual
// ═══════════════════════════════════════════════════════════════

/**
 * Daftarkan semua trigger otomatis sekaligus.
 * Jalankan dari menu Run > setupTrigger (hanya sekali).
 *
 * WIB → UTC:
 *   04:00 WIB = 21:00 UTC  → Ceklis Malam (cek tanggal kemarin)
 *   08:30 WIB ≈ 01:00 UTC  → Ceklis Pagi
 *   09:00 WIB ≈ 02:00 UTC  → Preparation Pagi
 *   15:00 WIB = 08:00 UTC  → Ceklis Middle
 *   15:30 WIB ≈ 08:00 UTC  → Preparation Middle (sama hour, trigger berbeda)
 *   17:00 WIB = 10:00 UTC  → Visit DM/AM
 *   20:00 WIB = 13:00 UTC  → Preparation Malam
 *   21:00 WIB = 14:00 UTC  → Setoran
 */
function setupTrigger() {
  // Hapus semua trigger lama milik script ini
  ScriptApp.getProjectTriggers().forEach(function(t) { ScriptApp.deleteTrigger(t) })

  var schedule = [
    { fn: 'notifCeklisPagi',          hour: 1  },   // 08:00–09:00 WIB
    { fn: 'notifPrepPagi',            hour: 2  },   // 09:00–10:00 WIB
    { fn: 'notifCeklisMiddle',        hour: 8  },   // 15:00–16:00 WIB
    { fn: 'notifPrepMiddle',          hour: 8  },   // 15:00–16:00 WIB
    { fn: 'notifVisit',               hour: 10 },   // 17:00–18:00 WIB
    { fn: 'notifPrepMalam',           hour: 13 },   // 20:00–21:00 WIB
    { fn: 'notifikasiBeluSetoran',    hour: 14 },   // 21:00–22:00 WIB
    { fn: 'notifCeklisMalam',         hour: 21 },   // 04:00–05:00 WIB (besok)
  ]

  schedule.forEach(function(s) {
    ScriptApp.newTrigger(s.fn)
      .timeBased()
      .everyDays(1)
      .atHour(s.hour)
      .inTimezone('UTC')
      .create()
  })

  Logger.log('Berhasil daftarkan ' + schedule.length + ' trigger.')
}

// ═══════════════════════════════════════════════════════════════
// TEST MANUAL — jalankan dari editor untuk coba
// ═══════════════════════════════════════════════════════════════

function testManual() {
  // Ganti fungsi yang ingin ditest:
  notifVisit()
  // notifCeklisPagi()
  // notifPrepPagi()
  // notifikasiBeluSetoran()
}
