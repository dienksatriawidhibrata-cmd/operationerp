import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { fmtRp, fmtDateShort } from '../../lib/utils'
import PhotoViewer from '../../components/PhotoViewer'
import Alert from '../../components/Alert'
import { DMBottomNav, OpsBottomNav } from '../../components/BottomNav'
import {
  AppIcon,
  EmptyPanel,
  InlineStat,
  SectionPanel,
  SegmentedControl,
  SubpageShell,
  ToneBadge,
} from '../../components/ui/AppKit'

const TABS = [
  { key: 'submitted', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
]

export default function ApprovalSetoran() {
  const { profile } = useAuth()
  const [tab, setTab] = useState('submitted')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [rejReason, setRejReason] = useState('')
  const [actioning, setActioning] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    fetchSetoran()
  }, [tab, profile])

  const fetchSetoran = async () => {
    setLoading(true)
    let query = supabase
      .from('daily_deposits')
      .select('*, branch:branches!inner(name,store_id,district,area)')
      .eq('status', tab)
      .order('submitted_at', { ascending: false })

    if (profile?.role === 'district_manager') {
      query = query.in('branch.district', profile.managed_districts || [])
    } else if (profile?.role === 'area_manager') {
      query = query.in('branch.area', profile.managed_areas || [])
    }

    const { data, error: fetchErr } = await query
    if (fetchErr) {
      setMsg({ type: 'error', text: 'Gagal memuat data: ' + fetchErr.message })
    } else {
      setItems(data || [])
    }
    setLoading(false)
  }

  const approve = async (item) => {
    setActioning(true)
    const { error } = await supabase
      .from('daily_deposits')
      .update({
        status: 'approved',
        approved_by: profile.id,
        approved_at: new Date().toISOString(),
        rejection_reason: null,
      })
      .eq('id', item.id)

    if (error) {
      setMsg({ type: 'error', text: 'Gagal: ' + error.message })
    } else {
      setMsg({ type: 'ok', text: 'Setoran berhasil di-approve.' })
      setSelected(null)
      fetchSetoran()
    }
    setActioning(false)
  }

  const reject = async (item) => {
    if (!rejReason.trim()) {
      setMsg({ type: 'error', text: 'Alasan penolakan wajib diisi.' })
      return
    }

    setActioning(true)
    const { error } = await supabase
      .from('daily_deposits')
      .update({
        status: 'rejected',
        rejection_reason: rejReason,
        approved_by: profile.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', item.id)

    if (error) {
      setMsg({ type: 'error', text: 'Gagal: ' + error.message })
    } else {
      setMsg({ type: 'ok', text: 'Setoran berhasil di-reject.' })
      setSelected(null)
      setRejReason('')
      fetchSetoran()
    }
    setActioning(false)
  }

  const totalSelisih = useMemo(
    () => items.reduce((sum, item) => sum + Math.abs(Number(item.selisih || 0)), 0),
    [items]
  )

  const summaryStats = [
    { label: 'Total Item', value: items.length, tone: 'primary' },
    {
      label: 'Ada Selisih',
      value: items.filter((item) => Number(item.selisih || 0) !== 0).length,
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
      title="Approval Setoran"
      subtitle={
        profile?.role === 'district_manager'
          ? `District ${profile?.managed_districts?.join(', ') || '-'}`
          : profile?.role === 'area_manager'
            ? `Area ${profile?.managed_areas?.join(', ') || '-'}`
            : 'Monitoring setoran harian'
      }
      eyebrow="Approval Flow"
      showBack={false}
      footer={profile?.role === 'ops_manager' ? <OpsBottomNav /> : <DMBottomNav />}
    >
      <SectionPanel
        eyebrow="Filter Status"
        title="Antrian Approval"
        description="Pilih status setoran yang ingin kamu review lalu buka detail kartunya di bawah."
        actions={
          <SegmentedControl
            options={TABS}
            value={tab}
            onChange={(nextTab) => {
              setTab(nextTab)
              setSelected(null)
              setRejReason('')
            }}
          />
        }
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {summaryStats.map((item) => (
            <InlineStat key={item.label} label={item.label} value={item.value} tone={item.tone} />
          ))}
        </div>
      </SectionPanel>

      <div className="mt-6 space-y-6">
        {msg && <Alert variant={msg.type === 'ok' ? 'ok' : 'error'}>{msg.text}</Alert>}

        <SectionPanel
          eyebrow="Review List"
          title={`Setoran ${TABS.find((item) => item.key === tab)?.label || tab}`}
          description="Buka satu kartu untuk melihat nominal, foto bukti, dan memberi keputusan."
          actions={
            <ToneBadge tone={tab === 'submitted' ? 'warn' : tab === 'approved' ? 'ok' : 'danger'}>
              {items.length} item
            </ToneBadge>
          }
        >
          {loading ? (
            <div className="flex justify-center py-14">
              <div className="h-9 w-9 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
            </div>
          ) : items.length === 0 ? (
            <EmptyPanel
              title={`Tidak ada setoran ${TABS.find((item) => item.key === tab)?.label?.toLowerCase() || tab}`}
              description="Begitu ada setoran baru yang sesuai status ini, kartunya akan muncul di sini."
            />
          ) : (
            <div className="space-y-4">
              {items.map((item) => (
                <SetoranCard
                  key={item.id}
                  item={item}
                  expanded={selected?.id === item.id}
                  onToggle={() => {
                    setSelected(selected?.id === item.id ? null : item)
                    setRejReason('')
                  }}
                  onApprove={() => approve(item)}
                  onReject={() => reject(item)}
                  rejReason={rejReason}
                  onRejReasonChange={setRejReason}
                  actioning={actioning}
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

function SetoranCard({ item, expanded, onToggle, onApprove, onReject, rejReason, onRejReasonChange, actioning, tab }) {
  const selisih = Number(item.selisih || 0)
  const hasSelisih = selisih !== 0

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
            {fmtDateShort(item.tanggal)} / {item.branch?.district || '-'} / {item.branch?.area || '-'}
          </div>
          <div className="mt-1 text-sm text-slate-500">
            {fmtRp(item.cash_disetorkan)}
            {hasSelisih && <span className="ml-2 font-semibold text-rose-600">Selisih {fmtRp(Math.abs(selisih))}</span>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <ToneBadge tone={item.status === 'approved' ? 'ok' : item.status === 'rejected' ? 'danger' : 'warn'}>
            {item.status === 'submitted' ? 'Pending' : item.status === 'approved' ? 'Approved' : 'Rejected'}
          </ToneBadge>
          <AppIcon name={expanded ? 'chevronDown' : 'chevronRight'} size={18} className="text-slate-400" />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 px-4 py-4 sm:px-5 sm:py-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoMetric label="Cash POS" value={fmtRp(item.cash_pos)} />
            <InfoMetric label="Cash Disetorkan" value={fmtRp(item.cash_disetorkan)} />
          </div>

          {hasSelisih && (
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
            {item.rejection_reason && (
              <div className="mt-2 text-rose-600">Alasan reject: {item.rejection_reason}</div>
            )}
          </div>

          {tab === 'submitted' && (
            <div className="mt-4 space-y-4">
              <div>
                <label className="label">Alasan Penolakan</label>
                <input
                  className="input"
                  type="text"
                  value={rejReason}
                  onChange={(event) => onRejReasonChange(event.target.value)}
                  placeholder="Isi alasan jika setoran akan direject..."
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  onClick={onReject}
                  disabled={actioning}
                  className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 transition-transform active:scale-[0.99] disabled:opacity-60"
                >
                  {actioning ? 'Memproses...' : 'Reject'}
                </button>
                <button
                  onClick={onApprove}
                  disabled={actioning}
                  className="rounded-2xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white transition-transform active:scale-[0.99] disabled:opacity-60"
                >
                  {actioning ? 'Memproses...' : 'Approve'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  )
}

function InfoMetric({ label, value }) {
  return (
    <div className="rounded-[20px] bg-slate-50 px-3.5 py-3.5">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</div>
      <div className="mt-1.5 text-lg font-semibold text-slate-950 sm:text-xl">{value}</div>
    </div>
  )
}
