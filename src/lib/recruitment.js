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

export function stageLabel(stage) {
  return STAGES[stage]?.label ?? stage
}

export function stageStep(stage) {
  return STAGES[stage]?.step ?? 0
}

// Kandidat butuh aksi dari role tertentu?
export function needsActionFrom(candidate, role) {
  const stage = candidate?.current_stage
  if (!stage) return false
  if (role === 'hr_staff')      return HR_STAFF_ACTION_STAGES.includes(stage)
  if (role === 'hr_spv')        return HR_SPV_ACTION_STAGES.includes(stage)
  if (role === 'hr_legal')      return HR_LEGAL_ACTION_STAGES.includes(stage)
  if (role === 'head_store')    return HS_ACTION_STAGES.includes(stage)
  if (role === 'district_manager') return stage === 'batch_oje_issued'
  if (role === 'trainer')       return TRAINER_ACTION_STAGES.includes(stage)
  return false
}
