import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { AppIcon } from '../../components/ui/AppKit'
import { HRBottomNav } from '../../components/BottomNav'
import { fmtDate } from '../../lib/utils'
import {
  STAGES, STATUS_CONFIG, stageLabel, needsActionFrom,
  HR_STAFF_ACTION_STAGES, HR_SPV_ACTION_STAGES, HR_LEGAL_ACTION_STAGES,
} from '../../lib/recruitment'

const STAGE_GROUPS = [
  { key: 'batch',    label: 'Batch OJE',        color: 'blue',   stages: ['batch_oje_issued','batch_oje_uploaded','batch_oje_reviewed'] },
  { key: 'instore',  label: 'OJE in Store',      color: 'violet', stages: ['oje_instore_issued','oje_instore_submitted'] },
  { key: 'review',   label: 'Review & Approval', color: 'amber',  stages: ['review_hrstaff','revision_hs','pending_hrspv','revision_hrstaff'] },
  { key: 'kontrak',  label: 'Kontrak',           color: 'rose',   stages: ['kontrak_pending'] },
  { key: 'ojt',      label: 'OJT & Lanjutan',    color: 'emerald',stages: ['ojt_instore','assessment','training'] },
]

const GROUP_COLORS = {
  blue:    { bg: 'bg-blue-50',   text: 'text-blue-700',   badge: 'bg-blue-100 text-blue-700',   dot: 'bg-blue-400' },
  violet:  { bg: 'bg-violet-50', text: 'text-violet-700', badge: 'bg-violet-100 text-violet-700',dot: 'bg-violet-400' },
  amber:   { bg: 'bg-amber-50',  text: 'text-amber-700',  badge: 'bg-amber-100 text-amber-700',  dot: 'bg-amber-400' },
  rose:    { bg: 'bg-rose-50',   text: 'text-rose-700',   badge: 'bg-rose-100 text-rose-700',    dot: 'bg-rose-400' },
  emerald: { bg: 'bg-emerald-50',text: 'text-emerald-700',badge: 'bg-emerald-100 text-emerald-700',dot:'bg-emerald-400'},
}

function actionStagesForRole(role) {
  if (role === 'hr_staff')        return HR_STAFF_ACTION_STAGES
  if (role === 'hr_spv')          return HR_SPV_ACTION_STAGES
  if (role === 'hr_legal')        return HR_LEGAL_ACTION_STAGES
  if (role === 'hr_administrator') return [...HR_STAFF_ACTION_STAGES, ...HR_SPV_ACTION_STAGES, ...HR_LEGAL_ACTION_STAGES]
  if (role === 'ops_manager')     return Object.keys(STAGES)
  return []
}

const STEP_TONE = { 1:'info',2:'info',3:'info',4:'warn',5:'warn',6:'warn',7:'warn',8:'warn',9:'warn',10:'warn',11:'ok',12:'ok',13:'ok',14:'ok' }
const TONE_COLORS = {
  ok:   'bg-emerald-100 text-emerald-700',
  warn: 'bg-amber-100 text-amber-700',
  info: 'bg-blue-100 text-blue-700',
}

export default function HRHub() {
  const { profile, signOut } = useAuth()
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

  const role = profile?.role
  const shortName = profile?.full_name?.split(' ')[0] ?? 'HR'
  const actionStages = actionStagesForRole(role)
  const butuhAksi = candidates.filter(c => actionStages.includes(c.current_stage))
  const selesaiBulanIni = candidates.filter(c => c.current_stage === 'on_duty').length

  const countByStage = candidates.reduce((acc, c) => {
    acc[c.current_stage] = (acc[c.current_stage] || 0) + 1
    return acc
  }, {})

  const isHRRole = ['hr_staff','hr_spv','hr_legal','hr_administrator','ops_manager'].includes(role)

  // Quick actions per role
  const quickActions = []
  if (['hr_staff','hr_administrator'].includes(role)) {
    quickActions.push({ to: '/hr/batch', icon: 'checklist', label: 'Batch\nOJE', bg: 'bg-blue-50 border-blue-100 text-blue-600' })
  }
  quickActions.push({ to: '/hr/store', icon: 'store', label: 'Per\nToko', bg: 'bg-violet-50 border-violet-100 text-violet-600' })
  if (['hr_legal','hr_administrator'].includes(role)) {
    quickActions.push({ to: '/hr/kontrak', icon: 'approval', label: 'Kontrak\nPending', bg: 'bg-rose-50 border-rose-100 text-rose-600' })
  }
  quickActions.push({ to: '/sop', icon: 'book', label: 'Panduan\nSOP', bg: 'bg-indigo-50 border-indigo-100 text-indigo-600' })
  quickActions.push({ to: '/kpi', icon: 'chart', label: 'Lihat\nKPI', bg: 'bg-emerald-50 border-emerald-100 text-emerald-600' })

  const activePipelineGroups = STAGE_GROUPS.filter(g =>
    g.stages.some(s => (countByStage[s] || 0) > 0)
  )

  return (
    <div className="min-h-screen bg-[#fdfeff] pb-28">
      {/* Header */}
      <div className="sticky top-0 z-50 flex items-center justify-between border-b border-purple-50 bg-white/85 px-5 py-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-600 text-white shadow-lg shadow-purple-200">
            <AppIcon name="users" size={20} />
          </div>
          <div>
            <h1 className="text-[10px] font-black uppercase tracking-[0.18em] text-purple-600">Human Resources</h1>
            <p className="text-lg font-extrabold text-gray-900">Recruitment</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {butuhAksi.length > 0 && (
            <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-rose-50 text-rose-600">
              <AppIcon name="bell" size={18} />
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-black text-white">
                {butuhAksi.length > 9 ? '9+' : butuhAksi.length}
              </span>
            </div>
          )}
          <button
            onClick={signOut}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-50 text-purple-600 transition-colors hover:bg-purple-100"
          >
            <AppIcon name="logout" size={18} />
          </button>
        </div>
      </div>

      <div className="px-5 pt-5">
        {/* Stats cards */}
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
          <div className="rounded-[1.75rem] border border-emerald-100 bg-emerald-50 p-4 shadow-sm">
            <p className="mb-1 text-[9px] font-bold uppercase text-emerald-600">On Duty</p>
            <p className="text-2xl font-black text-emerald-700">{loading ? '…' : selesaiBulanIni}</p>
            <p className="mt-1 text-[9px] text-emerald-500">aktif bekerja</p>
          </div>
        </div>

        {/* Quick actions */}
        <div className="mb-5">
          <h2 className="mb-3 text-sm font-extrabold text-gray-800">Akses Cepat</h2>
          <div className="grid grid-cols-4 gap-3">
            {quickActions.map(a => (
              <Link key={a.to} to={a.to} className="flex flex-col items-center gap-2">
                <div className={`flex h-14 w-14 items-center justify-center rounded-2xl border shadow-sm transition-transform active:scale-95 ${a.bg}`}>
                  <AppIcon name={a.icon} size={22} />
                </div>
                <span className="text-center text-[9px] font-bold leading-tight text-gray-700">
                  {a.label.split('\n').map((l, i) => <span key={i}>{l}{i === 0 ? <br /> : ''}</span>)}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Butuh aksi section */}
        {butuhAksi.length > 0 && (
          <div className="mb-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-gray-800">Butuh Aksi Anda</h2>
              <span className="rounded-full bg-rose-100 px-2.5 py-1 text-[10px] font-black text-rose-600">
                {butuhAksi.length} kandidat
              </span>
            </div>
            <div className="overflow-hidden rounded-[1.5rem] border border-rose-100 bg-white shadow-sm">
              {butuhAksi.slice(0, 8).map((c, i) => (
                <Link
                  key={c.id}
                  to={`/hr/candidates/${c.id}`}
                  className={`flex items-center justify-between px-4 py-3.5 transition-colors hover:bg-slate-50 ${i > 0 ? 'border-t border-slate-100' : ''}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
                      <AppIcon name="users" size={15} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">{c.full_name}</p>
                      <p className="truncate text-[10px] text-slate-400">{c.branches?.name ?? '-'} · {c.applied_position}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-2 shrink-0">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${TONE_COLORS[STEP_TONE[STAGES[c.current_stage]?.step]] ?? 'bg-slate-100 text-slate-600'}`}>
                      {stageLabel(c.current_stage)}
                    </span>
                    <AppIcon name="chevronRight" size={14} className="text-slate-300" />
                  </div>
                </Link>
              ))}
              {butuhAksi.length > 8 && (
                <div className="border-t border-slate-100 px-4 py-3 text-center text-xs font-semibold text-slate-400">
                  +{butuhAksi.length - 8} kandidat lainnya
                </div>
              )}
            </div>
          </div>
        )}

        {/* Pipeline per stage group */}
        {isHRRole && activePipelineGroups.length > 0 && (
          <div className="mb-5">
            <h2 className="mb-3 text-sm font-extrabold text-gray-800">Pipeline Kandidat</h2>
            <div className="grid grid-cols-2 gap-3">
              {activePipelineGroups.map(group => {
                const c = GROUP_COLORS[group.color]
                const total = group.stages.reduce((s, st) => s + (countByStage[st] || 0), 0)
                return (
                  <div key={group.key} className={`rounded-[1.5rem] border p-4 shadow-sm ${c.bg} border-transparent`}>
                    <div className="mb-2 flex items-center justify-between">
                      <p className={`text-[10px] font-black uppercase tracking-wide ${c.text}`}>{group.label}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${c.badge}`}>{total}</span>
                    </div>
                    <div className="space-y-1">
                      {group.stages.filter(s => (countByStage[s] || 0) > 0).map(s => (
                        <div key={s} className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <div className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
                            <span className="text-[10px] text-slate-600">{stageLabel(s)}</span>
                          </div>
                          <span className="text-[10px] font-bold text-slate-700">{countByStage[s]}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Semua kandidat */}
        <div className="mb-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-gray-800">Semua Kandidat Aktif</h2>
            <span className="text-[10px] font-semibold text-slate-400">{candidates.length} total</span>
          </div>
          {loading ? (
            <div className="rounded-[1.5rem] border border-slate-100 bg-white p-8 text-center text-xs text-slate-400">
              Memuat data…
            </div>
          ) : candidates.length === 0 ? (
            <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
              <AppIcon name="users" size={28} className="mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-semibold text-slate-500">Belum ada kandidat aktif</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-[1.5rem] border border-slate-100 bg-white shadow-sm">
              {candidates.map((c, i) => {
                const needsAct = actionStages.includes(c.current_stage)
                const tone = STEP_TONE[STAGES[c.current_stage]?.step] ?? 'info'
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
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${TONE_COLORS[tone] ?? 'bg-slate-100 text-slate-600'}`}>
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

        {/* Banner */}
        <div className="mt-5 overflow-hidden rounded-[2rem] bg-gradient-to-br from-purple-700 to-violet-500 p-5 text-white shadow-lg relative">
          <div className="relative z-10">
            <span className="mb-2 inline-block rounded-full bg-white/20 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider">
              Info
            </span>
            <h3 className="mb-1 text-sm font-bold">Pipeline Rekrutmen Aktif</h3>
            <p className="text-[10px] opacity-90 leading-relaxed">
              Pantau pipeline dari Batch OJE hingga On Duty. Kandidat yang membutuhkan aksi ditandai merah.
            </p>
          </div>
          <AppIcon name="users" size={80} className="absolute -right-4 -bottom-4 opacity-10" />
        </div>
      </div>

      <HRBottomNav />
    </div>
  )
}
