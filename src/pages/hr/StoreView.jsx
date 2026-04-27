import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import {
  SubpageShell, SectionPanel, ToneBadge, EmptyPanel,
} from '../../components/ui/AppKit'
import { SmartBottomNav } from '../../components/BottomNav'
import { stageLabel, HS_ACTION_STAGES, TRAINER_ACTION_STAGES } from '../../lib/recruitment'
import { fmtDate } from '../../lib/utils'

const FILTER_OPTIONS = [
  { key: 'all',    label: 'Semua' },
  { key: 'action', label: 'Butuh Aksi' },
  { key: 'oje',    label: 'OJE' },
  { key: 'ojt',    label: 'OJT & Lanjutan' },
]

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

export default function HRStoreView() {
  const { profile } = useAuth()
  const [candidates, setCandidates] = useState([])
  const [batches, setBatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  const role = profile?.role
  const actionStages = actionStagesForRole(role)
  const showBatchSection = ['head_store','district_manager'].includes(role)

  useEffect(() => {
    async function load() {
      const queries = [
        supabase
          .from('candidates')
          .select('id, full_name, phone, applied_position, branch_id, current_stage, status, branches(name)')
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

  const filtered = candidates.filter(c => {
    if (filter === 'action') return actionStages.includes(c.current_stage)
    if (filter === 'oje') return ['oje_instore_issued','oje_instore_submitted','review_hrstaff','revision_hs'].includes(c.current_stage)
    if (filter === 'ojt') return ['ojt_instore','assessment','training'].includes(c.current_stage)
    return true
  })

  const butuhAksi = candidates.filter(c => actionStages.includes(c.current_stage))

  // Batch yang masih butuh diisi nilai (kandidat masih di stage batch_oje_issued)
  const batchPendingIds = new Set(
    candidates.filter(c => c.current_stage === 'batch_oje_issued').map(c => c.batch_id).filter(Boolean)
  )

  return (
    <SubpageShell title="Rekrutmen" eyebrow="Toko / Trainer" backTo={homeFor(role)}>
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 px-4 pt-4">
        <div className="bg-blue-50 rounded-xl p-3">
          <div className="text-2xl font-bold text-blue-700">{candidates.length}</div>
          <div className="text-xs text-blue-600 font-medium mt-0.5">Total Aktif</div>
        </div>
        <div className={`rounded-xl p-3 ${butuhAksi.length > 0 ? 'bg-rose-50' : 'bg-green-50'}`}>
          <div className={`text-2xl font-bold ${butuhAksi.length > 0 ? 'text-rose-700' : 'text-green-700'}`}>
            {butuhAksi.length}
          </div>
          <div className={`text-xs font-medium mt-0.5 ${butuhAksi.length > 0 ? 'text-rose-600' : 'text-green-600'}`}>
            Butuh Aksi
          </div>
        </div>
      </div>

      {/* Shortcut batch aktif untuk HS/DM */}
      {showBatchSection && batches.length > 0 && (
        <SectionPanel title="Batch OJE" className="mx-4 mt-4">
          <div className="divide-y divide-slate-100">
            {batches.map(b => {
              const pending = batchPendingIds.has(b.id)
              return (
                <Link
                  key={b.id}
                  to={`/hr/batch/${b.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-slate-50"
                >
                  <div>
                    <div className="text-sm font-semibold text-slate-800">{b.branches?.name ?? '-'}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{fmtDate(b.batch_date)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {pending && (
                      <span className="text-xs bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full">
                        Belum diisi
                      </span>
                    )}
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </div>
                </Link>
              )
            })}
          </div>
        </SectionPanel>
      )}

      {/* Filter */}
      <div className="flex gap-2 px-4 pt-3 overflow-x-auto pb-1">
        {FILTER_OPTIONS.map(o => (
          <button
            key={o.key}
            onClick={() => setFilter(o.key)}
            className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
              filter === o.key
                ? 'bg-primary-600 text-white'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {o.label}
            {o.key === 'action' && butuhAksi.length > 0 && (
              <span className="ml-1 bg-rose-500 text-white text-xs rounded-full px-1.5">
                {butuhAksi.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Kandidat list */}
      <SectionPanel className="mx-4 mt-3 mb-24">
        {loading ? (
          <p className="text-xs text-slate-400 px-4 py-3">Memuat...</p>
        ) : filtered.length === 0 ? (
          <EmptyPanel message="Tidak ada kandidat" />
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map(c => {
              const needsAct = actionStages.includes(c.current_stage)
              return (
                <Link
                  key={c.id}
                  to={`/hr/candidates/${c.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-slate-50"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-800 truncate">{c.full_name}</span>
                      {needsAct && (
                        <span className="shrink-0 w-2 h-2 bg-rose-400 rounded-full" />
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 truncate">
                      {c.branches?.name ?? '-'} · {c.applied_position}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-3 shrink-0">
                    <ToneBadge
                      tone={needsAct ? 'warn' : 'info'}
                      label={stageLabel(c.current_stage)}
                    />
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </SectionPanel>

      <SmartBottomNav />
    </SubpageShell>
  )
}
