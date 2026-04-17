import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { downloadCsv, fmtDateShort, fmtRp, roleLabel, todayWIB } from '../../lib/utils'
import PhotoViewer from '../../components/PhotoViewer'
import Alert from '../../components/Alert'
import { FinanceBottomNav } from '../../components/BottomNav'
import {
  AppIcon,
  EmptyPanel,
  InlineStat,
  SectionPanel,
  SegmentedControl,
  SubpageShell,
  SoftButton,
  ToneBadge,
} from '../../components/ui/AppKit'

const TABS = [
  { key: 'pending', label: 'Belum Diaudit' },
  { key: 'audited', label: 'Sudah Audit' },
  { key: 'flagged', label: 'Flagged' },
]

const PERIODS = [
  { key: 'day', label: 'Harian' },
  { key: 'week', label: 'Mingguan' },
  { key: 'month', label: 'Bulanan' },
]

const STATUS_FILTERS = [
  { key: 'all', label: 'Semua' },
  { key: 'selisih', label: 'Ada Selisih' },
]

export default function AuditSetoran() {
  const { profile, signOut } = useAuth()
  const [tab, setTab] = useState('pending')
  const [period, setPeriod] = useState('day')
  const [anchorDate, setAnchorDate] = useState(todayWIB())
  const [items, setItems] = useState([])
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [notesById, setNotesById] = useState({})
  const [actioningId, setActioningId] = useState(null)
  const [msg, setMsg] = useState(null)
  const [filter, setFilter] = useState('all')
  const [areaFilter, setAreaFilter] = useState('all')
  const [districtFilter, setDistrictFilter] = useState('all')
  const [branchFilter, setBranchFilter] = useState('all')

  useEffect(() => {
    fetchBranches()
  }, [profile?.id])

  useEffect(() => {
    fetchSetoran()
  }, [tab, period, anchorDate])

  const fetchBranches = async () => {
    const { data } = await supabase
      .from('branches')
      .select('id,name,store_id,district,area')
      .eq('is_active', true)
      .order('name')

    setBranches(data || [])
  }

  const fetchSetoran = async () => {
    setLoading(true)
    const range = getDateRange(period, anchorDate)
    const { data, error: fetchErr } = await supabase
      .from('daily_deposits')
      .select('*, branch:branches(id,name,store_id,district,area)')
      .eq('finance_status', tab)
      .eq('status', 'approved')
      .gte('tanggal', range.start)
      .lte('tanggal', range.end)
      .order('tanggal', { ascending: false })
      .order('submitted_at', { ascending: false })

    if (fetchErr) {
      setMsg({ type: 'error', text: 'Gagal memuat data: ' + fetchErr.message })
    } else {
      setItems(data || [])
    }
    setLoading(false)
  }

  const areaOptions = useMemo(
    () => Array.from(new Set(branches.map((branch) => branch.area).filter(Boolean))).sort(),
    [branches]
  )

  const districtOptions = useMemo(() => {
    return Array.from(
      new Set(
        branches
          .filter((branch) => areaFilter === 'all' || branch.area === areaFilter)
          .map((branch) => branch.district)
          .filter(Boolean)
      )
    ).sort()
  }, [branches, areaFilter])

  const branchOptions = useMemo(() => {
    return branches.filter((branch) => {
      if (areaFilter !== 'all' && branch.area !== areaFilter) return false
      if (districtFilter !== 'all' && branch.district !== districtFilter) return false
      return true
    })
  }, [branches, areaFilter, districtFilter])

  useEffect(() => {
    if (districtFilter !== 'all' && !districtOptions.includes(districtFilter)) {
      setDistrictFilter('all')
    }
  }, [districtFilter, districtOptions])

  useEffect(() => {
    if (branchFilter !== 'all' && !branchOptions.some((branch) => branch.id === branchFilter)) {
      setBranchFilter('all')
    }
  }, [branchFilter, branchOptions])

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (filter === 'selisih' && Number(item.selisih) === 0) return false
      if (areaFilter !== 'all' && item.branch?.area !== areaFilter) return false
      if (districtFilter !== 'all' && item.branch?.district !== districtFilter) return false
      if (branchFilter !== 'all' && item.branch_id !== branchFilter) return false
      return true
    })
  }, [items, filter, areaFilter, districtFilter, branchFilter])

  const totalSelisih = filtered.reduce((sum, item) => sum + Math.abs(Number(item.selisih || 0)), 0)
  const selectedRange = getDateRange(period, anchorDate)

  const markAudited = async (item, flagged = false) => {
    setActioningId(item.id)
    const { error } = await supabase
      .from('daily_deposits')
      .update({
        finance_status: flagged ? 'flagged' : 'audited',
        finance_audited_by: profile.id,
        finance_audited_at: new Date().toISOString(),
        finance_notes: notesById[item.id] || null,
      })
      .eq('id', item.id)

    if (error) {
      setMsg({ type: 'error', text: 'Gagal: ' + error.message })
    } else {
      setMsg({
        type: 'ok',
        text: flagged ? 'Setoran diflag untuk review lebih lanjut.' : 'Setoran selesai diaudit.',
      })
      setSelectedId(null)
      setNotesById((current) => ({ ...current, [item.id]: '' }))
      fetchSetoran()
    }
    setActioningId(null)
  }

  const financeTitle = profile?.role === 'ops_manager'
    ? 'Finance Audit - Ops Manager'
    : roleLabel(profile?.role || 'finance_supervisor')

  const handleDownload = () => {
    const range = getDateRange(period, anchorDate)
    const filename = `setoran_${range.start}_${range.end}.csv`
    const headers = [
      'Tanggal', 'Toko', 'District', 'Area',
      'Cash POS', 'Cash Disetorkan', 'Selisih',
      'Alasan Selisih', 'Status DM', 'Status Finance',
      'Submitted At', 'DM Action At', 'Catatan Finance',
    ]
    const rows = filtered.map((item) => [
      item.tanggal,
      item.branch?.name || '',
      item.branch?.district || '',
      item.branch?.area || '',
      item.cash_pos,
      item.cash_disetorkan,
      item.selisih,
      item.alasan_selisih || '',
      item.status,
      item.finance_status,
      item.submitted_at ? new Date(item.submitted_at).toLocaleString('id-ID') : '',
      item.approved_at ? new Date(item.approved_at).toLocaleString('id-ID') : '',
      item.finance_notes || '',
    ])
    downloadCsv(filename, headers, rows)
  }

  const summaryStats = [
    { label: 'Total', value: filtered.length, tone: 'primary' },
    {
      label: 'Ada Selisih',
      value: filtered.filter((item) => Number(item.selisih || 0) !== 0).length,
      tone: 'rose',
    },
    {
      label: 'Total Selisih',
      value: fmtRp(totalSelisih),
      tone: totalSelisih > 0 ? 'amber' : 'slate',
    },
  ]

  return (
    <SubpageShell
      title="Audit Setoran"
      subtitle={selectedRange.label}
      eyebrow={financeTitle}
      showBack={false}
      action={
        <button
          onClick={signOut}
          className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-[0_18px_45px_-34px_rgba(15,23,42,0.35)] transition-colors hover:border-primary-200 hover:text-primary-700"
          aria-label="Keluar"
        >
          <AppIcon name="logout" size={18} />
        </button>
      }
      footer={<FinanceBottomNav />}
    >
      <SectionPanel
        eyebrow="Audit Mode"
        title="Filter Audit Finance"
        description="Rapikan antrian audit berdasarkan periode, wilayah, dan status agar tidak menumpuk."
        actions={
          <SegmentedControl
            options={TABS}
            value={tab}
            onChange={(nextTab) => {
              setTab(nextTab)
              setSelectedId(null)
            }}
          />
        }
      >
        <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
          <div className="grid gap-3 sm:grid-cols-3">
            {summaryStats.map((item) => (
              <InlineStat key={item.label} label={item.label} value={item.value} tone={item.tone} />
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Tanggal Acuan</label>
              <input
                className="input"
                type="date"
                value={anchorDate}
                onChange={(event) => setAnchorDate(event.target.value)}
              />
            </div>
            <div>
              <label className="label">Periode</label>
              <SegmentedControl options={PERIODS} value={period} onChange={setPeriod} className="w-full" />
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-4">
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
          <div>
            <label className="label">Toko</label>
            <select className="input" value={branchFilter} onChange={(event) => setBranchFilter(event.target.value)}>
              <option value="all">Semua toko</option>
              {branchOptions.map((branch) => (
                <option key={branch.id} value={branch.id}>{branch.name.replace('Bagi Kopi ', '')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Status DM</label>
            <select className="input" value={filter} onChange={(event) => setFilter(event.target.value)}>
              {STATUS_FILTERS.map((statusFilter) => (
                <option key={statusFilter.key} value={statusFilter.key}>{statusFilter.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-5">
          <SoftButton tone="white" icon="chevronRight" onClick={handleDownload}>
            Download CSV ({filtered.length} baris)
          </SoftButton>
        </div>
      </SectionPanel>

      <div className="mt-6 space-y-6">
        {msg && <Alert variant={msg.type === 'ok' ? 'ok' : 'error'}>{msg.text}</Alert>}

        <SectionPanel
          eyebrow="Review Queue"
          title={`Daftar ${TABS.find((item) => item.key === tab)?.label || tab}`}
          description="Buka detail setoran untuk melihat bukti foto, selisih, dan memberi keputusan audit finance."
          actions={
            <ToneBadge tone={tab === 'pending' ? 'warn' : tab === 'audited' ? 'ok' : 'danger'}>
              {filtered.length} item
            </ToneBadge>
          }
        >
          {loading ? (
            <div className="flex justify-center py-14">
              <div className="h-9 w-9 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyPanel
              title="Tidak ada setoran pada filter ini"
              description="Coba ubah periode atau filter wilayah. Daftar audit akan muncul otomatis saat ada data yang cocok."
            />
          ) : (
            <div className="space-y-4">
              {filtered.map((item) => (
                <FinanceCard
                  key={item.id}
                  item={item}
                  expanded={selectedId === item.id}
                  onToggle={() => setSelectedId(selectedId === item.id ? null : item.id)}
                  onAudit={() => markAudited(item, false)}
                  onFlag={() => markAudited(item, true)}
                  notes={notesById[item.id] || ''}
                  onNotesChange={(value) => setNotesById((current) => ({ ...current, [item.id]: value }))}
                  actioning={actioningId === item.id}
                  tab={tab}
                />
              ))}
            </div>
          )}
        </SectionPanel>
      </div>
    </SubpageShell>
  )
}

function FinanceCard({ item, expanded, onToggle, onAudit, onFlag, notes, onNotesChange, actioning, tab }) {
  const selisih = Number(item.selisih || 0)

  return (
    <article className="rounded-[24px] border border-white/85 bg-white shadow-[0_20px_55px_-40px_rgba(15,23,42,0.35)]">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-slate-50/70 sm:px-5 sm:py-5"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-50 text-primary-700 sm:h-12 sm:w-12">
          <span className="text-sm font-bold">{item.branch?.store_id?.split('-')[1] || '--'}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold text-slate-950 sm:text-base">
            {item.branch?.name?.replace('Bagi Kopi ', '') || '-'}
          </div>
          <div className="mt-1 text-sm text-slate-500">
            {item.branch?.district || '-'} / {item.branch?.area || '-'}
          </div>
          <div className="mt-1 text-sm text-slate-500">
            {fmtDateShort(item.tanggal)} / {fmtRp(item.cash_disetorkan)}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <ToneBadge tone={Number(item.selisih || 0) !== 0 ? 'danger' : 'ok'}>
            {Number(item.selisih || 0) !== 0 ? 'Ada Selisih' : 'Sesuai'}
          </ToneBadge>
          <AppIcon name={expanded ? 'chevronDown' : 'chevronRight'} size={18} className="text-slate-400" />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 px-4 py-4 sm:px-5 sm:py-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <FinanceMetric label="Cash POS" value={fmtRp(item.cash_pos)} />
            <FinanceMetric label="Disetorkan" value={fmtRp(item.cash_disetorkan)} />
          </div>

          {selisih !== 0 && (
            <div className="mt-4 rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-500">Selisih Cash</div>
              <div className="mt-2 text-2xl font-semibold text-rose-700">{fmtRp(Math.abs(selisih))}</div>
              {item.alasan_selisih && (
                <div className="mt-2 text-sm leading-6 text-rose-700">{item.alasan_selisih}</div>
              )}
            </div>
          )}

          <div className="mt-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Foto Bukti Setoran</div>
            <div className="mt-3">
              <PhotoViewer urls={item.foto_bukti || []} emptyText="Tidak ada foto bukti" />
            </div>
          </div>

          <div className="mt-4 rounded-[22px] bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-500">
            <div>Submit: {item.submitted_at ? new Date(item.submitted_at).toLocaleString('id-ID') : '-'}</div>
            {item.approved_at && item.status === 'approved' && (
              <div>Approved by DM: {new Date(item.approved_at).toLocaleString('id-ID')}</div>
            )}
            {item.approved_at && item.status === 'rejected' && (
              <div>Rejected by DM: {new Date(item.approved_at).toLocaleString('id-ID')}</div>
            )}
            {item.finance_notes && (
              <div className="mt-2 text-primary-700">Catatan audit: {item.finance_notes}</div>
            )}
          </div>

          {tab === 'pending' && (
            <div className="mt-4 space-y-4">
              <div>
                <label className="label">Catatan Audit Finance</label>
                <input
                  className="input"
                  type="text"
                  value={notes}
                  onChange={(event) => onNotesChange(event.target.value)}
                  placeholder="Tambahkan catatan audit bila perlu..."
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  onClick={onFlag}
                  disabled={actioning}
                  className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 transition-transform active:scale-[0.99] disabled:opacity-60"
                >
                  {actioning ? 'Memproses...' : 'Flag'}
                </button>
                <button
                  onClick={onAudit}
                  disabled={actioning}
                  className="rounded-2xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white transition-transform active:scale-[0.99] disabled:opacity-60"
                >
                  {actioning ? 'Memproses...' : 'Selesai Diaudit'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  )
}

function FinanceMetric({ label, value }) {
  return (
    <div className="rounded-[20px] bg-slate-50 px-3.5 py-3.5">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</div>
      <div className="mt-1.5 text-lg font-semibold text-slate-950 sm:text-xl">{value}</div>
    </div>
  )
}

function getDateRange(period, anchorDate) {
  const [year, month, day] = anchorDate.split('-').map(Number)
  const base = new Date(Date.UTC(year, month - 1, day))

  if (period === 'day') {
    return {
      start: anchorDate,
      end: anchorDate,
      label: `Harian - ${formatRangeDate(anchorDate, { day: 'numeric', month: 'long', year: 'numeric' })}`,
    }
  }

  if (period === 'month') {
    const start = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = new Date(Date.UTC(year, month, 0))
    const end = `${year}-${String(month).padStart(2, '0')}-${String(endDate.getUTCDate()).padStart(2, '0')}`
    return {
      start,
      end,
      label: `Bulanan - ${formatRangeDate(start, { month: 'long', year: 'numeric' })}`,
    }
  }

  const weekDay = base.getUTCDay()
  const diff = weekDay === 0 ? 6 : weekDay - 1
  base.setUTCDate(base.getUTCDate() - diff)
  const end = new Date(base)
  end.setUTCDate(base.getUTCDate() + 6)
  const startIso = base.toISOString().split('T')[0]
  const endIso = end.toISOString().split('T')[0]

  return {
    start: startIso,
    end: endIso,
    label: `Mingguan - ${formatRangeDate(startIso, { day: 'numeric', month: 'short' })} - ${formatRangeDate(endIso, { day: 'numeric', month: 'short', year: 'numeric' })}`,
  }
}

function formatRangeDate(date, options) {
  return new Date(date).toLocaleDateString('id-ID', options)
}
