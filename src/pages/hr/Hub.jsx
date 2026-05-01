import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { HRBottomNav } from '../../components/BottomNav'
import { AppIcon, EmptyPanel, ToneBadge } from '../../components/ui/AppKit'
import { SUPPORT_PEOPLE_ROLES } from '../../lib/access'
import {
  ACTION_LABELS,
  GROUP_COLORS,
  POSITION_LABELS,
  STAGE_GROUPS,
  STATUS_CONFIG,
  getActionStagesForRole,
  needsActionFrom,
  stageColor,
  stageGroupFor,
  stageLabel,
  stagePic,
  stageStep,
} from '../../lib/recruitment'

export default function HRHub() {
  const { profile, signOut } = useAuth()
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('candidates')
        .select('id, full_name, phone, applied_position, current_stage, status, created_at, branch_id, branches(name)')
        .order('created_at', { ascending: false })

      setCandidates(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const role = profile?.role
  const shortName = profile?.full_name?.split(' ')[0] ?? 'HR'
  const activeCandidates = candidates.filter((c) => c.status === 'active')
  const actionStages = getActionStagesForRole(role)

  const queuedForMe = useMemo(
    () => activeCandidates.filter((c) => needsActionFrom(c, role)),
    [activeCandidates, role],
  )

  const groupSummary = useMemo(() => {
    return STAGE_GROUPS.map((group) => {
      const rows = activeCandidates.filter((c) => group.stages.includes(c.current_stage))
      const actionable = rows.filter((c) => needsActionFrom(c, role))
      return { ...group, rows, total: rows.length, actionable }
    }).filter((g) => g.total > 0)
  }, [activeCandidates, role])

  const pendingContracts = activeCandidates.filter((c) => c.current_stage === 'kontrak_pending').length
  const onDutyCount = candidates.filter((c) => c.current_stage === 'on_duty').length

  const showBatch = ['hr_staff', 'hr_spv', 'hr_administrator', 'ops_manager', ...SUPPORT_PEOPLE_ROLES].includes(role)
  const showKontrak = ['hr_legal', 'hr_spv', 'hr_administrator', 'ops_manager'].includes(role)

  const quickActions = [
    ...(showBatch ? [{ to: '/hr/batch', icon: 'checklist', label: 'Batch\nOJE' }] : []),
    { to: '/hr/store', icon: 'store', label: 'Queue\nToko' },
    ...(showKontrak ? [{ to: '/hr/kontrak', icon: 'approval', label: 'Kontrak\nPending' }] : []),
  ]

  return (
    <div className="min-h-screen bg-[#faf8ff] pb-28">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white px-5 pt-5 pb-4 flex justify-between items-center border-b border-purple-50 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-purple-600 flex items-center justify-center text-white shadow-md">
            <AppIcon name="users" size={18} />
          </div>
          <div>
            <p className="text-[10px] text-purple-600 font-bold uppercase tracking-widest">Human Resources</p>
            <p className="font-extrabold text-gray-900 text-base leading-tight">{shortName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold text-purple-600 bg-purple-50 px-2.5 py-1 rounded-full uppercase tracking-wide">
            Recruitment Flow
          </span>
          <button
            type="button"
            onClick={signOut}
            className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 hover:bg-purple-100 transition-colors"
          >
            <AppIcon name="logout" size={18} />
          </button>
        </div>
      </div>

      <div className="px-5 pt-5">
        {/* Stats Overview */}
        <div className="bg-purple-50 p-5 rounded-[2.5rem] border border-purple-100 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xs font-black text-purple-900 uppercase">Recruitment Overview</h2>
            <span className="text-[10px] font-bold text-purple-600">{activeCandidates.length} aktif</span>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-white p-3 rounded-2xl text-center shadow-sm">
              <p className="text-[8px] font-bold text-gray-400 uppercase mb-1">Butuh Aksi</p>
              <p className={`text-2xl font-black ${queuedForMe.length > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {loading ? '-' : String(queuedForMe.length).padStart(2, '0')}
              </p>
              <p className="text-[7px] text-gray-500 leading-tight">Antrean kamu</p>
            </div>
            <div className="bg-white p-3 rounded-2xl text-center shadow-sm">
              <p className="text-[8px] font-bold text-gray-400 uppercase mb-1">On Duty</p>
              <p className="text-2xl font-black text-emerald-600">
                {loading ? '-' : String(onDutyCount).padStart(2, '0')}
              </p>
              <p className="text-[7px] text-gray-500 leading-tight">Sudah bertugas</p>
            </div>
            <div className="bg-white p-3 rounded-2xl text-center shadow-sm">
              <p className="text-[8px] font-bold text-gray-400 uppercase mb-1">Kontrak</p>
              <p className={`text-2xl font-black ${pendingContracts > 0 ? 'text-rose-500' : 'text-gray-400'}`}>
                {loading ? '-' : String(pendingContracts).padStart(2, '0')}
              </p>
              <p className="text-[7px] text-gray-500 leading-tight">Pending</p>
            </div>
          </div>

          <div className="bg-white/70 p-3 rounded-2xl flex items-center justify-between">
            <div>
              <p className="text-[9px] font-bold text-purple-900">Tahap Pipeline Aktif</p>
              <p className="text-xs text-purple-700 font-medium">Grup yang sedang berjalan</p>
            </div>
            <span className="text-xl font-black text-purple-900">{loading ? '-' : groupSummary.length}</span>
          </div>
        </div>

        {/* Quick Actions */}
        {quickActions.length > 0 && (
          <div className={`grid grid-cols-${quickActions.length === 1 ? '1' : quickActions.length === 2 ? '2' : '3'} gap-3 mb-6`}>
            {quickActions.map((action) => (
              <Link key={action.to} to={action.to} className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 bg-white border border-purple-100 rounded-2xl flex items-center justify-center text-purple-600 shadow-sm active:scale-95 transition-transform">
                  <AppIcon name={action.icon} size={22} />
                </div>
                <span className="text-[9px] font-bold text-center leading-tight text-gray-700">
                  {action.label.split('\n').map((l, i) => <span key={i}>{l}{i === 0 ? <br /> : ''}</span>)}
                </span>
              </Link>
            ))}
          </div>
        )}

        {/* Hero pair */}
        <div className="flex gap-3 mb-6">
          <Link
            to="/hr/store"
            className="flex-1 bg-gradient-to-br from-purple-600 to-purple-800 p-4 rounded-3xl text-white relative overflow-hidden shadow-md transition-transform active:scale-[0.98]"
          >
            <div className="relative z-10">
              <p className="text-[9px] font-bold opacity-80 uppercase mb-1">Prioritas</p>
              <p className="text-2xl font-black">{loading ? '-' : queuedForMe.length}</p>
              <div className="w-full bg-white/20 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="bg-white h-1.5 rounded-full"
                  style={{ width: !loading && queuedForMe.length > 0 ? '100%' : '0%' }}
                />
              </div>
              <p className="text-[8px] opacity-70 mt-1">kandidat perlu aksi</p>
            </div>
            <AppIcon name="users" size={52} className="absolute -right-2 -bottom-2 opacity-10" />
          </Link>
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
        </div>

        {/* Action Queue */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Antrean Prioritas</p>
            <ToneBadge tone={queuedForMe.length > 0 ? 'warn' : 'ok'}>{queuedForMe.length} kandidat</ToneBadge>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-purple-600 border-t-transparent" />
            </div>
          ) : queuedForMe.length === 0 ? (
            <div className="bg-emerald-50 border border-emerald-100 rounded-[1.75rem] px-4 py-5 text-center">
              <p className="text-sm font-bold text-emerald-700">Antrean kamu kosong</p>
              <p className="text-[10px] text-emerald-600 mt-1">Semua kandidat sudah diproses</p>
            </div>
          ) : (
            <div className="space-y-2">
              {queuedForMe.slice(0, 8).map((candidate) => {
                const color = GROUP_COLORS[stageColor(candidate.current_stage)] || GROUP_COLORS.slate
                return (
                  <Link
                    key={candidate.id}
                    to={`/hr/candidates/${candidate.id}`}
                    className="flex items-center gap-3 rounded-[20px] bg-white border border-slate-100 px-4 py-3 transition-colors hover:border-purple-200 shadow-sm"
                  >
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${color.soft}`}>
                      <span className="text-sm font-black">{stageStep(candidate.current_stage)}</span>
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

        {/* Stage Pipeline */}
        <div className="mb-5">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-3">Pipeline Per Tahap</p>
          {groupSummary.length === 0 ? (
            <EmptyPanel title="Belum ada pipeline aktif" description="Kandidat aktif akan muncul di sini sesuai tahap rekrutmennya." />
          ) : (
            <div className="space-y-3">
              {groupSummary.map((group) => {
                const color = GROUP_COLORS[group.color] || GROUP_COLORS.slate
                return (
                  <div key={group.key} className={`rounded-[1.75rem] border p-4 ${color.panel}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wide">{group.label}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{group.description}</p>
                      </div>
                      <ToneBadge tone={group.actionable.length > 0 ? 'warn' : 'info'}>
                        {group.total} kandidat
                      </ToneBadge>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {group.stages.map((stage) => {
                        const count = group.rows.filter((c) => c.current_stage === stage).length
                        if (!count) return null
                        return (
                          <span key={stage} className={`rounded-full px-2.5 py-1 text-[10px] font-black ${color.pill}`}>
                            {stageLabel(stage)} · {count}
                          </span>
                        )
                      })}
                    </div>
                    <div className="space-y-1.5">
                      {group.rows.slice(0, 3).map((candidate) => (
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

      <HRBottomNav />
    </div>
  )
}
