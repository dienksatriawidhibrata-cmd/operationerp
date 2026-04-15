import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { fmtRp, fmtDateShort } from '../../lib/utils'
import Header from '../../components/Header'
import PhotoViewer from '../../components/PhotoViewer'
import Alert from '../../components/Alert'
import { FinanceBottomNav } from '../../components/BottomNav'

const TABS = [
  { key: 'pending',  label: 'Belum Diaudit' },
  { key: 'audited',  label: 'Sudah Audit' },
  { key: 'flagged',  label: 'Flagged' },
]

export default function AuditSetoran() {
  const { profile, signOut } = useAuth()
  const [tab, setTab]         = useState('pending')
  const [items, setItems]     = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [notes, setNotes]     = useState('')
  const [actioning, setActioning] = useState(false)
  const [msg, setMsg]         = useState(null)
  const [filter, setFilter]   = useState('all') // all | selisih | approved | rejected

  useEffect(() => { fetchSetoran() }, [tab])

  const fetchSetoran = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('daily_deposits')
      .select('*, branch:branches(name,store_id,district,area)')
      .eq('finance_status', tab)
      .in('status', ['approved', 'rejected', 'submitted'])
      .order('tanggal', { ascending: false })
    setItems(data || [])
    setLoading(false)
  }

  const markAudited = async (item, flagged = false) => {
    setActioning(true)
    const { error } = await supabase.from('daily_deposits').update({
      finance_status: flagged ? 'flagged' : 'audited',
      finance_audited_by: profile.id,
      finance_audited_at: new Date().toISOString(),
      finance_notes: notes || null,
    }).eq('id', item.id)
    if (error) { setMsg({ type: 'error', text: 'Gagal: ' + error.message }) }
    else {
      setMsg({ type: 'ok', text: flagged ? 'Setoran diflag untuk review lebih lanjut.' : 'Setoran selesai diaudit ✓' })
      setSelected(null); setNotes(''); fetchSetoran()
    }
    setActioning(false)
  }

  // Filter items
  const filtered = items.filter(item => {
    if (filter === 'selisih') return Number(item.selisih) !== 0
    if (filter === 'approved') return item.status === 'approved'
    if (filter === 'rejected') return item.status === 'rejected'
    return true
  })

  const totalSelisih = filtered.reduce((s, i) => s + Math.abs(Number(i.selisih)), 0)

  return (
    <div className="page-shell">
      <header className="bg-primary-600 text-white px-4 pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-primary-200 text-xs">Finance Supervisor</p>
            <h1 className="text-lg font-bold mt-0.5">Audit Setoran</h1>
          </div>
          <button onClick={signOut} className="text-primary-300 hover:text-white p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </header>

      {/* Finance tabs */}
      <div className="flex bg-white border-b border-gray-100 px-4 gap-1 sticky top-0 z-10">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 py-3 text-xs font-bold border-b-2 transition-colors ${
              tab === t.key ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-400'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto pb-24 px-4 pt-4 space-y-3">
        {msg && <Alert variant={msg.type === 'ok' ? 'ok' : 'error'}>{msg.text}</Alert>}

        {/* Summary strip */}
        {!loading && filtered.length > 0 && (
          <div className="flex gap-2">
            <div className="card flex-1 p-3 text-center">
              <div className="text-lg font-bold text-primary-700">{filtered.length}</div>
              <div className="text-xs text-gray-400">Total</div>
            </div>
            <div className="card flex-1 p-3 text-center">
              <div className="text-lg font-bold text-red-600">{filtered.filter(i => Number(i.selisih) !== 0).length}</div>
              <div className="text-xs text-gray-400">Ada Selisih</div>
            </div>
            <div className="card flex-1 p-3 text-center">
              <div className="text-base font-bold text-red-600">{fmtRp(totalSelisih)}</div>
              <div className="text-xs text-gray-400">Total Selisih</div>
            </div>
          </div>
        )}

        {/* Filter chips */}
        {!loading && (
          <div className="flex gap-2 flex-wrap">
            {[
              { key: 'all',      label: 'Semua' },
              { key: 'selisih',  label: '⚠ Ada Selisih' },
              { key: 'approved', label: '✓ Approved' },
              { key: 'rejected', label: '✗ Rejected' },
            ].map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                  filter === f.key ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-200'
                }`}>
                {f.label}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-4xl mb-3">📋</div>
            <p className="font-medium">Tidak ada setoran di kategori ini</p>
          </div>
        ) : (
          filtered.map(item => (
            <FinanceCard
              key={item.id}
              item={item}
              expanded={selected?.id === item.id}
              onToggle={() => setSelected(selected?.id === item.id ? null : item)}
              onAudit={() => markAudited(item, false)}
              onFlag={() => markAudited(item, true)}
              notes={notes}
              onNotesChange={setNotes}
              actioning={actioning}
              tab={tab}
            />
          ))
        )}
      </div>

      <FinanceBottomNav />
    </div>
  )
}

function FinanceCard({ item, expanded, onToggle, onAudit, onFlag, notes, onNotesChange, actioning, tab }) {
  const selisih = Number(item.selisih)

  return (
    <div className="card overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors">
        <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center text-xs font-bold text-primary-700 flex-shrink-0">
          {item.branch?.store_id?.split('-')[1] || '??'}
        </div>
        <div className="flex-1 text-left min-w-0">
          <div className="font-semibold text-sm text-gray-900 truncate">
            {item.branch?.name?.replace('Bagi Kopi ','') || '—'}
          </div>
          <div className="text-xs text-gray-400">
            {fmtDateShort(item.tanggal)} · {fmtRp(item.cash_disetorkan)}
            {selisih !== 0 && <span className="text-red-500 ml-1.5 font-semibold">Selisih {fmtRp(Math.abs(selisih))}</span>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
            item.status === 'approved' ? 'bg-green-100 text-green-700' :
            item.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
          }`}>
            {item.status === 'approved' ? 'DM Approved' : item.status === 'rejected' ? 'DM Rejected' : 'Pending DM'}
          </span>
          <svg className={`w-4 h-4 text-gray-300 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-50 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="text-xs text-gray-400">Cash POS</div>
              <div className="font-bold">{fmtRp(item.cash_pos)}</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="text-xs text-gray-400">Disetorkan</div>
              <div className="font-bold">{fmtRp(item.cash_disetorkan)}</div>
            </div>
          </div>

          {selisih !== 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <div className="text-xs text-red-500 font-semibold">Selisih Cash</div>
              <div className="text-xl font-bold text-red-700">{fmtRp(Math.abs(selisih))}</div>
              {item.alasan_selisih && (
                <div className="text-xs text-red-600 mt-1.5 bg-red-100 rounded-lg px-2 py-1.5 italic">
                  "{item.alasan_selisih}"
                </div>
              )}
            </div>
          )}

          {/* FOTO BUKTI — viewable inline */}
          <div>
            <p className="label mb-2">📸 Foto Bukti Setoran</p>
            <PhotoViewer urls={item.foto_bukti || []} emptyText="Tidak ada foto bukti" />
          </div>

          <div className="text-xs text-gray-400 space-y-0.5">
            <div>Submit: {item.submitted_at ? new Date(item.submitted_at).toLocaleString('id-ID') : '—'}</div>
            {item.approved_at && <div>Approved by DM: {new Date(item.approved_at).toLocaleString('id-ID')}</div>}
            {item.finance_notes && <div className="mt-1 text-primary-600">Catatan audit: {item.finance_notes}</div>}
          </div>

          {/* Audit actions */}
          {tab === 'pending' && (
            <>
              <div>
                <label className="label">Catatan Audit Finance</label>
                <input className="input" type="text" value={notes} onChange={e => onNotesChange(e.target.value)}
                  placeholder="Catatan untuk rekap (opsional)..." />
              </div>
              <div className="flex gap-2">
                <button onClick={onFlag} disabled={actioning}
                  className="flex-1 py-2.5 rounded-xl bg-yellow-50 border border-yellow-200 text-yellow-700 text-sm font-semibold">
                  {actioning ? '...' : '🚩 Flag'}
                </button>
                <button onClick={onAudit} disabled={actioning}
                  className="flex-1 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-semibold">
                  {actioning ? '...' : '✓ Selesai Diaudit'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
