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
 *   23:00 → Rekap SC             (surat_jalan tanggal hari ini)
 *   23:00 → Rekap Opex BOH       (operational_expenses, kategori BOH)
 *   23:00 → Rekap Laporan Harian (daily_reports, tanggal kemarin)
 *   23:00 → Compliance Harian    (ceklis + laporan + setoran + opex)
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

// ─── Rekap 23:00 WIB ────────────────────────────────────────

function notifSC() {
  const { baseUrl, apiKey, webhook } = getConfig()
  if (!baseUrl) return

  const today = getTodayWIB()

  const sjs = fetchJson(
    baseUrl + '/rest/v1/surat_jalan?tanggal_kirim=eq.' + today +
    '&status=not.eq.draft&select=sj_number,status,issued_at,received_at,branch_id,branches(name)&order=issued_at',
    apiKey
  )
  if (sjs === null) { Logger.log('ERROR: Gagal fetch surat_jalan'); return }

  var lines = ['📦 *Rekap Pengiriman SC* — ' + formatTanggal(today) + ' (' + getJamWIBNow() + ' WIB)', '']

  if (sjs.length === 0) {
    lines.push('_Tidak ada pengiriman hari ini._')
    sendToGChat(webhook, { text: lines.join('\n') })
    return
  }

  lines.push('*' + sjs.length + ' Surat Jalan* dikirim hari ini')

  const delivered = sjs.filter(function(sj) { return sj.status === 'delivered' })
  const pending   = sjs.filter(function(sj) { return sj.status !== 'delivered' })

  if (delivered.length > 0) {
    lines.push('', '✅ *Sudah diterima (' + delivered.length + '):*')
    delivered.forEach(function(sj) {
      var nama = sj.branches ? shortName(sj.branches.name) : '-'
      lines.push('  • ' + nama + ' [' + sj.sj_number + '] — Kirim ' + fmtJamWIB(sj.issued_at) + ', Terima ' + fmtJamWIB(sj.received_at))
    })
  }

  if (pending.length > 0) {
    lines.push('', '⏳ *Belum diterima (' + pending.length + '):*')
    pending.forEach(function(sj) {
      var nama        = sj.branches ? shortName(sj.branches.name) : '-'
      var statusLabel = { issued: 'Diterbitkan', shipped: 'Dalam perjalanan' }[sj.status] || sj.status
      lines.push('  • ' + nama + ' [' + sj.sj_number + '] — Kirim ' + fmtJamWIB(sj.issued_at) + ' (' + statusLabel + ')')
    })
  }

  sendToGChat(webhook, { text: lines.join('\n') })
}

function notifOpex() {
  const { baseUrl, apiKey, webhook } = getConfig()
  if (!baseUrl) return

  const today    = getTodayWIB()
  const branches = fetchBranches(baseUrl, apiKey)
  if (!branches) { Logger.log('ERROR: Gagal fetch branches'); return }

  const opexRows = fetchJson(
    baseUrl + '/rest/v1/operational_expenses?tanggal=eq.' + today +
    '&category=eq.' + encodeURIComponent('Beban Operasional Harian') +
    '&select=branch_id,total',
    apiKey
  )
  if (opexRows === null) { Logger.log('ERROR: Gagal fetch opex'); return }

  var totalByBranch = {}
  opexRows.forEach(function(row) {
    totalByBranch[row.branch_id] = (totalByBranch[row.branch_id] || 0) + Number(row.total || 0)
  })

  var sudah = []
  var belum = []
  branches.forEach(function(b) {
    if (totalByBranch[b.id] !== undefined) {
      sudah.push({ name: b.name, district: b.district, total: totalByBranch[b.id] })
    } else {
      belum.push(b)
    }
  })

  var lines = ['💰 *Rekap Opex Harian (BOH)* — ' + formatTanggal(today) + ' (' + getJamWIBNow() + ' WIB)', '']

  if (sudah.length > 0) {
    lines.push('✅ *Sudah input (' + sudah.length + ' toko):*')
    sudah.forEach(function(b) {
      lines.push('  • ' + shortName(b.name) + ' — ' + fmtRp(b.total))
    })
  }

  if (belum.length > 0) {
    lines.push('', '❌ *Belum input (' + belum.length + ' toko):*')
    belum.forEach(function(b) {
      lines.push('  • ' + shortName(b.name) + ' _[' + b.district + ']_')
    })
  }

  sendToGChat(webhook, { text: lines.join('\n') })
}

function notifLaporan() {
  const { baseUrl, apiKey, webhook } = getConfig()
  if (!baseUrl) return

  // Laporan harian = tanggal operasional kemarin, deadline submit H+1 14:00 WIB
  const yesterday = getYesterdayWIB()
  const branches  = fetchBranches(baseUrl, apiKey)
  if (!branches) { Logger.log('ERROR: Gagal fetch branches'); return }

  const reports = fetchJson(
    baseUrl + '/rest/v1/daily_reports?tanggal=eq.' + yesterday + '&select=branch_id,net_sales,is_late',
    apiKey
  )
  if (reports === null) { Logger.log('ERROR: Gagal fetch daily_reports'); return }

  var reportMap = {}
  reports.forEach(function(r) { reportMap[r.branch_id] = r })

  var sudah = []
  var belum = []
  branches.forEach(function(b) {
    if (reportMap[b.id]) {
      sudah.push({ name: b.name, district: b.district, report: reportMap[b.id] })
    } else {
      belum.push(b)
    }
  })

  var lines = ['📝 *Rekap Laporan Harian* — ' + formatTanggal(yesterday) + ' (' + getJamWIBNow() + ' WIB)', '']

  if (sudah.length > 0) {
    lines.push('✅ *Sudah laporan (' + sudah.length + ' toko):*')
    sudah.forEach(function(item) {
      var late = item.report.is_late ? ' ⚠️ terlambat' : ''
      lines.push('  • ' + shortName(item.name) + ' — ' + fmtRp(item.report.net_sales) + late)
    })
  }

  if (belum.length > 0) {
    lines.push('', '❌ *Belum laporan (' + belum.length + ' toko):*')
    belum.forEach(function(b) {
      lines.push('  • ' + shortName(b.name) + ' _[' + b.district + ']_')
    })
  }

  if (belum.length === 0 && sudah.length === branches.length) {
    lines.push('', '🎉 Semua toko sudah submit laporan!')
  }

  sendToGChat(webhook, { text: lines.join('\n') })
}

function notifCompliance() {
  const { baseUrl, apiKey, webhook } = getConfig()
  if (!baseUrl) return

  const today     = getTodayWIB()
  const yesterday = getYesterdayWIB()
  const branches  = fetchBranches(baseUrl, apiKey)
  if (!branches) { Logger.log('ERROR: Gagal fetch branches'); return }

  // Fetch semua data sekaligus (sequential, Apps Script tidak punya Promise.all)
  const ceklisData  = fetchJson(baseUrl + '/rest/v1/daily_checklists?tanggal=eq.' + today + '&select=branch_id,shift', apiKey)
  const setoranData = fetchJson(baseUrl + '/rest/v1/daily_deposits?tanggal=eq.' + today + '&status=in.(submitted,approved)&select=branch_id', apiKey)
  const laporanData = fetchJson(baseUrl + '/rest/v1/daily_reports?tanggal=eq.' + yesterday + '&select=branch_id', apiKey)
  const opexData    = fetchJson(
    baseUrl + '/rest/v1/operational_expenses?tanggal=eq.' + today +
    '&category=eq.' + encodeURIComponent('Beban Operasional Harian') +
    '&select=branch_id',
    apiKey
  )

  if (!ceklisData || !setoranData || !laporanData || !opexData) {
    Logger.log('ERROR: Gagal fetch data compliance')
    return
  }

  var pagiSet   = new Set()
  var middleSet = new Set()
  var malamSet  = new Set()
  ceklisData.forEach(function(r) {
    if (r.shift === 'pagi')   pagiSet.add(r.branch_id)
    if (r.shift === 'middle') middleSet.add(r.branch_id)
    if (r.shift === 'malam')  malamSet.add(r.branch_id)
  })

  var setoranSet = new Set(setoranData.map(function(r) { return r.branch_id }))
  var laporanSet = new Set(laporanData.map(function(r) { return r.branch_id }))
  var opexSet    = new Set(opexData.map(function(r) { return r.branch_id }))

  var fullComply = []
  var partial    = []

  branches.forEach(function(b) {
    var missing = []
    if (!pagiSet.has(b.id))    missing.push('Pkl Pagi')
    if (!middleSet.has(b.id))  missing.push('Pkl Mid')
    if (!malamSet.has(b.id))   missing.push('Pkl Mlm')
    if (!laporanSet.has(b.id)) missing.push('Laporan')
    if (!setoranSet.has(b.id)) missing.push('Setoran')
    if (!opexSet.has(b.id))    missing.push('Opex BOH')

    if (missing.length === 0) {
      fullComply.push(b)
    } else {
      partial.push({ name: b.name, district: b.district, missing: missing })
    }
  })

  // Urutkan partial: terbanyak missing dulu
  partial.sort(function(a, b) { return b.missing.length - a.missing.length })

  var lines = ['📊 *Compliance Harian* — ' + formatTanggal(today) + ' (' + getJamWIBNow() + ' WIB)', '']
  lines.push('🏆 *Full comply: ' + fullComply.length + ' / ' + branches.length + ' toko*')

  if (partial.length > 0) {
    lines.push('', '⚠️ *Perlu perhatian (' + partial.length + ' toko):*')
    partial.forEach(function(item) {
      lines.push('  • ' + shortName(item.name) + ' _[' + item.district + ']_ — ❌ ' + item.missing.join(', ❌ '))
    })
  } else {
    lines.push('', '🎉 Semua toko full comply hari ini!')
  }

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

  if (belum.length === 0) {
    sendToGChat(webhook, { text: '✅ *Ceklis ' + LABEL[shift] + ' — semua sudah submit* — ' + formatTanggal(tanggal) })
    return
  }

  var lines = [
    '📋 *Ceklis ' + LABEL[shift] + ' Belum Submit* — ' + formatTanggal(tanggal) + ' (' + getJamWIBNow() + ' WIB)',
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

  const managers = fetchJson(
    baseUrl + '/rest/v1/profiles?role=in.(district_manager,area_manager)&select=id,full_name,role',
    apiKey
  )
  if (!managers) { Logger.log('ERROR: Gagal fetch managers'); return }

  const visits = fetchJson(
    baseUrl + '/rest/v1/daily_visits?tanggal=eq.' + today + '&select=auditor_id,branch_id',
    apiKey
  )
  if (visits === null) { Logger.log('ERROR: Gagal fetch visits'); return }

  const branchMap = {}
  branches.forEach(function(b) { branchMap[b.id] = shortName(b.name) })

  const visitMap = {}
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

function fmtJamWIB(isoStr) {
  if (!isoStr) return '-'
  var d   = new Date(isoStr)
  var wib = new Date(d.getTime() + 7 * 3600000)
  return String(wib.getUTCHours()).padStart(2, '0') + ':' + String(wib.getUTCMinutes()).padStart(2, '0')
}

function fmtRp(amount) {
  return 'Rp ' + Math.round(Number(amount) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

function shortName(name) {
  return (name || '').replace(/^Bagi Kopi\s+/i, '')
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
 *   23:00 WIB = 16:00 UTC  → Rekap SC, Opex, Laporan, Compliance
 */
function setupTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t) { ScriptApp.deleteTrigger(t) })

  var schedule = [
    { fn: 'notifCeklisPagi',          hour: 1  },   // 08:00–09:00 WIB
    { fn: 'notifPrepPagi',            hour: 2  },   // 09:00–10:00 WIB
    { fn: 'notifCeklisMiddle',        hour: 8  },   // 15:00–16:00 WIB
    { fn: 'notifPrepMiddle',          hour: 8  },   // 15:00–16:00 WIB
    { fn: 'notifVisit',               hour: 10 },   // 17:00–18:00 WIB
    { fn: 'notifPrepMalam',           hour: 13 },   // 20:00–21:00 WIB
    { fn: 'notifikasiBeluSetoran',    hour: 14 },   // 21:00–22:00 WIB
    { fn: 'notifSC',                  hour: 16 },   // 23:00–00:00 WIB
    { fn: 'notifOpex',                hour: 16 },   // 23:00–00:00 WIB
    { fn: 'notifLaporan',             hour: 16 },   // 23:00–00:00 WIB
    { fn: 'notifCompliance',          hour: 16 },   // 23:00–00:00 WIB
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
  notifCompliance()
  // notifSC()
  // notifOpex()
  // notifLaporan()
  // notifVisit()
  // notifCeklisPagi()
  // notifPrepPagi()
  // notifikasiBeluSetoran()
}

// ─── Diagnostik key (jalankan jika ada error 401) ─────────────
function debugKey() {
  var key = PropertiesService.getScriptProperties().getProperty('SUPABASE_SERVICE_KEY') || ''
  Logger.log('Panjang key : ' + key.length)
  Logger.log('Awal        : [' + key.substring(0, 20) + ']')
  Logger.log('Akhir       : [' + key.substring(key.length - 20) + ']')
}
