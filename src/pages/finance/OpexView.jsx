import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { fmtRp } from '../../lib/utils'
import { FinanceBottomNav } from '../../components/BottomNav'
import {
  EmptyPanel,
  InlineStat,
  SectionPanel,
  SubpageShell,
  ToneBadge,
} from '../../components/ui/AppKit'

const STATUS_MAP = {
  ops_approved:     { label: 'Final Approved', tone: 'ok'     },
  rejected:         { label: 'Ditolak',        tone: 'danger' },
}

export default function FinanceOpexView() {
  const { profile } = useAuth()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [filter, setFilter] = useState('ops_approved')
  const printRef = useRef(null)

  useEffect(() => {
    fetchRequests()
  }, [filter])

  const fetchRequests = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('opex_requests')
      .select('*, branch:branches(name), submitter:profiles!submitted_by(full_name)')
      .eq('status', filter)
      .order('created_at', { ascending: false })
      .limit(100)
    setRequests(data || [])
    setLoading(false)
  }

  const totalNilai = requests.reduce((s, r) => s + Number(r.total_pengajuan || 0), 0)

  const handlePrint = () => {
    if (!selected) return
    const win = window.open('', '_blank')
    const items = Array.isArray(selected.items) ? selected.items : []
    const rows = items.map((item, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${item.kebutuhan}</td>
        <td>${item.kategori}</td>
        <td style="text-align:right">${item.jumlah}</td>
        <td style="text-align:right">${fmtRp(item.harga_satuan)}</td>
        <td style="text-align:right">${fmtRp(item.total)}</td>
      </tr>`).join('')
    win.document.write(`
      <!DOCTYPE html><html><head>
      <meta charset="utf-8">
      <title>Pengajuan Opex - ${selected.branch?.name || ''}</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 12px; margin: 32px; }
        h2 { font-size: 16px; margin-bottom: 4px; }
        .sub { color: #666; margin-bottom: 16px; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        th { background: #f0f4ff; text-align: left; padding: 6px 8px; border: 1px solid #ddd; }
        td { padding: 6px 8px; border: 1px solid #ddd; }
        .total { font-weight: bold; background: #f0f4ff; }
        .meta { margin-bottom: 8px; }
        @media print { body { margin: 0; } }
      </style></head><body>
      <h2>Formulir Pengajuan Dana Operasional</h2>
      <div class="sub">
        <div class="meta">Cabang: <strong>${selected.branch?.name || '-'}</strong></div>
        <div class="meta">Tanggal Pengajuan: <strong>${selected.tanggal_pengajuan}</strong></div>
        <div class="meta">Diajukan oleh: <strong>${selected.submitter?.full_name || '-'}</strong></div>
        ${selected.sisa_saldo != null ? `<div class="meta">Sisa Saldo: <strong>${fmtRp(selected.sisa_saldo)}</strong></div>` : ''}
      </div>
      <table>
        <thead>
          <tr>
            <th>No.</th><th>Kebutuhan</th><th>Kategori</th>
            <th style="text-align:right">Jumlah</th>
            <th style="text-align:right">Harga Satuan</th>
            <th style="text-align:right">Total</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
          <tr class="total">
            <td colspan="5">Total Pengajuan</td>
            <td style="text-align:right">${fmtRp(selected.total_pengajuan)}</td>
          </tr>
        </tbody>
      </table>
      ${selected.keterangan ? `<p style="margin-top:12px;"><strong>Keterangan:</strong> ${selected.keterangan}</p>` : ''}
      <p style="margin-top:20px;color:#888;font-size:11px;">Approved via BagiKopi Ops · ${new Date().toLocaleString('id-ID')}</p>
      </body></html>`)
    win.document.close()
    win.print()
  }

  return (
    <SubpageShell
      title="Dana Operasional — Finance"
      subtitle="Daftar pengajuan yang sudah final approved"
      eyebrow="Finance View"
      showBack={false}
      footer={<FinanceBottomNav />}
    >
      <SectionPanel eyebrow="Summary" title="Ringkasan">
        <div className="grid gap-3 sm:grid-cols-3">
          <InlineStat label="Total Pengajuan" value={requests.length} tone="primary" />
          <InlineStat label="Total Nilai" value={totalNilai > 0 ? fmtRp(totalNilai) : '-'} tone={totalNilai > 0 ? 'amber' : 'slate'} />
          <InlineStat label="Filter" value={filter === 'ops_approved' ? 'Approved' : 'Ditolak'} tone="slate" />
        </div>
      </SectionPanel>

      <div className="mt-6 space-y-6">
        {/* Filter tabs */}
        <div className="flex gap-2">
          {['ops_approved', 'rejected'].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => { setFilter(s); setSelected(null) }}
              className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                filter === s
                  ? 'bg-primary-600 text-white'
                  : 'border border-slate-200 bg-white text-slate-600 hover:border-primary-200 hover:text-primary-600'
              }`}
            >
              {s === 'ops_approved' ? 'Final Approved' : 'Ditolak'}
            </button>
          ))}
        </div>

        <SectionPanel
          eyebrow="Daftar"
          title="Pengajuan Dana Operasional"
          actions={<ToneBadge tone={filter === 'ops_approved' ? 'ok' : 'danger'}>{requests.length} item</ToneBadge>}
        >
          {loading ? (
            <p className="text-sm text-slate-400">Memuat…</p>
          ) : requests.length === 0 ? (
            <EmptyPanel title="Belum ada data" description="Belum ada pengajuan dengan status ini." />
          ) : (
            <div className="space-y-3">
              {requests.map((req) => (
                <button
                  key={req.id}
                  type="button"
                  onClick={() => setSelected(selected?.id === req.id ? null : req)}
                  className="w-full text-left rounded-[22px] bg-slate-50/85 px-4 py-4 transition-colors hover:bg-primary-50"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500">
                      {req.branch?.name?.replace('Bagi Kopi ', '') || '-'}
                    </span>
                    <span className="text-xs text-slate-400">{req.tanggal_pengajuan}</span>
                  </div>
                  <div className="mt-1.5 text-lg font-bold text-slate-900">{fmtRp(req.total_pengajuan)}</div>
                  <div className="mt-0.5 text-xs text-slate-400">
                    {Array.isArray(req.items) ? req.items.length : 0} item
                    {req.submitter?.full_name ? ` · ${req.submitter.full_name}` : ''}
                  </div>

                  {selected?.id === req.id && (
                    <div className="mt-4 space-y-3 border-t border-slate-100 pt-4" onClick={(e) => e.stopPropagation()}>
                      {/* Approval trail */}
                      <div className="space-y-1 rounded-2xl bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800">
                        {req.dm_note && <p><span className="font-semibold">DM:</span> {req.dm_note}</p>}
                        {req.am_note && <p><span className="font-semibold">AM:</span> {req.am_note}</p>}
                        {req.support_note && <p><span className="font-semibold">Support:</span> {req.support_note}</p>}
                        {req.ops_note && <p><span className="font-semibold">Ops:</span> {req.ops_note}</p>}
                        {req.rejected_note && <p className="text-rose-700"><span className="font-semibold">Ditolak:</span> {req.rejected_note}</p>}
                      </div>

                      {/* Item list */}
                      {Array.isArray(req.items) && req.items.map((item, idx) => (
                        <div key={idx} className="flex items-start justify-between gap-3 rounded-2xl bg-white px-3 py-2.5 text-sm">
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900">{item.kebutuhan}</div>
                            <div className="text-xs text-slate-400">{item.kategori}</div>
                            <div className="text-xs text-slate-500">{item.jumlah} × {fmtRp(item.harga_satuan)}</div>
                          </div>
                          <div className="shrink-0 font-semibold text-primary-700">{fmtRp(item.total)}</div>
                        </div>
                      ))}
                      {req.keterangan && (
                        <p className="text-xs italic text-slate-500 px-1">{req.keterangan}</p>
                      )}

                      <div className="flex items-center justify-between rounded-[22px] border border-primary-100 bg-primary-50 px-4 py-3">
                        <span className="text-sm font-semibold text-slate-700">Total Pengajuan</span>
                        <span className="text-base font-bold text-primary-700">{fmtRp(req.total_pengajuan)}</span>
                      </div>

                      {req.status === 'ops_approved' && (
                        <button
                          type="button"
                          onClick={handlePrint}
                          className="w-full rounded-2xl bg-slate-900 py-3 text-sm font-semibold text-white hover:bg-slate-800 transition-colors"
                        >
                          Download / Print
                        </button>
                      )}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </SectionPanel>
      </div>
    </SubpageShell>
  )
}
