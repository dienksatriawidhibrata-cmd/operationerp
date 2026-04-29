/**
 * NOTIFIKASI BELUM SETORAN — Google Chat
 * ─────────────────────────────────────────────────────────────
 * Script Apps Script BARU (project terpisah dari script foto/SOP).
 * Kirim pesan ke Google Chat space setiap malam berisi daftar
 * toko yang belum submit daily_deposits hari ini.
 *
 * SETUP (lakukan sekali):
 * 1. Buat project baru di script.google.com
 * 2. Paste seluruh isi file ini
 * 3. Project > Project settings > Script Properties, tambahkan:
 *      SUPABASE_URL        → https://xxxxxx.supabase.co
 *      SUPABASE_SERVICE_KEY → eyJ... (service_role key dari Supabase > Settings > API)
 *      GCHAT_WEBHOOK_URL   → https://chat.googleapis.com/v1/spaces/... (dari Google Chat space)
 * 4. Jalankan setupTrigger() SEKALI untuk daftarkan time-trigger otomatis (21:00 WIB)
 * 5. Authorize permission yang diminta Google
 */

// ── Entrypoint utama (dipanggil trigger) ──────────────────────
function notifikasiBeluSetoran() {
  const props    = PropertiesService.getScriptProperties()
  const baseUrl  = props.getProperty('SUPABASE_URL')
  const apiKey   = props.getProperty('SUPABASE_SERVICE_KEY')
  const webhook  = props.getProperty('GCHAT_WEBHOOK_URL')

  if (!baseUrl || !apiKey || !webhook) {
    Logger.log('ERROR: Script Properties belum lengkap (SUPABASE_URL / SUPABASE_SERVICE_KEY / GCHAT_WEBHOOK_URL)')
    return
  }

  const today = getTodayWIB()    // format: 'YYYY-MM-DD' dalam timezone WIB

  // 1. Ambil semua branch aktif
  const branches = fetchBranches(baseUrl, apiKey)
  if (!branches) {
    Logger.log('ERROR: Gagal fetch branches')
    return
  }

  // 2. Ambil semua deposits yang sudah masuk hari ini
  const deposits = fetchDepositsToday(baseUrl, apiKey, today)
  if (deposits === null) {
    Logger.log('ERROR: Gagal fetch daily_deposits')
    return
  }

  // 3. Pisahkan deposits per branch_id dan status
  const submitted  = new Set()   // status: submitted / approved
  const rejected   = new Set()   // status: rejected — perlu revisi

  deposits.forEach(function(d) {
    if (d.status === 'rejected') {
      rejected.add(d.branch_id)
    } else {
      submitted.add(d.branch_id)
    }
  })

  // 4. Klasifikasikan tiap branch
  const belumSama   = []   // belum ada row sama sekali
  const perluRevisi = []   // status rejected

  branches.forEach(function(b) {
    if (submitted.has(b.id)) return  // sudah submit / approved — skip
    if (rejected.has(b.id)) {
      perluRevisi.push(b)
    } else {
      belumSama.push(b)
    }
  })

  const totalBelum = belumSama.length + perluRevisi.length

  // 5. Kalau semua sudah setoran, kirim pesan sukses singkat dan selesai
  if (totalBelum === 0) {
    sendToGChat(webhook, buildAllDoneMessage(today, branches.length))
    return
  }

  // 6. Kirim notifikasi toko yang belum
  sendToGChat(webhook, buildAlertMessage(today, branches.length, belumSama, perluRevisi))
}

// ── Helpers: Supabase fetch ───────────────────────────────────

function fetchBranches(baseUrl, apiKey) {
  var url = baseUrl + '/rest/v1/branches?is_active=eq.true&select=id,name,district&order=district,name'
  var res = supabaseGet(url, apiKey)
  return res
}

function fetchDepositsToday(baseUrl, apiKey, today) {
  var url = baseUrl + '/rest/v1/daily_deposits?tanggal=eq.' + today + '&select=branch_id,status'
  var res = supabaseGet(url, apiKey)
  return res
}

function supabaseGet(url, apiKey) {
  try {
    var response = UrlFetchApp.fetch(url, {
      method: 'GET',
      headers: {
        'apikey': apiKey,
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
      },
      muteHttpExceptions: true,
    })

    var code = response.getResponseCode()
    if (code !== 200) {
      Logger.log('HTTP ' + code + ' — ' + response.getContentText())
      return null
    }

    return JSON.parse(response.getContentText())
  } catch (e) {
    Logger.log('Fetch error: ' + e.message)
    return null
  }
}

// ── Helpers: pesan Google Chat ────────────────────────────────

function buildAlertMessage(today, totalBranch, belumSama, perluRevisi) {
  var tanggalFmt  = formatTanggal(today)
  var totalBelum  = belumSama.length + perluRevisi.length
  var jam         = getJamWIBNow()

  var lines = []
  lines.push('🔴 *Toko Belum Setoran* — ' + tanggalFmt + ' (' + jam + ' WIB)')
  lines.push('')
  lines.push('*' + totalBelum + ' dari ' + totalBranch + ' toko* belum setor:')

  if (belumSama.length > 0) {
    lines.push('')
    lines.push('📋 *Belum submit sama sekali (' + belumSama.length + '):*')
    belumSama.forEach(function(b) {
      lines.push('  • ' + cleanBranchName(b.name) + ' _[' + b.district + ']_')
    })
  }

  if (perluRevisi.length > 0) {
    lines.push('')
    lines.push('⚠️ *Perlu revisi / ditolak (' + perluRevisi.length + '):*')
    perluRevisi.forEach(function(b) {
      lines.push('  • ' + cleanBranchName(b.name) + ' _[' + b.district + ']_')
    })
  }

  lines.push('')
  lines.push('_Cek detail di operationerp.pages.dev_')

  return { text: lines.join('\n') }
}

function buildAllDoneMessage(today, totalBranch) {
  return {
    text: '✅ *Semua toko sudah setoran* — ' + formatTanggal(today) + '\n' +
          totalBranch + ' toko ✔️  Tidak ada yang tertinggal.'
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

// ── Helpers: tanggal / waktu WIB ─────────────────────────────

function getTodayWIB() {
  var now = new Date()
  // WIB = UTC+7
  var wib = new Date(now.getTime() + 7 * 60 * 60 * 1000)
  var y   = wib.getUTCFullYear()
  var m   = String(wib.getUTCMonth() + 1).padStart(2, '0')
  var d   = String(wib.getUTCDate()).padStart(2, '0')
  return y + '-' + m + '-' + d
}

function getJamWIBNow() {
  var now = new Date()
  var wib = new Date(now.getTime() + 7 * 60 * 60 * 1000)
  var h   = String(wib.getUTCHours()).padStart(2, '0')
  var m   = String(wib.getUTCMinutes()).padStart(2, '0')
  return h + ':' + m
}

function formatTanggal(isoDate) {
  // '2026-04-29' → '29 Apr 2026'
  var parts  = isoDate.split('-')
  var months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']
  return parseInt(parts[2]) + ' ' + months[parseInt(parts[1]) - 1] + ' ' + parts[0]
}

function cleanBranchName(name) {
  // Hapus prefix 'Bagi Kopi ' agar lebih ringkas di chat
  return name.replace(/^Bagi Kopi\s+/i, '')
}

// ── Setup trigger (jalankan SEKALI secara manual) ─────────────

/**
 * Panggil fungsi ini SATU KALI dari menu Run > setupTrigger
 * untuk mendaftarkan trigger otomatis jam 21:00–22:00 WIB (14:00 UTC).
 * Setelah terdaftar, hapus trigger lama jika ada duplikat.
 */
function setupTrigger() {
  // Hapus trigger lama yang mungkin sudah ada
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'notifikasiBeluSetoran') {
      ScriptApp.deleteTrigger(t)
    }
  })

  // Daftarkan trigger baru: tiap hari jam 14:00 UTC = 21:00 WIB
  ScriptApp.newTrigger('notifikasiBeluSetoran')
    .timeBased()
    .everyDays(1)
    .atHour(14)          // jam 14 UTC = jam 21 WIB
    .inTimezone('UTC')
    .create()

  Logger.log('Trigger terdaftar: notifikasiBeluSetoran setiap hari 21:00 WIB')
}

// ── Test manual (jalankan dari editor untuk coba) ─────────────

/**
 * Jalankan fungsi ini dari editor untuk test tanpa menunggu trigger.
 * Output akan tampil di Execution Log.
 */
function testManual() {
  notifikasiBeluSetoran()
}
