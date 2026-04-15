import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { fmtRp, fmtDateShort } from '../../lib/utils'
import Header from '../../components/Header'
import PhotoViewer from '../../components/PhotoViewer'
import Alert from '../../components/Alert'
import { DMBottomNav } from '../../components/BottomNav'

const TABS = [
  { key: 'submitted', label: 'Pending' },
  { key: 'approved',  label: 'Approved' },
  { key: 'rejected',  label: 'Rejected' },
]

export default function ApprovalSetoran() {
  const { profile } = useAuth()
  const [tab, setTab]       = useState('submitted')
  const [items, setItems]   = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [rejReason, setRejReason] = useState('')
  const [actioning, setActioning] = useState(false)
  const [msg, setMsg]       = useState(null)

  useEffect(() => { fetchSetoran() }, [tab, profile])

  const fetchSetoran = async () => {
    setLoading(true)
    let q = supabase.from('daily_deposits')
      .select('*, branch:branches!inner(name,store_id,district,area)')
      .eq('status', tab)
      .order('submitted_at', { ascending: false })

    if (profile?.role === 'district_manager') {
      q = q.in('branch.district', profile.managed_districts || [])
    } else if (profile?.role === 'area_manager') {
      q = q.in('branch.area', profile.managed_areas || [])
    }

    const { data } = await q
    setItems(data || [])
    setLoading(false)
  }

  const approve = async (item) => {
    setActioning(true)
    const { error } = await supabase.from('daily_deposits').update({
      status: 'approved',
      approved_by: profile.id,
      approved_at: new Date().toISOString(),
      rejection_reason: null,
    }).eq('id', item.id)
    if (error) { setMsg({ type: 'error', text: 'Gagal: ' + error.message }) }
    else { setMsg({ type: 'ok', text: 'Setoran diapprove ✓' }); setSelected(null); fetchSetoran() }
    setActioning(false)
  }

  const reject = async (item) => {
    if (!rejReason.trim()) { setMsg({ type: 'error', text: 'Alasan penolakan wajib diisi.' }); return }
    setActioning(true)
    const { error } = await supabase.from('daily_deposits').update({
      status: 'rejected',
      rejection_reason: rejReason,
      approved_by: profile.id,
      approved_at: new Date().toISOString(),
    }).eq('id', item.id)
    if (error) { setMsg({ type: 'error', text: 'Gagal: ' + error.message }) }
    else { setMsg({ type: 'ok', text: 'Setoran direject.' }); setSelected(null); setRejReason(''); fetchSetoran() }
    setActioning(false)
  }

  return (
    <div className="page-shell">
      <Header title="Approval Setoran" sub={`${items.length} item · ${tab}`} />

      {/* Tabs */}
      <div className="flex bg-white border-b border-gray-100 px-4 gap-1 sticky top-[56px] z-10">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-colors ${
              tab === t.key ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-400'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto pb-24 px-4 pt-4 space-y-4">
        {msg && <Alert variant={msg.type === 'ok' ? 'ok' : 'error'}>{msg.text}</Alert>}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-4xl mb-3">✅</div>
            <p className="font-medium">Tidak ada setoran {tab === 'submitted' ? 'pending' : tab}</p>
          </div>
        ) : (
          items.map(item => (
            <SetoranCard
              key={item.id}
              item={item}
              expanded={selected?.id === item.id}
              onToggle={() => setSelected(selected?.id === item.id ? null : item)}
              onApprove={() => approve(item)}
              onReject={() => reject(item)}
              rejReason={rejReason}
              onRejReasonChange={setRejReason}
              actioning={actioning}
              tab={tab}
            />
          ))
        )}
      </div>

      <DMBottomNav />
    </div>
  )
}

function SetoranCard({ item, expanded, onToggle, onApprove, onReject, rejReason, onRejReasonChange, actioning, tab }) {
  const selisih = Number(item.selisih)
  const hasSelisih = selisih !== 0

  return (
    <div className="card overflow-hidden">
      {/* Header row */}
      <button onClick={onToggle} className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors">
        <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center text-xs font-bold text-primary-700 flex-shrink-0">
          {item.branch?.store_id?.split('-')[1] || '??'}
        </div>
        <div className="flex-1 text-left min-w-0">
          <div className="font-semibold text-sm text-gray-900 truncate">
            {item.branch?.name?.replace('Bagi Kopi ', '') || '—'}
          </div>
          <div className="text-xs text-gray-400">
            {fmtDateShort(item.tanggal)} · {fmtRp(item.cash_disetorkan)}
            {hasSelisih && <span className="text-red-500 ml-1">· Selisih {fmtRp(Math.abs(selisih))}</span>}
          </div>
        </div>
        <StatusChip status={item.status} />
        <svg className={`w-4 h-4 text-gray-300 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-gray-50 p-4 space-y-3">
          {/* Nominal grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="text-xs text-gray-400 font-medium">Cash POS</div>
              <div className="font-bold text-gray-900">{fmtRp(item.cash_pos)}</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="text-xs text-gray-400 font-medium">Disetorkan</div>
              <div className="font-bold text-gray-900">{fmtRp(item.cash_disetorkan)}</div>
            </div>
          </div>

          {/* Selisih */}
          {hasSelisih && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <div className="text-xs text-red-500 font-semibold">Selisih</div>
              <div className="text-lg font-bold text-red-700">{fmtRp(Math.abs(selisih))}</div>
              {item.alasan_selisih && (
                <div className="text-xs text-red-600 mt-1.5 bg-red-100 rounded-lg px-2 py-1.5">
                  "{item.alasan_selisih}"
                </div>
              )}
            </div>
          )}

          {/* Foto bukti */}
          <div>
            <p className="label mb-1.5">Foto Bukti Setoran</p>
            <PhotoViewer urls={item.foto_bukti || []} emptyText="Tidak ada foto bukti" />
          </div>

          {/* Submit info */}
          <div className="text-xs text-gray-400">
            Disubmit: {item.submitted_at ? new Date(item.submitted_at).toLocaleString('id-ID') : '—'}
          </div>

          {/* Rejection reason (if rejected) */}
          {item.status === 'rejected' && item.rejection_reason && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
              <strong>Alasan Reject:</strong> {item.rejection_reason}
            </div>
          )}

          {/* Action buttons — only for pending */}
          {tab === 'submitted' && (
            <>
              <div>
                <label className="label">Alasan Penolakan (wajib jika reject)</label>
                <input className="input" type="text" value={rejReason}
                  onChange={e => onRejReasonChange(e.target.value)}
                  placeholder="Tulis alasan jika akan direject..." />
              </div>
              <div className="flex gap-2">
                <button onClick={onReject} disabled={actioning}
                  className="flex-1 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-semibold active:scale-95 transition-transform">
                  {actioning ? '...' : 'Reject'}
                </button>
                <button onClick={onApprove} disabled={actioning}
                  className="flex-1 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-semibold active:scale-95 transition-transform">
                  {actioning ? '...' : 'Approve ✓'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function StatusChip({ status }) {
  const map = {
    submitted: 'bg-yellow-100 text-yellow-700',
    approved:  'bg-green-100 text-green-700',
    rejected:  'bg-red-100 text-red-700',
  }
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${map[status] || ''}`}>
      {status === 'submitted' ? 'Pending' : status === 'approved' ? 'Approved' : 'Rejected'}
    </span>
  )
}
