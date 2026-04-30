import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { AUDIT_ITEMS, AUDIT_MAX_SCORE, AUDIT_SECTIONS } from '../../lib/constants'
import { fmtDateShort, roleLabel, todayWIB, visitGrade } from '../../lib/utils'
import PhotoViewer from '../../components/PhotoViewer'
import { OpsBottomNav } from '../../components/BottomNav'
import {
  AppIcon,
  EmptyPanel,
  SectionPanel,
  SubpageShell,
  ToneBadge,
} from '../../components/ui/AppKit'

export default function VisitMonitor() {
  const [loading, setLoading] = useState(true)
  const [managerCards, setManagerCards] = useState([])
  const [expandedManagerId, setExpandedManagerId] = useState(null)
  const [selectedDate, setSelectedDate] = useState(todayWIB())

  useEffect(() => {
    fetchMonitor(selectedDate)
  }, [selectedDate])

  const fetchMonitor = async (date) => {
    setLoading(true)
    setExpandedManagerId(null)

    const [managerRes, branchRes, visitRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('id,full_name,role,managed_districts,managed_areas')
        .in('role', ['district_manager', 'area_manager'])
        .eq('is_active', true)
        .order('role')
        .order('full_name'),
      supabase
        .from('branches')
        .select('id,name,store_id,district,area')
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('daily_visits')
        .select('*, branch:branches(id,name,store_id,district,area), auditor:profiles!auditor_id(id,full_name,role), visit_scores(*)')
        .eq('tanggal', date)
        .order('created_at', { ascending: false }),
    ])

    const managers = managerRes.data || []
    const branches = branchRes.data || []
    const visits = visitRes.data || []

    const cards = managers.map((manager) => {
      const scopedBranches = branches.filter((branch) => {
        if (manager.role === 'district_manager') {
          return (manager.managed_districts || []).includes(branch.district)
        }
        return (manager.managed_areas || []).includes(branch.area)
      })

      const myVisits = visits.filter((visit) => visit.auditor_id === manager.id)
      const visitedStoreIds = new Set(myVisits.map((visit) => visit.branch_id))
      const completionPct = scopedBranches.length > 0
        ? Math.min(100, Math.round((visitedStoreIds.size / scopedBranches.length) * 100))
        : 0
      const avgScore = myVisits.length > 0
        ? Math.round(myVisits.reduce((sum, visit) => sum + Number(visit.total_score || 0), 0) / myVisits.length)
        : 0
      const missingBranches = scopedBranches.filter((branch) => !visitedStoreIds.has(branch.id))

      return {
        ...manager,
        scopedBranches,
        myVisits,
        visitedCount: visitedStoreIds.size,
        completionPct,
        avgScore,
        missingBranches,
        hasSubmitted: myVisits.length > 0,
      }
    })

    setManagerCards(cards)
    setLoading(false)
  }

  const summary = useMemo(() => {
    const submittedManagers = managerCards.filter((manager) => manager.hasSubmitted).length
    const totalVisits = managerCards.reduce((sum, manager) => sum + manager.myVisits.length, 0)
    const totalTargets = managerCards.reduce((sum, manager) => sum + manager.scopedBranches.length, 0)
    const totalCovered = managerCards.reduce((sum, manager) => sum + manager.visitedCount, 0)

    return {
      submittedManagers,
      totalVisits,
      totalTargets,
      totalCovered,
      coveragePct: totalTargets > 0 ? Math.round((totalCovered / totalTargets) * 100) : 0,
    }
  }, [managerCards])

  const isToday = selectedDate === todayWIB()

  return (
    <SubpageShell
      title="Monitoring Visit"
      subtitle={`Status submit audit manager per ${fmtDateShort(selectedDate)}`}
      eyebrow="Retail Visit Control"
      footer={<OpsBottomNav />}
    >
      <div className="space-y-6">
        <section className="rounded-[34px] border border-blue-100 bg-gradient-to-r from-sky-100 via-blue-50 to-white p-[1px] shadow-[0_28px_80px_-52px_rgba(37,99,235,0.45)]">
          <div className="rounded-[33px] bg-white/95 px-5 py-6 backdrop-blur sm:px-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.22em] text-blue-700">{isToday ? 'Monitoring Hari Ini' : 'Monitoring Historis'}</div>
                <h2 className="mt-2 text-[1.9rem] font-black leading-none text-slate-950">Visit per Manager</h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
                  Target monitoringnya 1 hari 1 toko. Pilih tanggal untuk melihat data historis.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={selectedDate}
                  max={todayWIB()}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="h-14 rounded-[22px] border border-blue-100 bg-blue-50 px-4 text-sm font-semibold text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
                <button
                  type="button"
                  onClick={() => fetchMonitor(selectedDate)}
                  className="flex h-14 w-14 items-center justify-center rounded-[22px] border border-blue-100 bg-blue-50 text-blue-600 transition-colors hover:bg-blue-100"
                >
                  <AppIcon name="refresh" size={22} />
                </button>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <StatCard label="Manager Submit" value={`${summary.submittedManagers}/${managerCards.length || 0}`} helper={`Manager yang sudah kirim audit ${isToday ? 'hari ini' : 'tanggal ini'}.`} />
              <StatCard label="Coverage Toko" value={`${summary.coveragePct}%`} helper={`${summary.totalCovered}/${summary.totalTargets || 0} toko sudah divisit.`} tone="blue" />
              <StatCard label="Total Audit" value={summary.totalVisits} helper={`Jumlah form audit yang masuk ${isToday ? 'hari ini' : 'tanggal ini'}.`} />
            </div>

            <button
              type="button"
              className="mt-6 flex w-full items-center justify-center gap-3 rounded-[24px] bg-blue-600 px-5 py-4 text-sm font-bold text-white shadow-[0_18px_42px_-24px_rgba(37,99,235,0.7)]"
            >
              <AppIcon name="users" size={18} />
              {managerCards.length} Manager Terpantau — {fmtDateShort(selectedDate)}
            </button>
          </div>
        </section>

        <SectionPanel
          eyebrow="Manager Status"
          title="Nama Manager"
          description="Klik nama manager untuk melihat toko yang dia visit hari ini, skor audit, dan foto auditnya."
          actions={<ToneBadge tone="info">{managerCards.length} manager</ToneBadge>}
        >
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
            </div>
          ) : managerCards.length === 0 ? (
            <EmptyPanel
              title="Belum ada manager"
              description="Data district manager dan area manager belum tersedia."
            />
          ) : (
            <div className="space-y-3">
              {managerCards.map((manager) => (
                <ManagerVisitCard
                  key={manager.id}
                  manager={manager}
                  isExpanded={expandedManagerId === manager.id}
                  onToggle={() => setExpandedManagerId((current) => current === manager.id ? null : manager.id)}
                />
              ))}
            </div>
          )}
        </SectionPanel>
      </div>
    </SubpageShell>
  )
}

function StatCard({ label, value, helper, tone = 'slate' }) {
  const toneStyles = tone === 'blue'
    ? 'border-blue-100 bg-blue-50/70 text-blue-700'
    : 'border-slate-100 bg-slate-50 text-slate-900'

  return (
    <div className={`rounded-[24px] border px-4 py-4 ${toneStyles}`}>
      <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</div>
      <div className="mt-2 text-3xl font-black">{value}</div>
      <div className="mt-2 text-sm text-slate-500">{helper}</div>
    </div>
  )
}

function ManagerVisitCard({ manager, isExpanded, onToggle }) {
  const statusTone = manager.hasSubmitted ? 'ok' : 'danger'
  const avgGrade = visitGrade(manager.avgScore || 0)
  const ringColor = manager.hasSubmitted ? 'bg-emerald-500' : 'bg-rose-400'

  return (
    <article className="overflow-hidden rounded-[26px] border border-white/85 bg-white shadow-[0_20px_55px_-40px_rgba(15,23,42,0.3)]">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-5 py-5 text-left transition-colors hover:bg-slate-50/70"
      >
        <div className="flex items-start gap-4">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-sm font-black text-white ${manager.role === 'area_manager' ? 'bg-violet-500' : 'bg-blue-600'}`}>
            {initials(manager.full_name)}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-base font-semibold text-slate-950">{manager.full_name}</div>
                <div className="mt-1 text-sm text-slate-500">{roleLabel(manager.role)} • target {manager.scopedBranches.length} toko</div>
              </div>
              <ToneBadge tone={statusTone}>{manager.hasSubmitted ? 'Sudah Submit' : 'Belum Submit'}</ToneBadge>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <MiniMetric label="Visit Hari Ini" value={`${manager.visitedCount}/${manager.scopedBranches.length || 0}`} accent={ringColor} />
              <MiniMetric label="Coverage" value={`${manager.completionPct}%`} accent="bg-blue-500" />
              <MiniMetric label="Avg Audit" value={manager.hasSubmitted ? `${manager.avgScore}/${AUDIT_MAX_SCORE}` : '-'} accent={manager.hasSubmitted ? 'bg-emerald-500' : 'bg-slate-300'} />
            </div>

            {manager.hasSubmitted && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <ToneBadge tone="info">{manager.myVisits.length} audit</ToneBadge>
                <ToneBadge tone={manager.avgScore >= 85 ? 'ok' : manager.avgScore >= 70 ? 'warn' : 'danger'}>
                  {avgGrade.label}
                </ToneBadge>
                {manager.missingBranches.length > 0 && (
                  <ToneBadge tone="warn">{manager.missingBranches.length} toko belum divisit</ToneBadge>
                )}
              </div>
            )}
          </div>

          <AppIcon name={isExpanded ? 'chevronDown' : 'chevronRight'} size={18} className="mt-1 text-slate-400" />
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-slate-100 px-5 py-5">
          {manager.myVisits.length === 0 ? (
            <div className="space-y-4">
              <EmptyPanel
                title="Belum ada audit hari ini"
                description="Manager ini belum submit audit visit untuk toko mana pun hari ini."
              />

              {manager.missingBranches.length > 0 && (
                <div>
                  <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Toko Belum Divisit</div>
                  <div className="flex flex-wrap gap-2">
                    {manager.missingBranches.map((branch) => (
                      <ToneBadge key={branch.id} tone="slate">{branch.name.replace('Bagi Kopi ', '')}</ToneBadge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Kunjungan Hari Ini</div>
                <div className="space-y-4">
                  {manager.myVisits.map((visit) => (
                    <VisitDetailCard key={visit.id} visit={visit} />
                  ))}
                </div>
              </div>

              {manager.missingBranches.length > 0 && (
                <div>
                  <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Toko Belum Divisit</div>
                  <div className="flex flex-wrap gap-2">
                    {manager.missingBranches.map((branch) => (
                      <ToneBadge key={branch.id} tone="warn">{branch.name.replace('Bagi Kopi ', '')}</ToneBadge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  )
}

function MiniMetric({ label, value, accent }) {
  return (
    <div className="rounded-[18px] bg-slate-50 px-3 py-3">
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${accent}`} />
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</div>
      </div>
      <div className="mt-2 text-lg font-black text-slate-950">{value}</div>
    </div>
  )
}

function VisitDetailCard({ visit }) {
  const grade = visitGrade(visit.total_score || 0)
  const scoreTone = (visit.total_score || 0) >= 85 ? 'ok' : (visit.total_score || 0) >= 70 ? 'warn' : 'danger'

  const scoresByKey = {}
  const photosByKey = {}
  ;(visit.visit_scores || []).forEach((score) => {
    scoresByKey[score.item_key] = score.score
    photosByKey[score.item_key] = score.photos || []
  })

  return (
    <div className="rounded-[24px] border border-slate-100 bg-slate-50/75 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold text-slate-950">{visit.branch?.name?.replace('Bagi Kopi ', '') || '-'}</div>
          <div className="mt-1 text-sm text-slate-500">{visit.branch?.store_id} • {visit.branch?.district || visit.branch?.area || '-'}</div>
          <div className="mt-1 text-xs text-slate-400">{fmtDateShort(visit.tanggal)} • {new Date(visit.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
        <ToneBadge tone={scoreTone}>{visit.total_score}/{AUDIT_MAX_SCORE} • {grade.label}</ToneBadge>
      </div>

      <div className="mt-4 space-y-4">
        {AUDIT_SECTIONS.map((section) => {
          const items = AUDIT_ITEMS.filter((item) => item.section === section.key)
          const sectionScore = items.reduce((sum, item) => sum + (scoresByKey[item.key] || 0), 0)
          const sectionMax = items.length * 5

          return (
            <div key={section.key}>
              <div className="mb-2 flex items-center justify-between">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  {section.emoji ? `${section.emoji} ` : ''}{section.label}
                </div>
                <ToneBadge tone={sectionScore >= sectionMax * 0.85 ? 'ok' : sectionScore >= sectionMax * 0.7 ? 'warn' : 'danger'}>
                  {sectionScore}/{sectionMax}
                </ToneBadge>
              </div>

              <div className="space-y-2">
                {items.map((item) => {
                  const score = scoresByKey[item.key]
                  const photos = photosByKey[item.key] || []

                  return (
                    <div key={item.key} className="rounded-[18px] bg-white px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm text-slate-700">{item.label}</div>
                        <div className="flex items-center gap-2">
                          <ScoreDots value={score} />
                          <div className="text-xs font-semibold text-slate-500">{score ?? '-'}/5</div>
                        </div>
                      </div>
                      {photos.length > 0 && (
                        <div className="mt-3">
                          <PhotoViewer urls={photos} emptyText="" />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {visit.catatan && (
          <div className="rounded-[18px] border border-amber-100 bg-amber-50 px-4 py-4">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-600">Catatan Auditor</div>
            <p className="text-sm leading-6 text-slate-700">{visit.catatan}</p>
          </div>
        )}

        {(visit.foto_kondisi || []).length > 0 && (
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Foto Kondisi Umum</div>
            <PhotoViewer urls={visit.foto_kondisi} emptyText="" />
          </div>
        )}
      </div>
    </div>
  )
}

function ScoreDots({ value, max = 5 }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: max }).map((_, index) => (
        <div
          key={index}
          className={`h-2 w-2 rounded-full ${
            value != null && index < value
              ? value >= 4
                ? 'bg-emerald-500'
                : value >= 3
                  ? 'bg-amber-400'
                  : 'bg-rose-400'
              : 'bg-slate-200'
          }`}
        />
      ))}
    </div>
  )
}

function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || '--'
}
