import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { SubpageShell, SectionPanel, ToneBadge, EmptyPanel } from '../../components/ui/AppKit'
import { SmartBottomNav } from '../../components/BottomNav'
import { fmtDate } from '../../lib/utils'
import {
  STAGES, STATUS_CONFIG, stageLabel, needsActionFrom,
  HR_STAFF_ACTION_STAGES, HR_SPV_ACTION_STAGES, HR_LEGAL_ACTION_STAGES,
} from '../../lib/recruitment'

const STAGE_GROUPS = [
  { label: 'Batch OJE',     stages: ['batch_oje_issued','batch_oje_uploaded','batch_oje_reviewed'] },
  { label: 'OJE in Store',  stages: ['oje_instore_issued','oje_instore_submitted'] },
  { label: 'Review & Approval', stages: ['review_hrstaff','revision_hs','pending_hrspv','revision_hrstaff'] },
  { label: 'Kontrak',       stages: ['kontrak_pending'] },
  { label: 'OJT & Lanjutan', stages: ['ojt_instore','assessment','training'] },
]

function actionStagesForRole(role) {
  if (role === 'hr_staff')  return HR_STAFF_ACTION_STAGES
  if (role === 'hr_spv')    return HR_SPV_ACTION_STAGES
  if (role === 'hr_legal')  return HR_LEGAL_ACTION_STAGES
  if (role === 'hr_administrator') return [...HR_STAFF_ACTION_STAGES, ...HR_SPV_ACTION_STAGES, ...HR_LEGAL_ACTION_STAGES]
  if (role === 'ops_manager') return Object.keys(STAGES)
  return []
}

export default function HRHub() {
  const { profile } = useAuth()
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('candidates')
        .select('id, full_name, phone, applied_position, branch_id, current_stage, status, created_at, branches(name)')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
      setCandidates(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const actionStages = actionStagesForRole(profile?.role)
  const butuhAksi = candidates.filter(c => actionStages.includes(c.current_stage))

  // Hitung per stage (hanya yang active)
  const countByStage = candidates.reduce((acc, c) => {
    acc[c.current_stage] = (acc[c.current_stage] || 0) + 1
    return acc
  }, {})

  const isHRRole = ['hr_staff','hr_spv','hr_legal','hr_administrator','ops_manager'].includes(profile?.role)

  return (
    <SubpageShell title="Recruitment" eyebrow="HR Module">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 px-4 pt-4">
        <SummaryCard label="Total Aktif"  value={candidates.length} color="blue" />
        <SummaryCard label="Butuh Aksi"   value={butuhAksi.length}  color={butuhAksi.length > 0 ? 'rose' : 'green'} />
        <SummaryCard label="Selesai Bln Ini" value={candidates.filter(c => c.current_stage === 'on_duty').length} color="green" />
      </div>

      {/* Quick actions */}
      {isHRRole && (
        <div className="flex gap-2 px-4 pt-3">
          {['hr_staff','hr_administrator'].includes(profile?.role) && (
            <Link
              to="/hr/batch"
              className="flex-1 bg-primary-600 text-white text-xs font-semibold rounded-xl py-2.5 text-center"
            >
              + Batch OJE Baru
            </Link>
          )}
          {['hr_legal','hr_administrator'].includes(profile?.role) && (
            <Link
              to="/hr/kontrak"
              className="flex-1 bg-amber-500 text-white text-xs font-semibold rounded-xl py-2.5 text-center"
            >
              Kontrak Pending
            </Link>
          )}
          <Link
            to="/hr/store"
            className="flex-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl py-2.5 text-center"
          >
            Lihat per Toko
          </Link>
        </div>
      )}

      {/* Butuh Aksi section */}
      {butuhAksi.length > 0 && (
        <SectionPanel title="Butuh Aksi Anda" className="mx-4 mt-4">
          <div className="divide-y divide-slate-100">
            {butuhAksi.slice(0, 10).map(c => (
              <CandidateRow key={c.id} candidate={c} />
            ))}
          </div>
          {butuhAksi.length > 10 && (
            <p className="text-xs text-slate-400 text-center py-2">
              +{butuhAksi.length - 10} kandidat lainnya
            </p>
          )}
        </SectionPanel>
      )}

      {/* Pipeline overview per group */}
      {isHRRole && (
        <SectionPanel title="Pipeline per Tahap" className="mx-4 mt-4">
          {loading ? (
            <p className="text-xs text-slate-400 px-4 py-3">Memuat data...</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {STAGE_GROUPS.map(group => {
                const total = group.stages.reduce((s, st) => s + (countByStage[st] || 0), 0)
                if (total === 0) return null
                return (
                  <div key={group.label} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-slate-600">{group.label}</span>
                      <span className="text-xs font-bold text-primary-600">{total} kandidat</span>
                    </div>
                    <div className="space-y-1">
                      {group.stages.map(st => {
                        const n = countByStage[st] || 0
                        if (n === 0) return null
                        return (
                          <div key={st} className="flex items-center justify-between">
                            <span className="text-xs text-slate-500">{stageLabel(st)}</span>
                            <span className="text-xs font-semibold text-slate-700">{n}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
              {candidates.length === 0 && (
                <EmptyPanel message="Belum ada kandidat aktif" />
              )}
            </div>
          )}
        </SectionPanel>
      )}

      {/* Semua kandidat list */}
      <SectionPanel title="Semua Kandidat Aktif" className="mx-4 mt-4 mb-24">
        {loading ? (
          <p className="text-xs text-slate-400 px-4 py-3">Memuat...</p>
        ) : candidates.length === 0 ? (
          <EmptyPanel message="Belum ada kandidat aktif" />
        ) : (
          <div className="divide-y divide-slate-100">
            {candidates.map(c => (
              <CandidateRow key={c.id} candidate={c} />
            ))}
          </div>
        )}
      </SectionPanel>

      <SmartBottomNav />
    </SubpageShell>
  )
}

function SummaryCard({ label, value, color }) {
  const colors = {
    blue:  'bg-blue-50 text-blue-700',
    green: 'bg-green-50 text-green-700',
    rose:  'bg-rose-50 text-rose-700',
  }
  return (
    <div className={`rounded-xl p-3 ${colors[color] || colors.blue}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs font-medium mt-0.5 opacity-80">{label}</div>
    </div>
  )
}

function CandidateRow({ candidate: c }) {
  const stageCfg = STAGES[c.current_stage]
  const toneMap = { 1:'info', 2:'info', 3:'info', 4:'warn', 5:'warn', 6:'warn', 7:'warn', 8:'warn', 9:'warn', 10:'warn', 11:'ok', 12:'ok', 13:'ok', 14:'ok' }
  const tone = toneMap[stageCfg?.step] ?? 'info'

  return (
    <Link to={`/hr/candidates/${c.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-slate-800 truncate">{c.full_name}</div>
        <div className="text-xs text-slate-500 mt-0.5">
          {c.branches?.name ?? '-'} · {c.applied_position}
        </div>
      </div>
      <div className="ml-3 shrink-0">
        <ToneBadge tone={tone} label={stageLabel(c.current_stage)} />
      </div>
    </Link>
  )
}
