import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { SmartBottomNav } from '../../components/BottomNav'
import { AppIcon, EmptyPanel, ToneBadge } from '../../components/ui/AppKit'
import {
  GROUP_COLORS,
  POSITION_LABELS,
  STAGE_GROUPS,
  getActionStagesForRole,
  needsActionFrom,
  stageColor,
  stageLabel,
} from '../../lib/recruitment'
import { fmtDate } from '../../lib/utils'

const HR_ROLES = ['hr_staff', 'hr_spv', 'hr_legal', 'hr_administrator', 'support_spv']

function homeFor(role) {
  if (HR_ROLES.includes(role) || role === 'ops_manager') return '/hr'
  if (role === 'trainer') return '/trainer'
  return '/staff'
}

function roleTitle(role) {
  return {
    head_store: 'Head Store',
    asst_head_store: 'Asst. Head Store',
    district_manager: 'District Manager',
    trainer: 'Trainer',
    ops_manager: 'Ops Manager',
    support_spv: 'Support SPV',
    area_manager: 'Area Manager',
  }[role] || role
}

function roleBadgeColor(role) {
  if (['hr_staff', 'hr_spv', 'hr_legal', 'hr_administrator'].includes(role)) return { bg: 'bg-purple-50', text: 'text-purple-600', icon: 'bg-purple-600', border: 'border-purple-100', accent: 'from-purple-600 to-purple-800', card: 'bg-purple-50 border-purple-100', cardTitle: 'text-purple-900', cardSub: 'text-purple-600' }
  if (['district_manager', 'area_manager'].includes(role)) return { bg: 'bg-blue-50', text: 'text-blue-600', icon: 'bg-blue-600', border: 'border-blue-100', accent: 'from-blue-600 to-blue-800', card: 'bg-blue-50 border-blue-100', cardTitle: 'text-blue-900', cardSub: 'text-blue-600' }
  if (role === 'trainer') return { bg: 'bg-indigo-50', text: 'text-indigo-600', icon: 'bg-indigo-600', border: 'border-indigo-100', accent: 'from-indigo-600 to-indigo-800', card: 'bg-indigo-50 border-indigo-100', cardTitle: 'text-indigo-900', cardSub: 'text-indigo-600' }
  if (role === 'support_spv') return { bg: 'bg-violet-50', text: 'text-violet-600', icon: 'bg-violet-600', border: 'border-violet-100', accent: 'from-violet-600 to-violet-800', card: 'bg-violet-50 border-violet-100', cardTitle: 'text-violet-900', cardSub: 'text-violet-600' }
  return { bg: 'bg-slate-50', text: 'text-slate-600', icon: 'bg-slate-600', border: 'border-slate-100', accent: 'from-slate-600 to-slate-800', card: 'bg-slate-50 border-slate-100', cardTitle: 'text-slate-900', cardSub: 'text-slate-600' }
}

export default function HRStoreView() {
  const { profile } = useAuth()
  const [candidates, setCandidates] = useState([])
  const [batches, setBatches] = useState([])
  const [loading, setLoading] = useState(true)

  const role = profile?.role
  const shortName = profile?.full_name?.split(' ')[0] ?? 'User'
  const showBatchSection = ['head_store', 'district_manager'].includes(role)
  const theme = roleBadgeColor(role)

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
            .limit(12),
        )
      }

      const [{ data: candidateRows }, batchRes] = await Promise.all(queries)
      setCandidates(candidateRows || [])
      setBatches(batchRes?.data || [])
      setLoading(false)
    }

    load()
  }, [showBatchSection])

  const actionQueue = useMemo(
    () => candidates.filter((c) => needsActionFrom(c, role)),
    [candidates, role],
  )

  const ojeQueue = candidates.filter((c) =>
    ['oje_instore_issued', 'oje_instore_submitted', 'review_hrstaff', 'revision_hs'].includes(c.current_stage),
  )
  const ojtQueue = candidates.filter((c) =>
    ['ojt_instore', 'assessment', 'training'].includes(c.current_stage),
  )

  const visibleGroups = STAGE_GROUPS
    .filter((g) => g.stages.some((s) => candidates.some((c) => c.current_stage === s)))
    .filter((g) => {
      if (role === 'trainer') return g.key === 'lanjutan'
      if (role === 'district_manager') return g.key === 'batch' || g.key === 'instore'
      if (['head_store', 'asst_head_store'].includes(role)) return g.key !== 'kontrak'
      return true
    })

  const batchPendingIds = new Set(
    candidates.filter((c) => c.current_stage === 'batch_oje_issued').map((c) => c.batch_id).filter(Boolean),
  )

  return (
    <div className="min-h-screen bg-[#f8fbff] pb-28">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white px-5 pt-5 pb-4 flex justify-between items-center border-b border-purple-50 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link
            to={homeFor(role)}
            className={`flex h-10 w-10 items-center justify-center rounded-2xl ${theme.bg} ${theme.text} transition-colors hover:opacity-80`}
          >
            <AppIcon name="chevronLeft" size={18} />
          </Link>
          <div>
            <p className={`text-[10px] font-bold uppercase tracking-widest ${theme.text}`}>{roleTitle(role)}</p>
            <p className="text-base font-extrabold text-gray-900 leading-tight">Recruitment Queue</p>
          </div>
        </div>
        <span className={`text-[9px] font-bold ${theme.text} ${theme.bg} px-2.5 py-1 rounded-full uppercase tracking-wide`}>
          {candidates.length} aktif
        </span>
      </div>

      <div className="px-5 pt-5">
        {/* Overview Card */}
        <div className={`${theme.card} border p-5 rounded-[2.5rem] mb-6`}>
          <div className="flex justify-between items-center mb-4">
            <h2 className={`text-xs font-black ${theme.cardTitle} uppercase`}>Recruitment Queue</h2>
            <span className={`text-[10px] font-bold ${theme.cardSub}`}>{roleTitle(role)}</span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white p-3 rounded-2xl text-center shadow-sm">
              <p className="text-[8px] font-bold text-gray-400 uppercase mb-1">Butuh Aksi</p>
              <p className={`text-2xl font-black ${actionQueue.length > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {loading ? '-' : String(actionQueue.length).padStart(2, '0')}
              </p>
              <p className="text-[7px] text-gray-500 leading-tight">Antrean kamu</p>
            </div>
            <div className="bg-white p-3 rounded-2xl text-center shadow-sm">
              <p className="text-[8px] font-bold text-gray-400 uppercase mb-1">OJE Toko</p>
              <p className="text-2xl font-black text-blue-600">
                {loading ? '-' : String(ojeQueue.length).padStart(2, '0')}
              </p>
              <p className="text-[7px] text-gray-500 leading-tight">Proses OJE</p>
            </div>
            <div className="bg-white p-3 rounded-2xl text-center shadow-sm">
              <p className="text-[8px] font-bold text-gray-400 uppercase mb-1">OJT/Training</p>
              <p className="text-2xl font-black text-emerald-600">
                {loading ? '-' : String(ojtQueue.length).padStart(2, '0')}
              </p>
              <p className="text-[7px] text-gray-500 leading-tight">Sedang berjalan</p>
            </div>
          </div>
        </div>

        {/* Hero pair */}
        <div className="flex gap-3 mb-6">
          <div
            className={`flex-1 bg-gradient-to-br ${theme.accent} p-4 rounded-3xl text-white relative overflow-hidden shadow-md`}
          >
            <div className="relative z-10">
              <p className="text-[9px] font-bold opacity-80 uppercase mb-1">Prioritas Aksi</p>
              <p className="text-2xl font-black">{loading ? '-' : actionQueue.length}</p>
              <div className="w-full bg-white/20 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="bg-white h-1.5 rounded-full"
                  style={{ width: !loading && actionQueue.length > 0 ? '100%' : '0%' }}
                />
              </div>
              <p className="text-[8px] opacity-70 mt-1">kandidat perlu aksi</p>
            </div>
            <AppIcon name="users" size={52} className="absolute -right-2 -bottom-2 opacity-10" />
          </div>
          {showBatchSection && (
            <Link
              to="/hr/batch"
              className="flex-1 bg-white border border-purple-100 p-4 rounded-3xl shadow-sm flex flex-col justify-between hover:border-purple-300 transition-colors"
            >
              <p className="text-[9px] font-bold text-gray-400 uppercase">Batch</p>
              <p className="text-base font-black text-gray-900 leading-tight mt-1">OJE</p>
              <div className="flex items-center gap-1 mt-2">
                <AppIcon name="checklist" size={12} className="text-purple-400" />
                <p className="text-[8px] text-purple-400 font-semibold">Masuk penilaian</p>
              </div>
            </Link>
          )}
        </div>

        {/* Batch Queue — only for Head Store & DM */}
        {showBatchSection && batches.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Batch OJE Berjalan</p>
              <ToneBadge tone={batchPendingIds.size > 0 ? 'warn' : 'info'}>{batches.length} batch</ToneBadge>
            </div>
            <div className="space-y-2">
              {batches.slice(0, 5).map((batch) => {
                const pending = batchPendingIds.has(batch.id)
                return (
                  <Link
                    key={batch.id}
                    to={`/hr/batch/${batch.id}`}
                    className="flex items-center gap-3 rounded-[20px] bg-white border border-slate-100 px-4 py-3 shadow-sm hover:border-purple-200 transition-colors"
                  >
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${pending ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>
                      <AppIcon name="checklist" size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-slate-900">{batch.branches?.name || '-'}</div>
                      <div className="truncate text-xs text-slate-500">{fmtDate(batch.batch_date)}</div>
                    </div>
                    <ToneBadge tone={pending ? 'warn' : 'info'}>{pending ? 'Belum diisi' : 'Riwayat'}</ToneBadge>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* Action Queue */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Antrean Prioritas</p>
            <ToneBadge tone={actionQueue.length > 0 ? 'warn' : 'ok'}>{actionQueue.length} kandidat</ToneBadge>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-purple-600 border-t-transparent" />
            </div>
          ) : actionQueue.length === 0 ? (
            <EmptyPanel title="Antrean kosong" description="Tidak ada kandidat yang menunggu aksi dari kamu saat ini." />
          ) : (
            <div className="space-y-2">
              {actionQueue.map((candidate) => {
                const color = GROUP_COLORS[stageColor(candidate.current_stage)] || GROUP_COLORS.slate
                return (
                  <Link
                    key={candidate.id}
                    to={`/hr/candidates/${candidate.id}`}
                    className="flex items-center gap-3 rounded-[20px] bg-white border border-slate-100 px-4 py-3 shadow-sm hover:border-purple-200 transition-colors"
                  >
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${color.soft}`}>
                      <AppIcon name="users" size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-slate-900">{candidate.full_name}</div>
                      <div className="truncate text-xs text-slate-500">
                        {candidate.branches?.name || '-'} · {POSITION_LABELS[candidate.applied_position] || candidate.applied_position}
                      </div>
                    </div>
                    <ToneBadge tone="info">{stageLabel(candidate.current_stage)}</ToneBadge>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Pipeline per tahap */}
        <div className="mb-5">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-3">Pipeline Per Tahap</p>
          {visibleGroups.length === 0 ? (
            <EmptyPanel title="Belum ada pipeline" description="Kandidat aktif akan muncul setelah batch dibuat." />
          ) : (
            <div className="space-y-3">
              {visibleGroups.map((group) => {
                const rows = candidates.filter((c) => group.stages.includes(c.current_stage))
                const color = GROUP_COLORS[group.color] || GROUP_COLORS.slate
                return (
                  <div key={group.key} className={`rounded-[1.75rem] border p-4 ${color.panel}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wide">{group.label}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{group.description}</p>
                      </div>
                      <ToneBadge tone="info">{rows.length} kandidat</ToneBadge>
                    </div>
                    <div className="space-y-1.5">
                      {rows.slice(0, 4).map((candidate) => (
                        <Link
                          key={candidate.id}
                          to={`/hr/candidates/${candidate.id}`}
                          className="flex items-center justify-between rounded-[14px] bg-white/85 px-3 py-2.5 text-slate-800 transition-colors hover:bg-white"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold">{candidate.full_name}</div>
                            <div className="truncate text-xs text-slate-500">
                              {candidate.branches?.name || '-'} · {stageLabel(candidate.current_stage)}
                            </div>
                          </div>
                          <AppIcon name="chevronRight" size={16} className="text-slate-400 shrink-0 ml-3" />
                        </Link>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <SmartBottomNav />
    </div>
  )
}
