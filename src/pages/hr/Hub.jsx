import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { HRBottomNav } from '../../components/BottomNav'
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
  const activeCandidates = candidates.filter((candidate) => candidate.status === 'active')
  const actionStages = getActionStagesForRole(role)

  const queuedForMe = useMemo(
    () => activeCandidates.filter((candidate) => needsActionFrom(candidate, role)),
    [activeCandidates, role],
  )

  const groupSummary = useMemo(() => {
    return STAGE_GROUPS.map((group) => {
      const rows = activeCandidates.filter((candidate) => group.stages.includes(candidate.current_stage))
      const actionable = rows.filter((candidate) => needsActionFrom(candidate, role))
      return {
        ...group,
        rows,
        total: rows.length,
        actionable,
      }
    }).filter((group) => group.total > 0)
  }, [activeCandidates, role])

  const pendingContracts = activeCandidates.filter((candidate) => candidate.current_stage === 'kontrak_pending').length
  const onDutyCount = candidates.filter((candidate) => candidate.current_stage === 'on_duty').length

  const quickActions = [
    ...(['hr_staff', 'hr_administrator', 'ops_manager', 'support_spv'].includes(role)
      ? [{
          title: 'Batch OJE',
          description: 'Buat batch baru dan masuk ke layar penilaian massal kandidat.',
          icon: 'checklist',
          to: '/hr/batch',
          accent: 'primary',
        }]
      : []),
    {
      title: 'Queue Toko',
      description: 'Lihat semua kandidat per toko dan action yang harus dilakukan Head Store atau DM.',
      icon: 'store',
      to: '/hr/store',
      accent: 'violet',
    },
    ...(['hr_legal', 'hr_administrator', 'ops_manager'].includes(role)
      ? [{
          title: 'Kontrak Pending',
          description: 'Finalisasi kandidat yang sudah lolos approval dan siap dibuatkan akun.',
          icon: 'approval',
          to: '/hr/kontrak',
          accent: 'amber',
        }]
      : []),
  ]

  return (
    <div className="min-h-screen bg-[#f8fbff] pb-28">
      <div className="sticky top-0 z-50 flex items-center justify-between border-b border-purple-50 bg-white/85 px-5 py-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-600 text-white shadow-lg shadow-purple-200">
            <AppIcon name="users" size={20} />
          </div>
          <div>
            <h1 className="text-[10px] font-black uppercase tracking-[0.18em] text-purple-600">Human Resources</h1>
            <p className="text-lg font-extrabold text-gray-900">Recruitment Flow</p>
          </div>
        </div>
        <button
          onClick={signOut}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-50 text-purple-600 transition-colors hover:bg-purple-100"
        >
          <AppIcon name="logout" size={18} />
        </button>
      </div>

      <div className="px-5 pt-5">
        <HeroCard
          eyebrow="Recruitment Control"
          title={`Queue kerja ${shortName} hari ini`}
          description="Alur rekrutmen sekarang dibaca seperti pipeline: lihat antrean tahap, buka detail kandidat, lalu selesaikan aksi hanya dari tahap yang memang sedang aktif."
          meta={(
            <>
              <ToneBadge tone="info">{activeCandidates.length} kandidat aktif</ToneBadge>
              <ToneBadge tone={queuedForMe.length > 0 ? 'warn' : 'ok'}>
                {queuedForMe.length} butuh aksi
              </ToneBadge>
              <ToneBadge tone={pendingContracts > 0 ? 'warn' : 'slate'}>
                {pendingContracts} kontrak pending
              </ToneBadge>
            </>
          )}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <InlineStat label="Butuh Aksi" value={queuedForMe.length} tone={queuedForMe.length > 0 ? 'amber' : 'emerald'} />
            <InlineStat label="On Duty" value={onDutyCount} tone="emerald" />
            <InlineStat label="Tahap Aktif" value={groupSummary.length} tone="primary" />
          </div>
        </HeroCard>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {quickActions.map((action) => (
            <ActionCard
              key={action.to}
              title={action.title}
              description={action.description}
              icon={action.icon}
              to={action.to}
              accent={action.accent}
            />
          ))}
        </div>

        <div className="mt-6 space-y-6">
          <SectionPanel
            eyebrow="Action Queue"
            title="Prioritas Saat Ini"
            description="Hanya kandidat yang memang menunggu keputusan role kamu yang muncul di sini."
            actions={<ToneBadge tone={queuedForMe.length > 0 ? 'warn' : 'ok'}>{queuedForMe.length} kandidat</ToneBadge>}
          >
            {loading ? (
              <div className="flex justify-center py-10">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
              </div>
            ) : queuedForMe.length === 0 ? (
              <EmptyPanel
                title="Tidak ada antrean"
                description="Semua kandidat yang perlu aksi dari role kamu saat ini sudah selesai diproses."
              />
            ) : (
              <div className="space-y-3">
                {queuedForMe.slice(0, 10).map((candidate) => {
                  const color = GROUP_COLORS[stageColor(candidate.current_stage)] || GROUP_COLORS.slate
                  const group = stageGroupFor(candidate.current_stage)
                  return (
                    <Link
                      key={candidate.id}
                      to={`/hr/candidates/${candidate.id}`}
                      className="flex items-center gap-3 rounded-[22px] bg-slate-50/85 px-4 py-4 transition-colors hover:bg-slate-100"
                    >
                      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${color.soft}`}>
                        <span className="text-sm font-black">{stageStep(candidate.current_stage)}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-slate-900">{candidate.full_name}</div>
                        <div className="mt-1 truncate text-xs text-slate-500">
                          {candidate.branches?.name || '-'} · {POSITION_LABELS[candidate.applied_position] || candidate.applied_position}
                        </div>
                        <div className="mt-1 truncate text-[11px] text-slate-400">
                          PIC sekarang: {stagePic(candidate.current_stage)} · Grup: {group?.label || '-'}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <ToneBadge tone="info">{stageLabel(candidate.current_stage)}</ToneBadge>
                        <div className="mt-2 text-[11px] font-semibold text-slate-400">
                          {ACTION_LABELS.advance ? 'Buka detail' : ''}
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </SectionPanel>

          <SectionPanel
            eyebrow="Stage Pipeline"
            title="Antrean Per Tahap"
            description="Pola ini mengikuti Supply Chain: tiap tahap punya jumlah antrean, siapa PIC-nya, dan pintu masuk detail yang jelas."
          >
            {groupSummary.length === 0 ? (
              <EmptyPanel
                title="Belum ada pipeline aktif"
                description="Kandidat aktif akan muncul di sini sesuai tahap rekrutmennya."
              />
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {groupSummary.map((group) => {
                  const color = GROUP_COLORS[group.color] || GROUP_COLORS.slate
                  const nextCandidates = group.rows.slice(0, 3)

                  return (
                    <article key={group.key} className={`rounded-[24px] border p-4 ${color.panel}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[11px] font-black uppercase tracking-[0.16em]">{group.label}</div>
                          <div className="mt-2 text-sm leading-6 text-slate-600">{group.description}</div>
                        </div>
                        <ToneBadge tone={group.actionable.length > 0 ? 'warn' : 'info'}>
                          {group.total} kandidat
                        </ToneBadge>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {group.stages.map((stage) => {
                          const count = group.rows.filter((candidate) => candidate.current_stage === stage).length
                          if (!count) return null
                          return (
                            <span key={stage} className={`rounded-full px-2.5 py-1 text-[10px] font-black ${color.pill}`}>
                              {stageLabel(stage)} · {count}
                            </span>
                          )
                        })}
                      </div>

                      <div className="mt-4 space-y-2">
                        {nextCandidates.map((candidate) => (
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

          <SectionPanel
            eyebrow="Semua Kandidat"
            title="Daftar Kandidat"
            description="Daftar ini tetap tersedia, tapi fokus utamanya sekarang adalah antrean per tahap di atas."
            actions={<ToneBadge tone="info">{activeCandidates.length} aktif</ToneBadge>}
          >
            {activeCandidates.length === 0 ? (
              <EmptyPanel
                title="Belum ada kandidat aktif"
                description="Kandidat baru akan muncul setelah batch OJE dibuat."
              />
            ) : (
              <div className="space-y-2">
                {activeCandidates.map((candidate) => {
                  const statusTone = STATUS_CONFIG[candidate.status]?.tone || 'slate'
                  return (
                    <Link
                      key={candidate.id}
                      to={`/hr/candidates/${candidate.id}`}
                      className="flex items-center gap-3 rounded-[20px] bg-slate-50/85 px-4 py-3 transition-colors hover:bg-slate-100"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-slate-500 shadow-sm">
                        <AppIcon name="users" size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-slate-900">{candidate.full_name}</div>
                        <div className="truncate text-xs text-slate-500">
                          {candidate.branches?.name || '-'} · {POSITION_LABELS[candidate.applied_position] || candidate.applied_position}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <ToneBadge tone={statusTone}>{stageLabel(candidate.current_stage)}</ToneBadge>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </SectionPanel>
        </div>
      </div>

      <HRBottomNav />
    </div>
  )
}
