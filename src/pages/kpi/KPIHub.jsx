import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { SmartBottomNav } from '../../components/BottomNav'
import { KPI_PERSONAL_INPUT_ROLES, KPI_360_ROLES } from '../../lib/access'
import { currentPeriodWIB, lastNPeriods, periodLabel, roleLabel } from '../../lib/utils'
import {
  ActionCard,
  EmptyPanel,
  HeroCard,
  InlineStat,
  SectionPanel,
  SegmentedControl,
  ToneBadge,
  SubpageShell,
} from '../../components/ui/AppKit'

const TAB_OPTIONS = [
  { key: 'store', label: 'KPI Toko' },
  { key: 'personal', label: 'KPI Personal' },
  { key: 'review360', label: 'KPI 360' },
]

function scoreTone(score) {
  if (score >= 4) return 'ok'
  if (score >= 3) return 'warn'
  return 'danger'
}

function formatPercent(value) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`
}

export default function KPIHub() {
  const { profile } = useAuth()
  const [tab, setTab] = useState('store')
  const [period, setPeriod] = useState(currentPeriodWIB())
  const [storeStats, setStoreStats] = useState({ total: 0, average: 0, topStore: null })
  const [personalRows, setPersonalRows] = useState([])
  const [review360Rows, setReview360Rows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      if (!profile?.id) return

      setLoading(true)
      setError('')

      try {
        const [storeRes, personalRes, review360Res] = await Promise.all([
          supabase
            .from('kpi_reports')
            .select('branch_id,total_score,branch:branches(name)')
            .eq('bulan', `${period}-01`),
          supabase
            .from('kpi_personal_scores')
            .select('staff_id,score,verified_at,updated_at,staff:profiles(full_name,role)')
            .eq('period_month', period),
          supabase
            .from('kpi_360_submissions')
            .select('id,evaluatee_id,group_type,updated_at,evaluatee:profiles(full_name,role)')
            .eq('period_month', period),
        ])

        if (storeRes.error || personalRes.error || review360Res.error) {
          throw new Error(storeRes.error?.message || personalRes.error?.message || review360Res.error?.message || 'Gagal memuat dashboard KPI.')
        }

        const storeRows = storeRes.data || []
        const averageStoreScore = storeRows.length
          ? storeRows.reduce((sum, row) => sum + Number(row.total_score || 0), 0) / storeRows.length
          : 0
        const topStore = [...storeRows].sort((a, b) => Number(b.total_score || 0) - Number(a.total_score || 0))[0] || null
        setStoreStats({
          total: storeRows.length,
          average: averageStoreScore,
          topStore,
        })

        const groupedPersonal = {}
        ;(personalRes.data || []).forEach((row) => {
          if (!groupedPersonal[row.staff_id]) {
            groupedPersonal[row.staff_id] = {
              staff_id: row.staff_id,
              scores: [],
              latest_update: row.updated_at,
              verified: !!row.verified_at,
              staff: row.staff,
            }
          }

          groupedPersonal[row.staff_id].scores.push(Number(row.score || 0))
          groupedPersonal[row.staff_id].verified = groupedPersonal[row.staff_id].verified || !!row.verified_at
          groupedPersonal[row.staff_id].latest_update =
            groupedPersonal[row.staff_id].latest_update > row.updated_at
              ? groupedPersonal[row.staff_id].latest_update
              : row.updated_at
        })

        setPersonalRows(
          Object.values(groupedPersonal)
            .map((row) => ({
              ...row,
              average: row.scores.length ? row.scores.reduce((sum, score) => sum + score, 0) / row.scores.length : 0,
            }))
            .sort((a, b) => b.average - a.average)
            .slice(0, 8)
        )

        const submissionIds = (review360Res.data || []).map((row) => row.id)
        let scoreRows = []
        if (submissionIds.length) {
          const { data, error: scoreError } = await supabase
            .from('kpi_360_scores')
            .select('submission_id,score')
            .in('submission_id', submissionIds)
          if (scoreError) {
            throw new Error(scoreError.message || 'Gagal memuat skor KPI 360.')
          }
          scoreRows = data || []
        }

        const bySubmissionId = {}
        scoreRows.forEach((row) => {
          if (!bySubmissionId[row.submission_id]) bySubmissionId[row.submission_id] = []
          bySubmissionId[row.submission_id].push(Number(row.score || 0))
        })

        const grouped360 = {}
        ;(review360Res.data || []).forEach((row) => {
          if (!grouped360[row.evaluatee_id]) {
            grouped360[row.evaluatee_id] = {
              evaluatee_id: row.evaluatee_id,
              scores: [],
              submissions: 0,
              group_type: row.group_type,
              latest_update: row.updated_at,
              evaluatee: row.evaluatee,
            }
          }
          grouped360[row.evaluatee_id].scores.push(...(bySubmissionId[row.id] || []))
          grouped360[row.evaluatee_id].submissions += 1
          grouped360[row.evaluatee_id].latest_update =
            grouped360[row.evaluatee_id].latest_update > row.updated_at
              ? grouped360[row.evaluatee_id].latest_update
              : row.updated_at
        })

        setReview360Rows(
          Object.values(grouped360)
            .map((row) => ({
              ...row,
              average: row.scores.length ? row.scores.reduce((sum, score) => sum + score, 0) / row.scores.length : 0,
            }))
            .sort((a, b) => b.average - a.average)
            .slice(0, 8)
        )
        setLoading(false)
      } catch (err) {
        setStoreStats({ total: 0, average: 0, topStore: null })
        setPersonalRows([])
        setReview360Rows([])
        setError(err.message || 'Gagal memuat KPI.')
        setLoading(false)
      }
    }

    load()
  }, [period, profile?.id])

  const personalSummary = useMemo(() => {
    const average = personalRows.length
      ? personalRows.reduce((sum, row) => sum + row.average, 0) / personalRows.length
      : 0
    return {
      total: personalRows.length,
      average,
      verified: personalRows.filter((row) => row.verified).length,
    }
  }, [personalRows])

  const review360Summary = useMemo(() => {
    const average = review360Rows.length
      ? review360Rows.reduce((sum, row) => sum + row.average, 0) / review360Rows.length
      : 0
    return {
      total: review360Rows.length,
      average,
      submissions: review360Rows.reduce((sum, row) => sum + row.submissions, 0),
    }
  }, [review360Rows])

  const descriptionByTab = {
    store: 'Halaman KPI sekarang jadi hub utama untuk KPI Toko, KPI Personal, dan KPI 360 dengan bahasa visual yang konsisten dengan dashboard.',
    personal: 'Hasil KPI Personal dibedakan dari KPI Toko supaya pembacaan skor, verifikasi, dan progres per orang lebih jelas.',
    review360: 'Hasil KPI 360 sekarang ikut tampil dari menu KPI agar penilaian rekan kerja tidak lagi tersembunyi di halaman input.',
  }

  const canInputPersonal = KPI_PERSONAL_INPUT_ROLES.includes(profile?.role)
  const canInput360 = KPI_360_ROLES.includes(profile?.role)

  return (
    <SubpageShell
      title="KPI"
      subtitle={`Periode ${periodLabel(period)}`}
      eyebrow="Performance Hub"
      footer={<SmartBottomNav />}
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <HeroCard
          eyebrow="KPI Overview"
          title="KPI Toko, Personal, dan 360"
          description={descriptionByTab[tab]}
          meta={
            <>
              <ToneBadge tone="info">{roleLabel(profile?.role)}</ToneBadge>
              <ToneBadge tone="slate">{periodLabel(period)}</ToneBadge>
            </>
          }
          actions={
            <SegmentedControl options={TAB_OPTIONS} value={tab} onChange={setTab} />
          }
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <InlineStat label="KPI Toko" value={storeStats.total} tone="primary" />
            <InlineStat label="KPI Personal" value={personalSummary.total} tone="emerald" />
            <InlineStat label="KPI 360" value={review360Summary.total} tone="amber" />
          </div>
        </HeroCard>

        <SectionPanel
          eyebrow="Filter"
          title="Periode KPI"
          description="Semua ringkasan di bawah mengikuti periode yang sama agar perbandingan KPI Toko, Personal, dan 360 tetap sinkron."
        >
          <div className="grid gap-3 md:grid-cols-[240px_1fr]">
            <div>
              <label className="label">Periode</label>
              <select className="input" value={period} onChange={(event) => setPeriod(event.target.value)}>
                {lastNPeriods(6).map((value) => (
                  <option key={value} value={value}>{periodLabel(value)}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[20px] bg-slate-50 px-4 py-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Avg KPI Toko</div>
                <div className="mt-2 text-2xl font-semibold text-slate-950">{formatPercent(storeStats.average)}</div>
              </div>
              <div className="rounded-[20px] bg-slate-50 px-4 py-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Avg Personal</div>
                <div className="mt-2 text-2xl font-semibold text-slate-950">{personalSummary.average ? personalSummary.average.toFixed(2) : '-'}</div>
              </div>
              <div className="rounded-[20px] bg-slate-50 px-4 py-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Avg 360</div>
                <div className="mt-2 text-2xl font-semibold text-slate-950">{review360Summary.average ? review360Summary.average.toFixed(2) : '-'}</div>
              </div>
            </div>
          </div>
        </SectionPanel>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-9 w-9 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
          </div>
        ) : error ? (
          <EmptyPanel title="Halaman KPI belum bisa dimuat" description={error} />
        ) : (
          <>
            {tab === 'store' && (
              <SectionPanel
                eyebrow="KPI Toko"
                title="Ringkasan KPI Toko"
                description="Analisis detail KPI Toko tetap tersedia, tetapi sekarang dibuka dari hub KPI yang sama."
              >
                <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <InlineStat label="Toko Terbaca" value={storeStats.total} tone="primary" />
                    <InlineStat label="Rata-rata" value={formatPercent(storeStats.average)} tone="emerald" />
                    <InlineStat
                      label="Top Store"
                      value={storeStats.topStore?.branch?.name?.replace('Bagi Kopi ', '') || '-'}
                      tone="amber"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <ActionCard
                      title="Buka Analisis KPI Toko"
                      description="Masuk ke detail ranking toko, item KPI, dan tren performa."
                      icon="chart"
                      to="/kpi/store"
                    />
                    {canInputPersonal && (
                      <ActionCard
                        title="Input KPI Personal"
                        description="Penilaian target KPI bulanan sesuai role penilai."
                        icon="checklist"
                        to="/kpi/personal/input"
                        accent="emerald"
                      />
                    )}
                  </div>
                </div>
              </SectionPanel>
            )}

            {tab === 'personal' && (
              <SectionPanel
                eyebrow="KPI Personal"
                title="Hasil KPI Personal"
                description="Skor di bawah ini dibedakan dari KPI Toko agar penilaian individu lebih mudah direview."
              >
                {personalRows.length === 0 ? (
                  <EmptyPanel title="Belum ada hasil KPI Personal" description="Skor personal untuk periode ini belum tersedia." />
                ) : (
                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <InlineStat label="Orang Dinilai" value={personalSummary.total} tone="primary" />
                      <InlineStat label="Terverifikasi" value={personalSummary.verified} tone="emerald" />
                      <InlineStat label="Rata-rata" value={personalSummary.average.toFixed(2)} tone="amber" />
                    </div>
                    <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                      <div className="grid gap-4 xl:grid-cols-2">
                        {personalRows.map((row) => (
                          <article
                            key={row.staff_id}
                            className="rounded-[24px] border border-white/80 bg-white p-5 shadow-[0_22px_60px_-38px_rgba(15,23,42,0.26)]"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">KPI Personal</div>
                                <div className="mt-1 text-lg font-semibold text-slate-950">{row.staff?.full_name || 'Tanpa nama'}</div>
                                <div className="mt-1 text-sm text-slate-500">{roleLabel(row.staff?.role)}</div>
                              </div>
                              <ToneBadge tone={scoreTone(row.average)}>{row.average.toFixed(2)} / 5</ToneBadge>
                            </div>
                            <div className="mt-4 flex flex-wrap gap-2">
                              {row.verified ? <ToneBadge tone="ok">Terverifikasi</ToneBadge> : <ToneBadge tone="warn">Belum verifikasi</ToneBadge>}
                              <ToneBadge tone="slate">
                                {row.latest_update
                                  ? new Date(row.latest_update).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                                  : '-'}
                              </ToneBadge>
                            </div>
                          </article>
                        ))}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                        <ActionCard
                          title="Buka Hasil KPI Personal"
                          description="Lihat scorecard personal lengkap beserta verifikasi dan catatan penilai."
                          icon="chart"
                          to="/kpi/personal"
                          accent="emerald"
                        />
                        {canInputPersonal && (
                          <ActionCard
                            title="Input KPI Personal"
                            description="Masuk ke form penilaian KPI Personal untuk role yang kamu tangani."
                            icon="checklist"
                            to="/kpi/personal/input"
                            accent="amber"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </SectionPanel>
            )}

            {tab === 'review360' && (
              <SectionPanel
                eyebrow="KPI 360"
                title="Hasil KPI 360"
                description="Rekap 360 kini muncul di halaman KPI dan punya halaman hasil sendiri terpisah dari form input."
              >
                {review360Rows.length === 0 ? (
                  <EmptyPanel title="Belum ada hasil KPI 360" description="Penilaian 360 untuk periode ini belum tersedia." />
                ) : (
                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <InlineStat label="Orang Dinilai" value={review360Summary.total} tone="primary" />
                      <InlineStat label="Submission" value={review360Summary.submissions} tone="amber" />
                      <InlineStat label="Rata-rata" value={review360Summary.average.toFixed(2)} tone="emerald" />
                    </div>
                    <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                      <div className="grid gap-4 xl:grid-cols-2">
                        {review360Rows.map((row) => (
                          <article
                            key={row.evaluatee_id}
                            className="rounded-[24px] border border-white/80 bg-white p-5 shadow-[0_22px_60px_-38px_rgba(15,23,42,0.26)]"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                                  {row.group_type === 'manager' ? 'Grup Manager' : 'Grup Toko'}
                                </div>
                                <div className="mt-1 text-lg font-semibold text-slate-950">{row.evaluatee?.full_name || 'Tanpa nama'}</div>
                                <div className="mt-1 text-sm text-slate-500">{roleLabel(row.evaluatee?.role)}</div>
                              </div>
                              <ToneBadge tone={scoreTone(row.average)}>{row.average.toFixed(2)} / 5</ToneBadge>
                            </div>
                            <div className="mt-4 flex flex-wrap gap-2">
                              <ToneBadge tone="info">{row.submissions} submission</ToneBadge>
                              <ToneBadge tone="slate">
                                {row.latest_update
                                  ? new Date(row.latest_update).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                                  : '-'}
                              </ToneBadge>
                            </div>
                          </article>
                        ))}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                        <ActionCard
                          title="Buka Hasil KPI 360"
                          description="Lihat rekap 360 lengkap yang terpisah dari KPI Toko."
                          icon="spark"
                          to="/kpi/360/results"
                          accent="amber"
                        />
                        {canInput360 && (
                          <ActionCard
                            title="Input Penilaian 360"
                            description="Masuk ke form penilaian 360 untuk rekan kerja di periode aktif."
                            icon="checklist"
                            to="/kpi/360"
                            accent="violet"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </SectionPanel>
            )}
          </>
        )}
      </div>
    </SubpageShell>
  )
}
