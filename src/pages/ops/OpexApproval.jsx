import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { fmtRp } from '../../lib/utils'
import { OpsBottomNav } from '../../components/BottomNav'
import { useToast } from '../../contexts/ToastContext'
import {
  EmptyPanel,
  InlineStat,
  SectionPanel,
  SubpageShell,
  ToneBadge,
  LoadingButton,
} from '../../components/ui/AppKit'

// support_admin/support_spv sees 'pending_support'; ops_manager sees 'support_approved'
function queueStatus(role) {
  return role === 'ops_manager' ? 'support_approved' : 'pending_support'
}

const STATUS_MAP = {
  submitted:        { label: 'Menunggu DM',      tone: 'warn'   },
  dm_approved:      { label: 'Menunggu AM',       tone: 'info'   },
  pending_support:  { label: 'Menunggu Support',  tone: 'warn'   },
  support_approved: { label: 'Menunggu Ops',      tone: 'info'   },
  ops_approved:     { label: 'Final Approved',    tone: 'ok'     },
  rejected:         { label: 'Ditolak',           tone: 'danger' },
}

export default function OpsOpexApproval() {
  const { profile } = useAuth()
  const { toastSuccess, toastError } = useToast()
  const role = profile?.role
  const isOps = role === 'ops_manager'

  const [queue, setQueue] = useState([])
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [note, setNote] = useState('')
  const [rejectNote, setRejectNote] = useState('')
  const [showReject, setShowReject] = useState(false)
  const [actioning, setActioning] = useState(false)

  useEffect(() => {
    fetchQueue()
    fetchHistory()
  }, [profile])

  const fetchQueue = async () => {
    setLoading(true)
    const status = queueStatus(role)
    const { data } = await supabase
      .from('opex_requests')
      .select('*, branch:branches(name)')
      .eq('status', status)
      .order('created_at', { ascending: false })
    setQueue(data || [])
    setLoading(false)
  }

  const fetchHistory = async () => {
    const { data } = await supabase
      .from('opex_requests')
      .select('*, branch:branches(name)')
      .in('status', ['ops_approved', 'rejected'])
      .order('created_at', { ascending: false })
      .limit(30)
    setHistory(data || [])
  }

  const handleApprove = async () => {
    if (!selected) return
    setActioning(true)
    const now = new Date().toISOString()

    let update
    if (isOps) {
      update = {
        status: 'ops_approved',
        ops_approved_by: profile.id,
        ops_approved_at: now,
        ops_note: note || null,
      }
    } else {
      update = {
        status: 'support_approved',
        support_approved_by: profile.id,
        support_approved_at: now,
        support_note: note || null,
      }
    }

    const { error } = await supabase.from('opex_requests').update(update).eq('id', selected.id)
    if (error) {
      toastError('Gagal approve: ' + error.message)
    } else {
      toastSuccess('Pengajuan berhasil di-approve.')
      resetAction()
      fetchQueue()
      fetchHistory()
    }
    setActioning(false)
  }

  const handleReject = async () => {
    if (!rejectNote.trim()) {
      toastError('Alasan penolakan wajib diisi.')
      return
    }
    if (!selected) return
    setActioning(true)
    const now = new Date().toISOString()

    const { error } = await supabase
      .from('opex_requests')
      .update({
        status: 'rejected',
        rejected_by: profile.id,
        rejected_at: now,
        rejected_note: rejectNote,
      })
      .eq('id', selected.id)

    if (error) {
      toastError('Gagal reject: ' + error.message)
    } else {
      toastSuccess('Pengajuan ditolak.')
      resetAction()
      fetchQueue()
      fetchHistory()
    }
    setActioning(false)
  }

  const resetAction = () => {
    setSelected(null)
    setNote('')
    setRejectNote('')
    setShowReject(false)
  }

  const totalQueue = queue.reduce((s, r) => s + Number(r.total_pengajuan || 0), 0)

  return (
    <SubpageShell
      title={isOps ? 'Approval Ops — Pengajuan Opex' : 'Approval Support — Pengajuan Opex'}
      subtitle={isOps ? 'Final approval sebelum Finance' : 'Review setelah DM/AM approval'}
      eyebrow="Opex Approval"
      showBack={false}
      footer={<OpsBottomNav />}
    >
      <SectionPanel eyebrow="Antrian" title="Pengajuan Masuk">
        <div className="grid gap-3 sm:grid-cols-3">
          <InlineStat label="Antrian" value={queue.length} tone={queue.length > 0 ? 'amber' : 'slate'} />
          <InlineStat label="Total Nilai" value={totalQueue > 0 ? fmtRp(totalQueue) : '-'} tone={totalQueue > 0 ? 'primary' : 'slate'} />
          <InlineStat label="Selesai" value={history.length} tone="slate" />
        </div>
      </SectionPanel>

      <div className="mt-6 space-y-6">
        <SectionPanel
          eyebrow="Queue"
          title={isOps ? 'Menunggu Ops Manager' : 'Menunggu Support Admin'}
          actions={<ToneBadge tone={queue.length > 0 ? 'warn' : 'slate'}>{queue.length} item</ToneBadge>}
        >
          {loading ? (
            <p className="text-sm text-slate-400">Memuat…</p>
          ) : queue.length === 0 ? (
            <EmptyPanel title="Antrian kosong" description="Tidak ada pengajuan yang menunggu approval." />
          ) : (
            <div className="space-y-3">
              {queue.map((req) => (
                <button
                  key={req.id}
                  type="button"
                  onClick={() => { setSelected(selected?.id === req.id ? null : req); setNote(''); setRejectNote(''); setShowReject(false) }}
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
                    {req.am_skipped ? ' · AM skipped' : ''}
                    {req.sisa_saldo != null ? ` · Sisa saldo ${fmtRp(req.sisa_saldo)}` : ''}
                  </div>

                  {selected?.id === req.id && (
                    <div className="mt-4 space-y-3 border-t border-slate-100 pt-4" onClick={(e) => e.stopPropagation()}>
                      {/* Trail info */}
                      {(req.dm_note || req.am_note) && (
                        <div className="space-y-1 rounded-2xl bg-slate-100 px-3 py-2.5 text-xs text-slate-600">
                          {req.dm_note && <p><span className="font-semibold">DM:</span> {req.dm_note}</p>}
                          {req.am_note && <p><span className="font-semibold">AM:</span> {req.am_note}</p>}
                        </div>
                      )}

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
                        <span className="text-sm font-semibold text-slate-700">Total</span>
                        <span className="text-base font-bold text-primary-700">{fmtRp(req.total_pengajuan)}</span>
                      </div>

                      {/* Note input */}
                      <div>
                        <label className="label">Catatan (opsional)</label>
                        <input
                          className="input"
                          type="text"
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="Catatan persetujuan…"
                        />
                      </div>

                      {showReject && (
                        <div>
                          <label className="label">Alasan Penolakan <span className="text-rose-500">*</span></label>
                          <input
                            className="input border-rose-200"
                            type="text"
                            value={rejectNote}
                            onChange={(e) => setRejectNote(e.target.value)}
                            placeholder="Wajib diisi…"
                          />
                        </div>
                      )}

                      <div className="flex gap-2">
                        {!showReject ? (
                          <>
                            <LoadingButton loading={actioning} onClick={handleApprove} className="btn-primary flex-1">
                              Approve
                            </LoadingButton>
                            <button
                              type="button"
                              onClick={() => setShowReject(true)}
                              className="flex-1 rounded-2xl border border-rose-200 bg-rose-50 py-3 text-sm font-semibold text-rose-600 hover:bg-rose-100 transition-colors"
                            >
                              Tolak
                            </button>
                          </>
                        ) : (
                          <>
                            <LoadingButton loading={actioning} onClick={handleReject} className="flex-1 rounded-2xl bg-rose-600 py-3 text-sm font-semibold text-white hover:bg-rose-700 transition-colors">
                              Konfirmasi Tolak
                            </LoadingButton>
                            <button
                              type="button"
                              onClick={() => setShowReject(false)}
                              className="flex-1 rounded-2xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                            >
                              Batal
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </SectionPanel>

        {/* History */}
        <SectionPanel
          eyebrow="Riwayat"
          title="Sudah Final"
          actions={<ToneBadge tone="slate">{history.length}</ToneBadge>}
        >
          {history.length === 0 ? (
            <EmptyPanel title="Belum ada riwayat" description="Pengajuan yang sudah selesai diproses akan muncul di sini." />
          ) : (
            <div className="space-y-2">
              {history.map((req) => {
                const st = STATUS_MAP[req.status] || { label: req.status, tone: 'slate' }
                return (
                  <div key={req.id} className="flex items-center justify-between rounded-[22px] bg-slate-50/85 px-4 py-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">
                        {req.branch?.name?.replace('Bagi Kopi ', '') || '-'}
                      </div>
                      <div className="text-xs text-slate-400">{req.tanggal_pengajuan} · {fmtRp(req.total_pengajuan)}</div>
                    </div>
                    <ToneBadge tone={st.tone}>{st.label}</ToneBadge>
                  </div>
                )
              })}
            </div>
          )}
        </SectionPanel>
      </div>
    </SubpageShell>
  )
}
