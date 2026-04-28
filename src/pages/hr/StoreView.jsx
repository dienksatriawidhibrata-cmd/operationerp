import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { AppIcon } from '../../components/ui/AppKit'
import { SmartBottomNav } from '../../components/BottomNav'
import { stageLabel, HS_ACTION_STAGES, TRAINER_ACTION_STAGES } from '../../lib/recruitment'
import { fmtDate } from '../../lib/utils'

const HR_ROLES = ['hr_staff','hr_spv','hr_legal','hr_administrator']

function homeFor(role) {
  if (HR_ROLES.includes(role) || role === 'ops_manager') return '/hr'
  if (role === 'trainer') return '/trainer'
  return '/staff'
}

function actionStagesForRole(role) {
  if (['head_store','asst_head_store'].includes(role)) return HS_ACTION_STAGES
  if (role === 'district_manager') return ['batch_oje_issued']
  if (role === 'trainer') return TRAINER_ACTION_STAGES
  return [...HS_ACTION_STAGES, ...TRAINER_ACTION_STAGES]
}

const OJE_INSTORE_STAGES = ['oje_instore_issued','oje_instore_submitted','review_hrstaff','revision_hs']
const OJT_STAGES = ['ojt_instore','assessment','training']

const FILTER_OPTIONS = [
  { key: 'action', label: 'Butuh Aksi', icon: 'bell' },
  { key: 'oje',    label: 'OJE',        icon: 'checklist' },
  { key: 'ojt',    label: 'OJT',        icon: 'approval' },
  { key: 'all',    label: 'Semua',      icon: 'users' },
]

const STAGE_TONE = {
  batch_oje_issued: 'blue',  batch_oje_uploaded: 'blue', batch_oje_reviewed: 'blue',
  oje_instore_issued: 'violet', oje_instore_submitted: 'violet',
  review_hrstaff: 'amber', revision_hs: 'amber', pending_hrspv: 'amber', revision_hrstaff: 'amber',
  kontrak_pending: 'rose',
  ojt_instore: 'emerald', assessment: 'emerald', training: 'emerald',
  on_duty: 'green',
}
const TONE_PILL = {
  blue:    'bg-blue-100 text-blue-700',
  violet:  'bg-violet-100 text-violet-700',
  amber:   'bg-amber-100 text-amber-700',
  rose:    'bg-rose-100 text-rose-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  green:   'bg-green-100 text-green-700',
}

export default function HRStoreView() {
  const { profile } = useAuth()
  const [candidates, setCandidates] = useState([])
  const [batches, setBatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('action')

  const role = profile?.role
  const actionStages = actionStagesForRole(role)
  const showBatchSection = ['head_store','district_manager'].includes(role)

  useEffect(() => {
    async function load() {
      const queries = [
        supabase
          .from('candidates')
          .select('id, full_name, phone, applied_position, branch_id, batch_id, current_stage, status, branches(name)')
          .eq('status', 'active')
          .order('created_at', { ascending: false }),
      ]
      if (showBatchSection) {
        queries.push(
          supabase
            .from('oje_batches')
            .select('id, batch_date, notes, branches(name)')
            .order('created_at', { ascending: false })
            .limit(10)
        )
      }
      const [{ data: cands }, batchRes] = await Promise.all(queries)
      setCandidates(cands ?? [])
      if (batchRes) setBatches(batchRes.data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const butuhAksi   = candidates.filter(c => actionStages.includes(c.current_stage))
  const ojeInstore  = candidates.filter(c => OJE_INSTORE_STAGES.includes(c.current_stage))
  const ojtCandidates = candidates.filter(c => OJT_STAGES.includes(c.current_stage))

  const filtered = candidates.filter(c => {
    if (filter === 'action') return actionStages.includes(c.current_stage)
    if (filter === 'oje')    return OJE_INSTORE_STAGES.includes(c.current_stage)
    if (filter === 'ojt')    return OJT_STAGES.includes(c.current_stage)
    return true
  })

  const batchPendingIds = new Set(
    candidates.filter(c => c.current_stage === 'batch_oje_issued').map(c => c.batch_id).filter(Boolean)
  )

  const roleLabel = {
    head_store: 'Head Store', district_manager: 'District Manager',
    trainer: 'Trainer', asst_head_store: 'Asst. Head Store',
  }[role] ?? role

  return (
    <div className="min-h-screen bg-[#fdfeff] pb-28">
      {/* Header */}
      <div className="sticky top-0 z-50 flex items-center justify-between border-b border-purple-50 bg-white/85 px-5 py-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link
            to={homeFor(role)}
            className="flex h-9 w-9 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 transition-colors hover:bg-purple-100"
          >
            <AppIcon name="chevronLeft" size={18} />
          </Link>
          <div>
            <h1 className="text-[10px] font-black uppercase tracking-[0.18em] text-purple-600">{roleLabel}</h1>
            <p className="text-lg font-extrabold text-gray-900">Rekrutmen</p>
          </div>
        </div>
      </div>

      <div className="px-5 pt-5">
        {/* Stats */}
        <div className="mb-5 grid grid-cols-3 gap-3">
          <div className="rounded-[1.75rem] bg-purple-600 p-4 text-white shadow-lg shadow-purple-200">
            <p className="mb-1 text-[9px] font-bold uppercase opacity-75">Total Aktif</p>
            <p className="text-2xl font-black">{loading ? '…' : candidates.length}</p>
            <p className="mt-1 text-[9px] opacity-70">kandidat</p>
          </div>
          <div className={`rounded-[1.75rem] border p-4 shadow-sm ${butuhAksi.length > 0 ? 'border-rose-100 bg-rose-50' : 'border-green-100 bg-green-50'}`}>
            <p className={`mb-1 text-[9px] font-bold uppercase ${butuhAksi.length > 0 ? 'text-rose-600' : 'text-green-600'}`}>Butuh Aksi</p>
            <p className={`text-2xl font-black ${butuhAksi.length > 0 ? 'text-rose-700' : 'text-green-700'}`}>
              {loading ? '…' : butuhAksi.length}
            </p>
            <p className={`mt-1 text-[9px] ${butuhAksi.length > 0 ? 'text-rose-500' : 'text-green-500'}`}>dari kamu</p>
          </div>
          <div className="rounded-[1.75rem] border border-violet-100 bg-violet-50 p-4 shadow-sm">
            <p className="mb-1 text-[9px] font-bold uppercase text-violet-600">OJE Toko</p>
            <p className="text-2xl font-black text-violet-700">{loading ? '…' : ojeInstore.length}</p>
            <p className="mt-1 text-[9px] text-violet-500">in Store</p>
          </div>
        </div>

        {/* Batch OJE shortcut (HS/DM) */}
        {showBatchSection && batches.length > 0 && (
          <div className="mb-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-gray-800">Batch OJE</h2>
              <Link to="/hr/batch" className="text-[11px] font-bold text-purple-600">Semua →</Link>
            </div>
            <div className="overflow-hidden rounded-[1.5rem] border border-blue-100 bg-white shadow-sm">
              {batches.slice(0, 5).map((b, i) => {
                const pending = batchPendingIds.has(b.id)
                return (
                  <Link
                    key={b.id}
                    to={`/hr/batch/${b.id}`}
                    className={`flex items-center justify-between px-4 py-3.5 transition-colors hover:bg-slate-50 ${i > 0 ? 'border-t border-slate-100' : ''}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                        <AppIcon name="checklist" size={15} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">{b.branches?.name ?? '-'}</p>
                        <p className="text-[10px] text-slate-400">{fmtDate(b.batch_date)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-2 shrink-0">
                      {pending && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                          Belum diisi
                        </span>
                      )}
                      <AppIcon name="chevronRight" size={14} className="text-slate-300" />
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* Filter tabs */}
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {FILTER_OPTIONS.map(o => {
            const count = o.key === 'action' ? butuhAksi.length
              : o.key === 'oje' ? ojeInstore.length
              : o.key === 'ojt' ? ojtCandidates.length
              : candidates.length
            const active = filter === o.key
            return (
              <button
                key={o.key}
                onClick={() => setFilter(o.key)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition-colors ${
                  active
                    ? 'bg-purple-600 text-white shadow-sm shadow-purple-200'
                    : 'bg-white text-slate-600 border border-slate-200'
                }`}
              >
                <AppIcon name={o.icon} size={13} />
                {o.label}
                {count > 0 && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-black ${active ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Kandidat list */}
        {loading ? (
          <div className="rounded-[1.5rem] border border-slate-100 bg-white p-8 text-center text-xs text-slate-400">
            Memuat data…
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
            <AppIcon name="users" size={28} className="mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-semibold text-slate-500">Tidak ada kandidat</p>
            <p className="mt-1 text-xs text-slate-400">
              {filter === 'action' ? 'Semua aksi sudah selesai' : 'Coba tab lain'}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[1.5rem] border border-slate-100 bg-white shadow-sm">
            {filtered.map((c, i) => {
              const needsAct = actionStages.includes(c.current_stage)
              const tone = STAGE_TONE[c.current_stage] ?? 'blue'
              return (
                <Link
                  key={c.id}
                  to={`/hr/candidates/${c.id}`}
                  className={`flex items-center justify-between px-4 py-3.5 transition-colors hover:bg-slate-50 ${i > 0 ? 'border-t border-slate-100' : ''}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl ${needsAct ? 'bg-rose-50 text-rose-500' : 'bg-slate-100 text-slate-500'}`}>
                      <AppIcon name="users" size={15} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-sm font-semibold text-slate-800">{c.full_name}</p>
                        {needsAct && <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" />}
                      </div>
                      <p className="truncate text-[10px] text-slate-400">{c.branches?.name ?? '-'} · {c.applied_position}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-2 shrink-0">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${TONE_PILL[tone] ?? 'bg-slate-100 text-slate-600'}`}>
                      {stageLabel(c.current_stage)}
                    </span>
                    <AppIcon name="chevronRight" size={14} className="text-slate-300" />
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      <SmartBottomNav />
    </div>
  )
}
