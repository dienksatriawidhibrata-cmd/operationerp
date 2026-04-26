import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { roleLabel, todayWIB, yesterdayWIB } from '../../lib/utils'
import { SmartBottomNav } from '../../components/BottomNav'
import {
  AppIcon,
  EmptyPanel,
  HeroCard,
  InlineStat,
  SectionPanel,
  SubpageShell,
  ToneBadge,
} from '../../components/ui/AppKit'

function formatDateLabel(value) {
  if (!value) return '-'
  return new Date(`${value}T00:00:00Z`).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function formatDateTimeLabel(value) {
  if (!value) return '-'
  return new Date(value).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  })
}

function statusTone(current) {
  return current ? 'ok' : 'warn'
}

function monthStart(isoDate) {
  const [year, month] = String(isoDate || '').split('-')
  if (!year || !month) return todayWIB()
  return `${year}-${month}-01`
}

function MissingListCard({ title, tone, rows, emptyText, getDetailHref }) {
  return (
    <SectionPanel
      eyebrow="Perlu Follow Up"
      title={title}
      description="Menampilkan toko yang belum mengisi pada tanggal acuan, lengkap dengan tanggal input terakhir yang ditemukan."
    >
      {rows.length === 0 ? (
        <div className={`rounded-[20px] px-4 py-4 text-sm ${tone === 'amber' ? 'bg-amber-50 text-amber-700' : tone === 'rose' ? 'bg-rose-50 text-rose-700' : 'bg-slate-50 text-slate-600'}`}>
          {emptyText}
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <article key={row.id} className="rounded-[20px] border border-slate-100 bg-slate-50/80 px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-950">{row.branch.name.replace('Bagi Kopi ', '')}</div>
                  <div className="mt-1 text-xs text-slate-500">{row.branch.store_id} · {row.branch.district} · {row.branch.area}</div>
                </div>
                <ToneBadge tone={tone}>Belum masuk</ToneBadge>
              </div>
              <div className="mt-3 text-sm text-slate-600">{row.lastLabel}</div>
              {getDetailHref && (
                <div className="mt-3">
                  <Link
                    to={getDetailHref(row)}
                    className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-primary-200 hover:text-primary-700"
                  >
                    Lihat detail OPEX
                  </Link>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </SectionPanel>
  )
}

export default function FinanceHub({
  pageTitle = 'Finance',
  pageEyebrow,
  pageSubtitle,
  showAuditAction = true,
}) {
  const { profile, signOut } = useAuth()
  const [branches, setBranches] = useState([])
  const [records, setRecords] = useState({ deposits: [], expenses: [], reports: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [areaFilter, setAreaFilter] = useState('all')
  const [districtFilter, setDistrictFilter] = useState('all')

  const setoranDate = yesterdayWIB()
  const opexDate = todayWIB()
  const laporanDate = yesterdayWIB()

  useEffect(() => {
    const load = async () => {
      if (!profile?.role) return

      setLoading(true)
      setError('')

      let branchQuery = supabase.from('branches').select('id,name,store_id,district,area').eq('is_active', true)
      if (profile.role === 'district_manager') {
        branchQuery = branchQuery.in('district', profile.managed_districts || [])
      } else if (profile.role === 'area_manager') {
        branchQuery = branchQuery.in('area', profile.managed_areas || [])
      }

      const { data: branchRows, error: branchError } = await branchQuery.order('name')
      if (branchError) {
        setBranches([])
        setRecords({ deposits: [], expenses: [], reports: [] })
        setError(branchError.message || 'Gagal memuat daftar toko.')
        setLoading(false)
        return
      }

      const branchIds = (branchRows || []).map((branch) => branch.id)
      if (!branchIds.length) {
        setBranches([])
        setRecords({ deposits: [], expenses: [], reports: [] })
        setLoading(false)
        return
      }

      const [depositsRes, expensesRes, reportsRes] = await Promise.all([
        supabase
          .from('daily_deposits')
          .select('id,branch_id,tanggal,status,submitted_at')
          .in('branch_id', branchIds)
          .order('tanggal', { ascending: false }),
        supabase
          .from('operational_expenses')
          .select('id,branch_id,tanggal,created_at,total')
          .in('branch_id', branchIds)
          .order('tanggal', { ascending: false })
          .order('created_at', { ascending: false }),
        supabase
          .from('daily_reports')
          .select('id,branch_id,tanggal,submitted_at,is_late')
          .in('branch_id', branchIds)
          .order('tanggal', { ascending: false }),
      ])

      if (depositsRes.error || expensesRes.error || reportsRes.error) {
        setBranches(branchRows || [])
        setRecords({ deposits: [], expenses: [], reports: [] })
        setError(
          depositsRes.error?.message ||
          expensesRes.error?.message ||
          reportsRes.error?.message ||
          'Gagal memuat data laporan harian.',
        )
        setLoading(false)
        return
      }

      setBranches(branchRows || [])
      setRecords({
        deposits: depositsRes.data || [],
        expenses: expensesRes.data || [],
        reports: reportsRes.data || [],
      })
      setLoading(false)
    }

    load()
  }, [profile?.id, profile?.managed_areas, profile?.managed_districts, profile?.role])

  const areaOptions = useMemo(
    () => Array.from(new Set(branches.map((branch) => branch.area).filter(Boolean))).sort(),
    [branches],
  )

  const districtOptions = useMemo(
    () => Array.from(
      new Set(
        branches
          .filter((branch) => areaFilter === 'all' || branch.area === areaFilter)
          .map((branch) => branch.district)
          .filter(Boolean),
      ),
    ).sort(),
    [areaFilter, branches],
  )

  useEffect(() => {
    if (districtFilter !== 'all' && !districtOptions.includes(districtFilter)) {
      setDistrictFilter('all')
    }
  }, [districtFilter, districtOptions])

  const visibleBranches = useMemo(() => {
    return branches.filter((branch) => {
      if (areaFilter !== 'all' && branch.area !== areaFilter) return false
      if (districtFilter !== 'all' && branch.district !== districtFilter) return false
      return true
    })
  }, [areaFilter, branches, districtFilter])

  const depositMaps = useMemo(() => {
    const latest = new Map()
    const current = new Map()
    records.deposits.forEach((row) => {
      if (!latest.has(row.branch_id)) latest.set(row.branch_id, row)
      if (row.tanggal === setoranDate && !current.has(row.branch_id)) current.set(row.branch_id, row)
    })
    return { latest, current }
  }, [records.deposits, setoranDate])

  const expenseMaps = useMemo(() => {
    const latest = new Map()
    const current = new Map()
    records.expenses.forEach((row) => {
      if (!latest.has(row.branch_id)) latest.set(row.branch_id, row)
      if (row.tanggal === opexDate && !current.has(row.branch_id)) current.set(row.branch_id, row)
    })
    return { latest, current }
  }, [records.expenses, opexDate])

  const reportMaps = useMemo(() => {
    const latest = new Map()
    const current = new Map()
    records.reports.forEach((row) => {
      if (!latest.has(row.branch_id)) latest.set(row.branch_id, row)
      if (row.tanggal === laporanDate && !current.has(row.branch_id)) current.set(row.branch_id, row)
    })
    return { latest, current }
  }, [laporanDate, records.reports])

  const summary = useMemo(() => {
    const total = visibleBranches.length
    const setoran = visibleBranches.filter((branch) => depositMaps.current.has(branch.id)).length
    const opex = visibleBranches.filter((branch) => expenseMaps.current.has(branch.id)).length
    const laporan = visibleBranches.filter((branch) => reportMaps.current.has(branch.id)).length
    return { total, setoran, opex, laporan }
  }, [depositMaps.current, expenseMaps.current, reportMaps.current, visibleBranches])

  const missingSetoran = useMemo(() => {
    return visibleBranches
      .filter((branch) => !depositMaps.current.has(branch.id))
      .map((branch) => {
        const latest = depositMaps.latest.get(branch.id)
        return {
          id: branch.id,
          branch,
          lastLabel: latest
            ? `Terakhir setoran ${formatDateLabel(latest.tanggal)}${latest.submitted_at ? ` · ${formatDateTimeLabel(latest.submitted_at)}` : ''}`
            : 'Belum ada riwayat setoran.',
        }
      })
  }, [depositMaps.current, depositMaps.latest, visibleBranches])

  const missingOpex = useMemo(() => {
    return visibleBranches
      .filter((branch) => !expenseMaps.current.has(branch.id))
      .map((branch) => {
        const latest = expenseMaps.latest.get(branch.id)
        return {
          id: branch.id,
          branch,
          lastLabel: latest
            ? `Terakhir isi opex ${formatDateLabel(latest.tanggal)}${latest.created_at ? ` · ${formatDateTimeLabel(latest.created_at)}` : ''}`
            : 'Belum ada riwayat opex.',
        }
      })
  }, [expenseMaps.current, expenseMaps.latest, visibleBranches])

  const missingLaporan = useMemo(() => {
    return visibleBranches
      .filter((branch) => !reportMaps.current.has(branch.id))
      .map((branch) => {
        const latest = reportMaps.latest.get(branch.id)
        return {
          id: branch.id,
          branch,
          lastLabel: latest
            ? `Terakhir isi laporan ${formatDateLabel(latest.tanggal)}${latest.submitted_at ? ` · ${formatDateTimeLabel(latest.submitted_at)}` : ''}`
            : 'Belum ada riwayat laporan harian.',
        }
      })
  }, [reportMaps.current, reportMaps.latest, visibleBranches])

  return (
    <SubpageShell
      title={pageTitle}
      subtitle={pageSubtitle || `${visibleBranches.length} toko dalam scope`}
      eyebrow={pageEyebrow || roleLabel(profile?.role || 'finance_supervisor')}
      showBack={false}
      footer={<SmartBottomNav />}
      action={
        <button
          onClick={signOut}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600"
          aria-label="Keluar"
        >
          <AppIcon name="logout" size={18} />
        </button>
      }
    >
      <HeroCard
        eyebrow="Laporan Harian"
        title="Ringkasan Kepatuhan Harian"
        description="Halaman ini dibuat ringkas agar kamu bisa langsung melihat status setoran, opex, dan laporan harian tanpa membaca terlalu banyak detail."
        meta={(
          <>
            <ToneBadge tone="info">Setoran {formatDateLabel(setoranDate)}</ToneBadge>
            <ToneBadge tone="info">Opex {formatDateLabel(opexDate)}</ToneBadge>
            <ToneBadge tone="info">Laporan {formatDateLabel(laporanDate)}</ToneBadge>
          </>
        )}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <InlineStat label="Setoran" value={`${summary.setoran}/${summary.total}`} tone={statusTone(summary.setoran === summary.total)} />
          <InlineStat label="Opex" value={`${summary.opex}/${summary.total}`} tone={statusTone(summary.opex === summary.total)} />
          <InlineStat label="Laporan Harian" value={`${summary.laporan}/${summary.total}`} tone={statusTone(summary.laporan === summary.total)} />
        </div>
      </HeroCard>

      <div className="mt-6 space-y-6">
        <SectionPanel
          eyebrow="Filter Wilayah"
          title="Scope Monitoring"
          description="Pilih area atau district untuk mempersempit daftar toko yang perlu di-follow up."
        >
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="label">Area</label>
              <select className="input" value={areaFilter} onChange={(event) => setAreaFilter(event.target.value)}>
                <option value="all">Semua area</option>
                {areaOptions.map((area) => (
                  <option key={area} value={area}>{area}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">District</label>
              <select className="input" value={districtFilter} onChange={(event) => setDistrictFilter(event.target.value)}>
                <option value="all">Semua district</option>
                {districtOptions.map((district) => (
                  <option key={district} value={district}>{district}</option>
                ))}
              </select>
            </div>
          </div>
        </SectionPanel>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-9 w-9 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
          </div>
        ) : error ? (
          <EmptyPanel title="Laporan Harian belum bisa dimuat" description={error} />
        ) : (
          <div className="grid gap-6 xl:grid-cols-3">
            <MissingListCard
              title="Toko Belum Setoran"
              tone="amber"
              rows={missingSetoran}
              emptyText="Semua toko pada scope ini sudah setoran."
            />
            <MissingListCard
              title="Toko Belum Isi Opex"
              tone="slate"
              rows={missingOpex}
              emptyText="Semua toko pada scope ini sudah mengisi opex."
              getDetailHref={(row) => `/opex?branch=${encodeURIComponent(row.branch.id)}&from=${monthStart(opexDate)}&to=${opexDate}&view=by_store`}
            />
            <MissingListCard
              title="Toko Belum Laporan Harian"
              tone="rose"
              rows={missingLaporan}
              emptyText="Semua toko pada scope ini sudah mengisi laporan harian."
            />
          </div>
        )}

        {showAuditAction && (
          <SectionPanel
            eyebrow="Audit Finance"
            title="Akses Audit Setoran"
            description="Halaman audit tetap tersedia terpisah untuk kebutuhan review finance."
          >
            <div className="flex justify-start">
              <Link
                to="/finance/audit"
                className="inline-flex items-center rounded-2xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
              >
                Buka Audit Setoran
              </Link>
            </div>
          </SectionPanel>
        )}
      </div>
    </SubpageShell>
  )
}
