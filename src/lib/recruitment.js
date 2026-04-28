// Konstanta dan helper untuk Recruitment Module

export const STAGES = {
  batch_oje_issued:       { label: 'Batch OJE Diterbitkan',    step: 1, pic: 'HS/DM' },
  batch_oje_uploaded:     { label: 'Batch OJE Terupload',       step: 2, pic: 'hr_staff' },
  batch_oje_reviewed:     { label: 'Seleksi Batch',             step: 3, pic: 'hr_staff' },
  oje_instore_issued:     { label: 'OJE in Store Diterbitkan',  step: 4, pic: 'Head Store' },
  oje_instore_submitted:  { label: 'Form OJE Tersubmit',        step: 5, pic: 'hr_staff' },
  review_hrstaff:         { label: 'Review HR Staff',           step: 6, pic: 'hr_staff' },
  revision_hs:            { label: 'Revisi oleh HS',            step: 7, pic: 'Head Store' },
  pending_hrspv:          { label: 'Pending Approval HR SPV',   step: 8, pic: 'hr_spv' },
  revision_hrstaff:       { label: 'Revisi dari HR SPV',        step: 9, pic: 'hr_staff' },
  kontrak_pending:        { label: 'Menunggu Kontrak',          step: 10, pic: 'hr_legal' },
  ojt_instore:            { label: 'OJT in Store',              step: 11, pic: 'Head Store' },
  assessment:             { label: 'Assessment',                step: 12, pic: 'Trainer' },
  training:               { label: 'Training',                  step: 13, pic: 'Trainer' },
  on_duty:                { label: 'On Duty',                   step: 14, pic: '-' },
}

export const STAGE_ORDER = Object.keys(STAGES)

export const STAGE_GROUPS = [
  {
    key: 'batch',
    label: 'Batch OJE',
    description: 'Penerbitan batch, input nilai massal, dan seleksi kandidat yang lanjut.',
    color: 'blue',
    stages: ['batch_oje_issued', 'batch_oje_uploaded', 'batch_oje_reviewed'],
  },
  {
    key: 'instore',
    label: 'OJE in Store',
    description: 'Observasi kandidat di toko dan pengumpulan form kelulusan dari Head Store.',
    color: 'violet',
    stages: ['oje_instore_issued', 'oje_instore_submitted'],
  },
  {
    key: 'approval',
    label: 'Review & Approval',
    description: 'Review HR Staff, revisi, dan approval HR SPV sebelum kontrak.',
    color: 'amber',
    stages: ['review_hrstaff', 'revision_hs', 'pending_hrspv', 'revision_hrstaff'],
  },
  {
    key: 'kontrak',
    label: 'Kontrak',
    description: 'Finalisasi legal dan aktivasi akun kandidat.',
    color: 'rose',
    stages: ['kontrak_pending'],
  },
  {
    key: 'lanjutan',
    label: 'OJT & Training',
    description: 'Pendampingan awal setelah kontrak sampai kandidat resmi on duty.',
    color: 'emerald',
    stages: ['ojt_instore', 'assessment', 'training', 'on_duty'],
  },
]

export const GROUP_COLORS = {
  blue: {
    panel: 'bg-blue-50 border-blue-100 text-blue-700',
    pill: 'bg-blue-100 text-blue-700',
    soft: 'bg-blue-50 text-blue-700',
    dot: 'bg-blue-400',
  },
  violet: {
    panel: 'bg-violet-50 border-violet-100 text-violet-700',
    pill: 'bg-violet-100 text-violet-700',
    soft: 'bg-violet-50 text-violet-700',
    dot: 'bg-violet-400',
  },
  amber: {
    panel: 'bg-amber-50 border-amber-100 text-amber-700',
    pill: 'bg-amber-100 text-amber-700',
    soft: 'bg-amber-50 text-amber-700',
    dot: 'bg-amber-400',
  },
  rose: {
    panel: 'bg-rose-50 border-rose-100 text-rose-700',
    pill: 'bg-rose-100 text-rose-700',
    soft: 'bg-rose-50 text-rose-700',
    dot: 'bg-rose-400',
  },
  emerald: {
    panel: 'bg-emerald-50 border-emerald-100 text-emerald-700',
    pill: 'bg-emerald-100 text-emerald-700',
    soft: 'bg-emerald-50 text-emerald-700',
    dot: 'bg-emerald-400',
  },
  slate: {
    panel: 'bg-slate-50 border-slate-100 text-slate-700',
    pill: 'bg-slate-100 text-slate-700',
    soft: 'bg-slate-50 text-slate-700',
    dot: 'bg-slate-300',
  },
}

export const STATUS_CONFIG = {
  active:     { label: 'Aktif',      tone: 'info' },
  terminated: { label: 'Terminasi',  tone: 'danger' },
  on_hold:    { label: 'Ditahan',    tone: 'warn' },
  on_duty:    { label: 'On Duty',    tone: 'ok' },
}

export const POSITION_LABELS = {
  barista:       'Barista',
  kitchen:       'Kitchen',
  waitress:      'Waitress',
  staff:         'Staff',
  asst_head_store: 'Asst. Head Store',
}

export const ACTION_LABELS = {
  advance:   'Lanjut',
  reject:    'Ditolak',
  revise:    'Minta Revisi',
  resubmit:  'Resubmit',
  terminate: 'Terminasi',
  hold:      'Ditahan',
  activate:  'Akun Diaktifkan',
}

// Stage yang butuh aksi dari hr_staff
export const HR_STAFF_ACTION_STAGES = [
  'batch_oje_uploaded',    // seleksi siapa lanjut
  'batch_oje_reviewed',    // terbitkan OJE in Store
  'oje_instore_submitted', // review form OJE
  'review_hrstaff',        // approve / flag revisi
  'revision_hrstaff',      // putuskan langkah berikutnya
]

// Stage yang butuh aksi dari hr_spv
export const HR_SPV_ACTION_STAGES = ['pending_hrspv']

// Stage yang butuh aksi dari hr_legal
export const HR_LEGAL_ACTION_STAGES = ['kontrak_pending']

// Stage yang butuh aksi dari Head Store
export const HS_ACTION_STAGES = [
  'batch_oje_issued',
  'oje_instore_issued',
  'revision_hs',
  'ojt_instore',
]

// Stage yang butuh aksi dari Trainer
export const TRAINER_ACTION_STAGES = ['assessment', 'training']

export const ROLE_ACTION_STAGE_MAP = {
  hr_staff: HR_STAFF_ACTION_STAGES,
  hr_spv: HR_SPV_ACTION_STAGES,
  hr_legal: HR_LEGAL_ACTION_STAGES,
  hr_administrator: [...HR_STAFF_ACTION_STAGES, ...HR_SPV_ACTION_STAGES, ...HR_LEGAL_ACTION_STAGES],
  head_store: HS_ACTION_STAGES,
  asst_head_store: HS_ACTION_STAGES,
  district_manager: ['batch_oje_issued'],
  trainer: TRAINER_ACTION_STAGES,
  ops_manager: STAGE_ORDER,
}

export const BATCH_CRITERIA = ['disiplin','sikap','behavior','nyapu_ngepel','layout','toilet','stamina','kerja_sama','fokus','subjektif']

export const BATCH_LABELS = {
  disiplin: 'Disiplin',
  sikap: 'Sikap',
  behavior: 'Behavior',
  nyapu_ngepel: 'Nyapu/Ngepel',
  layout: 'Layout',
  toilet: 'Toilet',
  stamina: 'Stamina',
  kerja_sama: 'Kerja Sama',
  fokus: 'Fokus',
  subjektif: 'Subjektif',
}

export const OJE_INSTORE_SCHEMA = [
  { key: 'hari_1_hadir', label: 'Hari 1', type: 'attendance', required: true },
  { key: 'hari_2_hadir', label: 'Hari 2', type: 'attendance', required: true },
  { key: 'hari_3_hadir', label: 'Hari 3', type: 'attendance', required: true },
  { key: 'hari_4_hadir', label: 'Hari 4', type: 'attendance', required: true },
  { key: 'hari_5_hadir', label: 'Hari 5', type: 'attendance', required: true },
  { key: 'penilaian_sikap', label: 'Penilaian Sikap', type: 'score', min: 1, max: 5, required: true },
  { key: 'penilaian_skill', label: 'Penilaian Skill', type: 'score', min: 1, max: 5, required: true },
  { key: 'penilaian_disiplin', label: 'Penilaian Disiplin', type: 'score', min: 1, max: 5, required: true },
  { key: 'catatan', label: 'Catatan Head Store', type: 'textarea', rows: 3, required: true },
  { key: 'rekomendasi', label: 'Rekomendasi', type: 'recommendation', required: true },
]

export const OJE_INSTORE_FORM_STAGES = ['oje_instore_issued', 'oje_instore_submitted', 'review_hrstaff', 'revision_hs']

export const OJE_INSTORE_FIELD_SUMMARY = [
  { key: 'hari_1_hadir', label: 'Hari 1 - Hadir' },
  { key: 'hari_2_hadir', label: 'Hari 2 - Hadir' },
  { key: 'hari_3_hadir', label: 'Hari 3 - Hadir' },
  { key: 'hari_4_hadir', label: 'Hari 4 - Hadir' },
  { key: 'hari_5_hadir', label: 'Hari 5 - Hadir' },
  { key: 'penilaian_sikap', label: 'Penilaian Sikap (1-5)' },
  { key: 'penilaian_skill', label: 'Penilaian Skill (1-5)' },
  { key: 'penilaian_disiplin', label: 'Penilaian Disiplin (1-5)' },
  { key: 'catatan', label: 'Catatan HS' },
  { key: 'rekomendasi', label: 'Rekomendasi' },
]

export const ALLOWED_TRANSITIONS = {
  head_store: {
    oje_instore_issued: ['resubmit'],
    revision_hs: ['resubmit'],
    ojt_instore: ['advance'],
  },
  district_manager: {
    batch_oje_issued: ['resubmit'],
  },
  hr_staff: {
    oje_instore_submitted: ['advance', 'revise'],
    review_hrstaff: ['advance', 'revise'],
    revision_hrstaff: ['advance', 'revise'],
    batch_oje_reviewed: ['advance'],
  },
  hr_spv: {
    pending_hrspv: ['advance', 'reject'],
  },
  hr_legal: {
    kontrak_pending: ['activate'],
  },
  trainer: {
    assessment: ['advance', 'reject'],
    training: ['advance'],
  },
  hr_administrator: {
    batch_oje_reviewed: ['advance'],
    oje_instore_submitted: ['advance', 'revise'],
    review_hrstaff: ['advance', 'revise'],
    revision_hs: ['resubmit'],
    revision_hrstaff: ['advance', 'revise'],
    pending_hrspv: ['advance', 'reject'],
    kontrak_pending: ['activate'],
    ojt_instore: ['advance'],
    assessment: ['advance', 'reject'],
    training: ['advance'],
  },
}

// OJT Checklist items — 3 kolom: head_store (hs), trainer, staff
export const OJT_ITEMS = [
  { key: 'item_01', label: 'Staff telah diperkenalkan mengenai tempat kerja' },
  { key: 'item_02', label: 'Staff telah mendapatkan pelatihan POS' },
  { key: 'item_03', label: 'Staff telah mendapatkan pengenalan alat produksi' },
  { key: 'item_04', label: 'Staff telah mendapatkan pelatihan SOP penyimpanan' },
  { key: 'item_05', label: 'Staff telah mendapatkan pelatihan kebersihan' },
  { key: 'item_06', label: 'Staff telah mendapatkan pelatihan grooming' },
  { key: 'item_07', label: 'Staff telah mendapatkan pelatihan Daily Checklist' },
  { key: 'item_08', label: 'Staff telah mendapatkan pelatihan alur operasional store' },
  { key: 'item_09', label: 'Staff telah mendapatkan pelatihan greeting dan upselling dasar' },
  { key: 'item_10', label: 'Staff telah mendapatkan pelatihan membersihkan peralatan dan furnitur' },
  { key: 'item_11', label: 'Staff telah mendapatkan pengenalan produk dan tata cara pembuatan' },
  { key: 'item_12', label: 'Staff bisa membuat produk dalam pengawasan yang ketat' },
  { key: 'item_13', label: 'Staff bisa handling POS saat low traffic' },
  { key: 'item_14', label: 'Staff bisa berinteraksi dengan customer saat low traffic' },
]

export const OJT_SIGNERS = [
  { key: 'hs',      label: 'Head Store',  col: 'signed_hs' },
  { key: 'trainer', label: 'PIC Training', col: 'signed_trainer' },
  { key: 'staff',   label: 'Staff',        col: 'signed_staff' },
]

export const ASSESSMENT_QUESTION_BANK = {
  barista: [
    'Sebutkan standar greeting dan urutan melayani customer di area bar.',
    'Jelaskan langkah opening area bar sebelum store buka.',
    'Apa yang harus dicek sebelum menyalakan mesin kopi dan grinder?',
    'Bagaimana cara menjaga kebersihan area bar selama jam operasional?',
    'Jelaskan standar penyimpanan bahan baku dingin dan kering.',
    'Apa tindakan pertama saat ada komplain rasa minuman dari customer?',
    'Bagaimana alur upselling produk pendamping di kasir atau area pickup?',
    'Sebutkan hal yang wajib dicatat saat stok bahan baku mulai menipis.',
    'Bagaimana prosedur mencuci peralatan bar setelah peak hour?',
    'Apa indikator bahwa staff sudah siap bekerja mandiri di area bar?',
  ],
  kitchen: [
    'Jelaskan alur persiapan area kitchen sebelum store buka.',
    'Apa standar kebersihan tangan dan alat sebelum produksi dimulai?',
    'Sebutkan cara penyimpanan bahan baku kitchen yang benar.',
    'Bagaimana memastikan urutan produksi sesuai tiket pesanan?',
    'Apa yang dilakukan jika ada produk yang tidak sesuai standar plating?',
    'Jelaskan prosedur pembersihan alat produksi setelah digunakan.',
    'Bagaimana mengatur prioritas kerja saat order kitchen sedang ramai?',
    'Apa saja titik rawan kontaminasi silang di kitchen?',
    'Bagaimana alur komunikasi dengan frontliner saat ada stok habis?',
    'Apa indikator bahwa staff sudah siap bekerja mandiri di kitchen?',
  ],
  waitress: [
    'Jelaskan standar greeting sejak customer datang sampai duduk.',
    'Bagaimana cara memastikan area dine in selalu siap dipakai?',
    'Apa yang harus dilakukan saat customer komplain tentang meja kotor?',
    'Bagaimana alur mengantarkan pesanan sesuai nomor meja?',
    'Sebutkan standar menawarkan menu tambahan ke customer.',
    'Bagaimana cara menutup interaksi dengan customer setelah transaksi selesai?',
    'Apa langkah yang dilakukan saat area service sedang high traffic?',
    'Jelaskan prosedur membersihkan meja dan kursi setelah dipakai.',
    'Bagaimana koordinasi dengan bar atau kitchen saat ada komplain pesanan?',
    'Apa indikator bahwa staff sudah siap bekerja mandiri di area service?',
  ],
  staff: [
    'Jelaskan tanggung jawab dasar staff selama opening shift.',
    'Apa prioritas kerja saat store mulai ramai?',
    'Bagaimana standar komunikasi antar tim di operasional harian?',
    'Apa yang harus dilakukan saat menemukan area store tidak sesuai SOP?',
    'Bagaimana cara memastikan checklist harian terisi dengan benar?',
    'Apa respon pertama ketika customer meminta bantuan langsung?',
    'Jelaskan cara menjaga kebersihan area kerja sepanjang shift.',
    'Bagaimana melaporkan kendala operasional ke Head Store?',
    'Apa yang harus disiapkan sebelum pergantian shift?',
    'Apa indikator bahwa staff sudah siap bekerja mandiri di store?',
  ],
  asst_head_store: [
    'Bagaimana membagi prioritas kerja tim saat opening store?',
    'Apa yang perlu dicek sebelum operasional harian dimulai?',
    'Bagaimana memastikan checklist dan preparation tim lengkap?',
    'Apa tindakan saat ada anggota tim yang tidak mengikuti SOP?',
    'Bagaimana cara memberi briefing singkat yang efektif ke tim?',
    'Apa langkah pertama saat ada kendala stok atau alat di store?',
    'Bagaimana memantau kualitas service selama peak hour?',
    'Apa yang harus dipastikan sebelum closing atau handover shift?',
    'Bagaimana melaporkan kondisi store ke Head Store atau DM?',
    'Apa indikator bahwa kandidat siap membantu memimpin operasional?',
  ],
}

export function stageLabel(stage) {
  return STAGES[stage]?.label ?? stage
}

export function stageStep(stage) {
  return STAGES[stage]?.step ?? 0
}

export function stagePic(stage) {
  return STAGES[stage]?.pic ?? '-'
}

export function stageGroupFor(stage) {
  return STAGE_GROUPS.find((group) => group.stages.includes(stage)) ?? null
}

export function stageColor(stage) {
  return stageGroupFor(stage)?.color ?? 'slate'
}

export function getActionStagesForRole(role) {
  return ROLE_ACTION_STAGE_MAP[role] ?? []
}

export function allowedActionsFor(role, stage) {
  return ALLOWED_TRANSITIONS[role]?.[stage] ?? []
}

export function nextStage(currentStage, action) {
  const map = {
    batch_oje_reviewed: { advance: 'oje_instore_issued' },
    oje_instore_issued: { resubmit: 'oje_instore_submitted' },
    oje_instore_submitted: { advance: 'review_hrstaff', revise: 'revision_hs' },
    review_hrstaff: { advance: 'pending_hrspv', revise: 'revision_hs' },
    revision_hs: { resubmit: 'review_hrstaff' },
    pending_hrspv: { advance: 'kontrak_pending', reject: 'revision_hrstaff' },
    revision_hrstaff: { advance: 'pending_hrspv', revise: 'revision_hs' },
    kontrak_pending: { activate: 'ojt_instore' },
    ojt_instore: { advance: 'assessment' },
    assessment: { advance: 'training', reject: 'on_hold' },
    training: { advance: 'on_duty' },
  }
  return map[currentStage]?.[action] ?? currentStage
}

export function batchTotal(item) {
  if (item?.hadir === false) return 0
  return BATCH_CRITERIA.reduce((sum, key) => sum + (Number(item?.[key]) || 0), 0)
}

export function batchResult(item) {
  if (item?.hadir === false) return { label: 'Tidak Hadir', tone: 'danger' }
  const total = batchTotal(item)
  if (total >= 24) return { label: 'Lulus', tone: 'ok' }
  if (total >= 18) return { label: 'Dipertimbangkan', tone: 'warn' }
  return { label: 'Gagal', tone: 'danger' }
}

export function formatInstoreValue(field, value) {
  if (value === undefined || value === null || value === '') return '-'
  if (field.type === 'attendance') return String(value) === 'hadir' ? 'Hadir' : 'Tidak Hadir'
  if (field.type === 'score') return `${value}/5`
  if (field.type === 'recommendation') return value === 'lulus' ? 'Lulus' : 'Tidak Lulus'
  return value
}

// Kandidat butuh aksi dari role tertentu?
export function needsActionFrom(candidate, role) {
  const stage = candidate?.current_stage
  if (!stage) return false
  return getActionStagesForRole(role).includes(stage)
}
