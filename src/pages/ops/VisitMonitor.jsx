import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { fmtDateShort, visitGrade } from '../../lib/utils'
import { AUDIT_ITEMS, AUDIT_MAX_SCORE, AUDIT_SECTIONS } from '../../lib/constants'
import PhotoViewer from '../../components/PhotoViewer'
import { OpsBottomNav } from '../../components/BottomNav'
import {
  AppIcon,
  EmptyPanel,
  HeroCard,
  InlineStat,
  SectionPanel,
  SegmentedControl,
  SubpageShell,
  ToneBadge,
} from '../../components/ui/AppKit'

const PERIODS = [
  { key: 'today', label: 'Hari ini' },
  { key: 'week', label: 'Minggu ini' },
  { key: 'month', label: 'Bulan ini' },
]

function periodRange(key) {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

  if (key === 'today') {
    const t = fmt(now)
    return { from: t, to: t }
  }
  if (key === 'week') {
    const day = now.getDay()
    const mon = new Date(now)
    mon.setDate(now.getDate() - ((day + 6) % 7))
    return { from: fmt(mon), to: fmt(now) }
  }
  // month
  const from = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`
  return { from, to: fmt(now) }
}

export default function VisitMonitor() {
  const [period, setPeriod] = useState('today')
  const [visits, setVisits] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    fetchVisits()
  }, [period])

  const fetchVisits = async () => {
    setLoading(true)
    setExpanded(null)
    const { from, to } = periodRange(period)
    const { data } = await supabase
      .from('daily_visits')
      .select('*, branch:branches(id,name,store_id,district,area), auditor:profiles!auditor_id(id,full_name,role), visit_scores(*)')
      .gte('tanggal', from)
      .lte('tanggal', to)
      .order('tanggal', { ascending: false })
      .order('created_at', { ascending: false })

    setVisits(data || [])
    setLoading(false)
  }

  const avgScore = visits.length
    ? Math.round(visits.reduce((sum, v) => sum + (v.total_score || 0), 0) / visits.length)
    : 0

  // Grades stored as 'Excellent'/'Good'/'Fair'/'Poor' from visitGrade()
  const gradeCount = visits.reduce((acc, v) => {
    const g = v.grade || '?'
    acc[g] = (acc[g] || 0) + 1
    return acc
  }, {})

  return (
    <SubpageShell
      title="Monitoring Visit"
      subtitle="Laporan audit DM & AM ke semua toko"
      eyebrow="Visit Overview"
      footer={<OpsBottomNav />}
    >
      <HeroCard
        eyebrow="Summary"
        title={`${visits.length} Audit${visits.length !== 1 ? '' : ''}`}
        description="Pantau semua kunjungan audit yang dilakukan district manager dan area manager ke setiap toko."
        meta={
          <>
            <ToneBadge tone="info">{visits.length} visit</ToneBadge>
            {visits.length > 0 && (
              <ToneBadge tone={avgScore >= 85 ? 'ok' : avgScore >= 70 ? 'warn' : 'danger'}>
                Avg {avgScore}/{AUDIT_MAX_SCORE}
              </ToneBadge>
            )}
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-4">
          <InlineStat label="Excellent" value={gradeCount['Excellent'] || 0} tone={(gradeCount['Excellent'] || 0) > 0 ? 'ok' : 'slate'} />
          <InlineStat label="Good" value={gradeCount['Good'] || 0} tone={(gradeCount['Good'] || 0) > 0 ? 'ok' : 'slate'} />
          <InlineStat label="Fair" value={gradeCount['Fair'] || 0} tone={(gradeCount['Fair'] || 0) > 0 ? 'warn' : 'slate'} />
          <InlineStat label="Poor" value={gradeCount['Poor'] || 0} tone={(gradeCount['Poor'] || 0) > 0 ? 'danger' : 'slate'} />
        </div>
      </HeroCard>

      <div className="mt-6 space-y-6">
        <SectionPanel
          eyebrow="Filter"
          title="Periode"
          description="Pilih rentang waktu laporan audit yang ingin ditampilkan."
          actions={
            <SegmentedControl
              options={PERIODS}
              value={period}
              onChange={setPeriod}
            />
          }
        />

        <SectionPanel
          eyebrow="Audit Log"
          title="Daftar Kunjungan"
          description="Klik kartu untuk melihat detail skor per item, catatan, dan foto kondisi toko."
          actions={<ToneBadge tone="info">{visits.length} laporan</ToneBadge>}
        >
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
            </div>
          ) : visits.length === 0 ? (
            <EmptyPanel
              title="Belum ada data audit"
              description="Belum ada kunjungan yang tercatat untuk periode ini."
            />
          ) : (
            <div className="space-y-3">
              {visits.map((visit) => (
                <VisitCard
                  key={visit.id}
                  visit={visit}
                  isExpanded={expanded === visit.id}
                  onToggle={() => setExpanded(expanded === visit.id ? null : visit.id)}
                />
              ))}
            </div>
          )}
        </SectionPanel>
      </div>
    </SubpageShell>
  )
}

function VisitCard({ visit, isExpanded, onToggle }) {
  const grade = visitGrade(visit.total_score || 0)
  const scoreTone = (visit.total_score || 0) >= 85 ? 'ok' : (visit.total_score || 0) >= 70 ? 'warn' : 'danger'

  const scoresByKey = {}
  const photosByKey = {}
  ;(visit.visit_scores || []).forEach((s) => {
    scoresByKey[s.item_key] = s.score
    photosByKey[s.item_key] = s.photos || []
  })

  return (
    <article className="rounded-[26px] border border-white/85 bg-white shadow-[0_20px_55px_-40px_rgba(15,23,42,0.3)]">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-4 px-5 py-5 text-left transition-colors hover:bg-slate-50/70"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
          <span className="text-sm font-bold">{visit.branch?.store_id?.split('-')[1] || '--'}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-semibold text-slate-950">
            {visit.branch?.name?.replace('Bagi Kopi ', '') || '-'}
          </div>
          <div className="mt-0.5 text-sm text-slate-500">
            {fmtDateShort(visit.tanggal)} · {visit.auditor?.full_name || 'Auditor'} · {visit.branch?.district || '-'}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ToneBadge tone={scoreTone}>
            {visit.total_score}/{AUDIT_MAX_SCORE} · {grade.label}
          </ToneBadge>
          <AppIcon name={isExpanded ? 'chevronDown' : 'chevronRight'} size={18} className="text-slate-400" />
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-slate-100 px-5 py-5 space-y-5">
          {/* Score breakdown by section */}
          {AUDIT_SECTIONS.map((section) => {
            const ITEM_MAX = 5
            const sectionItems = AUDIT_ITEMS.filter((item) => item.section === section.key)
            const sectionScore = sectionItems.reduce((sum, item) => sum + (scoresByKey[item.key] || 0), 0)
            const sectionMax = sectionItems.length * ITEM_MAX

            return (
              <div key={section.key}>
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                    {section.emoji ? `${section.emoji} ` : ''}{section.label}
                  </div>
                  <ToneBadge tone={sectionScore >= sectionMax * 0.85 ? 'ok' : sectionScore >= sectionMax * 0.7 ? 'warn' : 'danger'}>
                    {sectionScore}/{sectionMax}
                  </ToneBadge>
                </div>
                <div className="space-y-3">
                  {sectionItems.map((item) => {
                    const score = scoresByKey[item.key]
                    const photos = photosByKey[item.key] || []
                    return (
                      <div key={item.key} className="rounded-[18px] bg-slate-50/85 px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm text-slate-700">{item.label}</span>
                          <div className="flex shrink-0 items-center gap-2">
                            <ScoreChips value={score} max={ITEM_MAX} />
                            <span className="text-xs font-semibold text-slate-500">
                              {score ?? '-'}/{ITEM_MAX}
                            </span>
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

          {/* Catatan */}
          {visit.catatan && (
            <div className="rounded-[18px] bg-amber-50 border border-amber-100 px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-600 mb-2">Catatan Auditor</div>
              <p className="text-sm leading-6 text-slate-700">{visit.catatan}</p>
            </div>
          )}

          {/* Foto kondisi umum */}
          {(visit.foto_kondisi || []).length > 0 && (
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400 mb-3">Foto Kondisi Umum</div>
              <PhotoViewer urls={visit.foto_kondisi} emptyText="Tidak ada foto" />
            </div>
          )}

          <div className="rounded-[18px] bg-slate-50 px-4 py-3 text-xs text-slate-500">
            Audit oleh <span className="font-semibold">{visit.auditor?.full_name || '-'}</span> · {new Date(visit.created_at).toLocaleString('id-ID')}
          </div>
        </div>
      )}
    </article>
  )
}

function ScoreChips({ value, max }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: max }).map((_, i) => (
        <div
          key={i}
          className={`h-2 w-2 rounded-full ${
            value != null && i < value
              ? value >= max * 0.85
                ? 'bg-emerald-500'
                : value >= max * 0.7
                  ? 'bg-amber-400'
                  : 'bg-rose-400'
              : 'bg-slate-200'
          }`}
        />
      ))}
    </div>
  )
}
