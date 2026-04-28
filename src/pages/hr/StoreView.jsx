import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { SmartBottomNav } from '../../components/BottomNav'
import {
  ActionCard,
  AppIcon,
  EmptyPanel,
  HeroCard,
  InlineStat,
  SectionPanel,
  ToneBadge,
} from '../../components/ui/AppKit'
import {
  GROUP_COLORS,
  HS_ACTION_STAGES,
  POSITION_LABELS,
  STAGE_GROUPS,
  TRAINER_ACTION_STAGES,
  getActionStagesForRole,
  needsActionFrom,
  stageColor,
  stageLabel,
} from '../../lib/recruitment'
import { fmtDate } from '../../lib/utils'

const HR_ROLES = ['hr_staff', 'hr_spv', 'hr_legal', 'hr_administrator']

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
    ops_manager: 'Operations Manager',
  }[role] || role
}

export default function HRStoreView() {
  const { profile } = useAuth()
  const [candidates, setCandidates] = useState([])
  const [batches, setBatches] = useState([])
  const [loading, setLoading] = useState(true)

  const role = profile?.role
  const showBatchSection = ['head_store', 'district_manager'].includes(role)
  const actionStages = getActionStagesForRole(role)

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
    () => candidates.filter((candidate) => needsActionFrom(candidate, role)),
    [candidates, role],
  )

  const ojeQueue = candidates.filter((candidate) =>
    ['oje_instore_issued', 'oje_instore_submitted', 'review_hrstaff', 'revision_hs'].includes(candidate.current_stage),
  )
  const ojtQueue = candidates.filter((candidate) =>
    ['ojt_instore', 'assessment', 'training'].includes(candidate.current_stage),
  )

  const visibleGroups = STAGE_GROUPS
    .filter((group) => group.stages.some((stage) => candidates.some((candidate) => candidate.current_stage === stage)))
    .filter((group) => {
      if (role === 'trainer') return group.key === 'lanjutan'
      if (role === 'district_manager') return group.key === 'batch' || group.key === 'instore'
      if (['head_store', 'asst_head_store'].includes(role)) return group.key !== 'kontrak'
      return true
    })

  const batchPendingIds = new Set(
    candidates.filter((candidate) => candidate.current_stage === 'batch_oje_issued').map((candidate) => candidate.batch_id).filter(Boolean),
  )

  const quickActions = [
    ...(showBatchSection ? [{
      title: 'Batch OJE',
      description: 'Masuk ke penilaian batch yang sedang berjalan.',
      icon: 'checklist',
      to: '/hr/batch',
      accent: 'primary',
    }] : []),
    {
      title: 'Queue Aksi',
      description: 'Prioritas kandidat yang menunggu aksi dari role kamu.',
      icon: 'bell',
      to: '#queue',
      accent: 'amber',
    },
  ]

  return (
    <div className="min-h-screen bg-[#f8fbff] pb-28">
      <div className="sticky top-0 z-50 flex items-center justify-between border-b border-purple-50 bg-white/85 px-5 py-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link
            to={homeFor(role)}
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 transition-colors hover:bg-purple-100"
          >
            <AppIcon name="chevronLeft" size={18} />
          </Link>
          <div>
            <h1 className="text-[10px] font-black uppercase tracking-[0.18em] text-purple-600">{roleTitle(role)}</h1>
            <p className="text-lg font-extrabold text-gray-900">Recruitment Queue</p>
          </div>
        </div>
      </div>

      <div className="px-5 pt-5">
        <HeroCard
          eyebrow="Queue Kerja"
          title="Pantau kandidat per toko dan per tahap"
          description="Halaman ini sekarang diposisikan seperti monitor antrean. Buka batch kalau kamu sedang isi scorecard, lalu lanjut ke kandidat saat sudah masuk OJE atau OJT."
          meta={(
            <>
              <ToneBadge tone={actionQueue.length > 0 ? 'warn' : 'ok'}>{actionQueue.length} butuh aksi</ToneBadge>
              <ToneBadge tone="info">{ojeQueue.length} OJE toko</ToneBadge>
              <ToneBadge tone="ok">{ojtQueue.length} OJT/training</ToneBadge>
            </>
          )}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <InlineStat label="Kandidat Aktif" value={candidates.length} tone="primary" />
            <InlineStat label="Queue Aksi" value={actionQueue.length} tone={actionQueue.length > 0 ? 'amber' : 'emerald'} />
            <InlineStat label="Batch Aktif" value={batchPendingIds.size} tone="slate" />
          </div>
        </HeroCard>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {quickActions.map((action) => (
            action.to.startsWith('#') ? (
              <ActionCard
                key={action.title}
                title={action.title}
                description={action.description}
                icon={action.icon}
                onClick={() => {
                  const target = document.querySelector(action.to)
                  target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
                accent={action.accent}
              />
            ) : (
              <ActionCard
                key={action.title}
                title={action.title}
                description={action.description}
                icon={action.icon}
                to={action.to}
                accent={action.accent}
              />
            )
          ))}
        </div>

        {showBatchSection && (
          <SectionPanel
            className="mt-6"
            eyebrow="Batch Queue"
            title="Batch OJE Berjalan"
            description="Batch yang masih punya kandidat di tahap awal akan muncul di sini agar Head Store atau DM cepat tahu mana yang perlu diisi."
            actions={<ToneBadge tone={batchPendingIds.size > 0 ? 'warn' : 'info'}>{batches.length} batch</ToneBadge>}
          >
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
              </div>
            ) : batches.length === 0 ? (
              <EmptyPanel
                title="Belum ada batch"
                description="Batch OJE yang dibuat HR akan muncul di sini."
              />
            ) : (
              <div className="space-y-2">
                {batches.map((batch) => {
                  const pending = batchPendingIds.has(batch.id)
                  return (
                    <Link
                      key={batch.id}
                      to={`/hr/batch/${batch.id}`}
                      className="flex items-center gap-3 rounded-[20px] bg-slate-50/85 px-4 py-3 transition-colors hover:bg-slate-100"
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
            )}
          </SectionPanel>
        )}

        <SectionPanel
          className="mt-6"
          eyebrow="Action Queue"
          title="Kandidat Prioritas"
          description="Inilah antrean paling penting untuk role kamu sekarang."
          actions={<ToneBadge tone={actionQueue.length > 0 ? 'warn' : 'ok'}>{actionQueue.length} kandidat</ToneBadge>}
        >
          <div id="queue" />
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
            </div>
          ) : actionQueue.length === 0 ? (
            <EmptyPanel
              title="Antrean kosong"
              description="Tidak ada kandidat yang menunggu aksi dari role kamu saat ini."
            />
          ) : (
            <div className="space-y-2">
              {actionQueue.map((candidate) => {
                const color = GROUP_COLORS[stageColor(candidate.current_stage)] || GROUP_COLORS.slate
                return (
                  <Link
                    key={candidate.id}
                    to={`/hr/candidates/${candidate.id}`}
                    className="flex items-center gap-3 rounded-[20px] bg-slate-50/85 px-4 py-3 transition-colors hover:bg-slate-100"
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
        </SectionPanel>

        <SectionPanel
          className="mt-6 mb-2"
          eyebrow="Pipeline View"
          title="Kandidat Per Tahap"
          description="Kalau mau lihat progres semua kandidat, pakai daftar stage di bawah ini."
        >
          {visibleGroups.length === 0 ? (
            <EmptyPanel title="Belum ada pipeline" description="Kandidat aktif akan muncul setelah batch dibuat." />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {visibleGroups.map((group) => {
                const rows = candidates.filter((candidate) => group.stages.includes(candidate.current_stage))
                const color = GROUP_COLORS[group.color] || GROUP_COLORS.slate
                return (
                  <article key={group.key} className={`rounded-[22px] border p-4 ${color.panel}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-black uppercase tracking-[0.16em]">{group.label}</div>
                        <div className="mt-2 text-sm text-slate-600">{group.description}</div>
                      </div>
                      <ToneBadge tone="info">{rows.length} kandidat</ToneBadge>
                    </div>
                    <div className="mt-4 space-y-2">
                      {rows.slice(0, 4).map((candidate) => (
                        <Link
                          key={candidate.id}
                          to={`/hr/candidates/${candidate.id}`}
                          className="flex items-center justify-between rounded-[18px] bg-white/85 px-3 py-3 text-slate-800 transition-colors hover:bg-white"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold">{candidate.full_name}</div>
                            <div className="truncate text-xs text-slate-500">
                              {candidate.branches?.name || '-'} · {stageLabel(candidate.current_stage)}
                            </div>
                          </div>
                          <AppIcon name="chevronRight" size={16} className="text-slate-400" />
                        </Link>
                      ))}
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </SectionPanel>
      </div>

      <SmartBottomNav />
    </div>
  )
}
