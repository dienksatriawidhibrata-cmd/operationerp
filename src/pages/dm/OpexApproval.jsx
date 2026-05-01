import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { fmtRp, fmtDateShort } from '../../lib/utils'
import { DMBottomNav } from '../../components/BottomNav'
import { useToast } from '../../contexts/ToastContext'
import {
  AppIcon,
  EmptyPanel,
  InlineStat,
  SectionPanel,
  SubpageShell,
  ToneBadge,
  LoadingButton,
} from '../../components/ui/AppKit'

function queueStatus(role) {
  return role === 'area_manager' ? 'dm_approved' : 'submitted'
}

function itemCount(items) {
  return Array.isArray(items) ? items.length : 0
}

async function fetchScopedBranchIds(profile) {
  if (!profile?.role) return []

  let query = supabase
    .from('branches')
    .select('id')
    .eq('is_active', true)

  if (profile.role === 'district_manager') {
    const districts = profile.managed_districts || []
    if (!districts.length) return []
    query = query.in('district', districts)
  } else if (profile.role === 'area_manager') {
    const areas = profile.managed_areas || []
    if (!areas.length) return []
    query = query.in('area', areas)
  }

  const { data, error } = await query
  if (error) throw error
  return (data || []).map((row) => row.id)
}

export default function OpexApproval() {
  const { profile } = useAuth()
  const { toastSuccess, toastError } = useToast()
  const role = profile?.role
  const isDM = role === 'district_manager'

  const [queue, setQueue] = useState([])
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [skipAM, setSkipAM] = useState(false)
  const [note, setNote] = useState('')
  const [rejectNote, setRejectNote] = useState('')
  const [showReject, setShowReject] = useState(false)
  const [actioning, setActioning] = useState(false)

  useEffect(() => {
    fetchQueue()
    fetchHistory()
  }, [profile?.id, profile?.role, profile?.managed_districts, profile?.managed_areas])

  const fetchQueue = async () => {
    setLoading(true)
    const status = queueStatus(role)
    let branchIds = []

    try {
      branchIds = await fetchScopedBranchIds(profile)
    } catch (error) {
      toastError(`Gagal memuat scope toko: ${error.message}`)
      setQueue([])
      setLoading(false)
      return
    }

    if (!branchIds.length) {
      setQueue([])
      setLoading(false)
      return
    }

    let query = supabase
      .from('opex_requests')
      .select('*, branch:branches(id,name,store_id,district,area), submitter:profiles!submitted_by(full_name)')
      .eq('status', status)
      .in('branch_id', branchIds)
      .order('created_at', { ascending: false })

    const { data, error } = await query
    if (error) {
      toastError(`Gagal memuat antrian: ${error.message}`)
      setQueue([])
    } else {
      setQueue(data || [])
    }
    setLoading(false)
  }

  const fetchHistory = async () => {
    const doneStatuses = ['pending_support', 'support_approved', 'ops_approved', 'rejected']
    let branchIds = []

    try {
      branchIds = await fetchScopedBranchIds(profile)
    } catch (error) {
      toastError(`Gagal memuat scope toko: ${error.message}`)
      setHistory([])
      return
    }

    if (!branchIds.length) {
      setHistory([])
      return
    }

    let query = supabase
      .from('opex_requests')
      .select('*, branch:branches(id,name,store_id,district,area), submitter:profiles!submitted_by(full_name)')
      .in('status', doneStatuses)
      .in('branch_id', branchIds)
      .order('created_at', { ascending: false })
      .limit(20)

    const { data, error } = await query
    if (error) {
      toastError(`Gagal memuat riwayat: ${error.message}`)
      setHistory([])
      return
    }
    setHistory(data || [])
  }

  const handleApprove = async () => {
    if (!selected) return
    setActioning(true)
    const now = new Date().toISOString()

    let update
    if (isDM) {
      const nextStatus = skipAM ? 'pending_support' : 'dm_approved'
      update = {
        status: nextStatus,
        dm_approved_by: profile.id,
        dm_approved_at: now,
        dm_note: note || null,
        am_skipped: skipAM,
      }
    } else {
      update = {
        status: 'pending_support',
        am_approved_by: profile.id,
        am_approved_at: now,
        am_note: note || null,
      }
    }

    const { error } = await supabase.from('opex_requests').update(update).eq('id', selected.id)
    if (error) {
      toastError(`Gagal approve: ${error.message}`)
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
      toastError(`Gagal reject: ${error.message}`)
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
    setSkipAM(false)
  }

  const totalQueue = queue.reduce((sum, row) => sum + Number(row.total_pengajuan || 0), 0)

  const STATUS_MAP = {
    submitted: { label: 'Menunggu DM', tone: 'warn' },
    dm_approved: { label: 'Menunggu AM', tone: 'info' },
    pending_support: { label: 'Menunggu Support', tone: 'info' },
    support_approved: { label: 'Menunggu Ops', tone: 'info' },
    ops_approved: { label: 'Final Approved', tone: 'ok' },
    rejected: { label: 'Ditolak', tone: 'danger' },
  }

  return (
    <SubpageShell
      title="Approval Pengajuan Opex"
      subtitle={isDM ? `District ${profile?.managed_districts?.join(', ') || '-'}` : `Area ${profile?.managed_areas?.join(', ') || '-'}`}
      eyebrow="Opex Approval"
      showBack={false}
      footer={<DMBottomNav />}
    >
      <SectionPanel eyebrow="Antrian" title="Pengajuan Masuk">
        <div className="grid gap-3 sm:grid-cols-3">
          <InlineStat label="Antrian" value={queue.length} tone={queue.length > 0 ? 'amber' : 'slate'} />
          <InlineStat label="Total Nilai" value={totalQueue > 0 ? fmtRp(totalQueue) : '-'} tone={totalQueue > 0 ? 'primary' : 'slate'} />
          <InlineStat label="Riwayat" value={history.length} tone="slate" />
        </div>
      </SectionPanel>

      <div className="mt-6 space-y-6">
        <SectionPanel
          eyebrow="Queue"
          title={isDM ? 'Menunggu Approval DM' : 'Menunggu Approval AM'}
          description="Setiap kartu menampilkan toko pengaju, nominal total, dan item yang diajukan agar approval tidak tercampur antar toko."
          actions={<ToneBadge tone={queue.length > 0 ? 'warn' : 'slate'}>{queue.length} item</ToneBadge>}
        >
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-9 w-9 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
            </div>
          ) : queue.length === 0 ? (
            <EmptyPanel title="Antrian kosong" description="Tidak ada pengajuan yang menunggu approval." />
          ) : (
            <div className="space-y-4">
              {queue.map((req) => {
                const expanded = selected?.id === req.id
                const branchName = req.branch?.name?.replace('Bagi Kopi ', '') || '-'
                return (
                  <article key={req.id} className="overflow-hidden rounded-[24px] border border-white/85 bg-white shadow-[0_18px_55px_-34px_rgba(15,23,42,0.26)]">
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(expanded ? null : req)
                        setNote('')
                        setRejectNote('')
                        setShowReject(false)
                        setSkipAM(false)
                      }}
                      className="flex w-full items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-slate-50/70 sm:px-5 sm:py-5"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-sm font-bold text-primary-700">
                        {req.branch?.store_id?.split('-')[1] || '--'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-base font-semibold text-slate-950">{branchName}</div>
                          <ToneBadge tone="slate">{req.branch?.district || '-'}</ToneBadge>
                          {!isDM && <ToneBadge tone="slate">{req.branch?.area || '-'}</ToneBadge>}
                        </div>
                        <div className="mt-1 text-sm text-slate-500">
                          {fmtDateShort(req.tanggal_pengajuan)} · {itemCount(req.items)} item · {req.submitter?.full_name || 'Pengaju tidak terbaca'}
                        </div>
                        <div className="mt-2 text-lg font-bold text-slate-900">{fmtRp(req.total_pengajuan)}</div>
                        <div className="mt-1 text-xs text-slate-400">
                          {req.sisa_saldo != null ? `Sisa saldo ${fmtRp(req.sisa_saldo)}` : 'Tanpa info sisa saldo'}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <AppIcon name={expanded ? 'chevronDown' : 'chevronRight'} size={18} className="text-slate-400" />
                      </div>
                    </button>

                    {expanded && (
                      <div className="border-t border-slate-100 px-4 py-4 sm:px-5 sm:py-5" onClick={(event) => event.stopPropagation()}>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <InlineStat label="Toko" value={branchName} tone="slate" />
                          <InlineStat label="Tanggal" value={fmtDateShort(req.tanggal_pengajuan)} tone="slate" />
                          <InlineStat label="Total" value={fmtRp(req.total_pengajuan)} tone="primary" />
                        </div>

                        <div className="mt-4 space-y-3">
                          {Array.isArray(req.items) && req.items.map((item, index) => (
                            <div key={index} className="flex items-start justify-between gap-3 rounded-[20px] bg-slate-50 px-4 py-3">
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-semibold text-slate-900">{item.kebutuhan}</div>
                                <div className="mt-1 text-xs text-slate-400">{item.kategori || '-'}</div>
                                <div className="mt-1 text-xs text-slate-500">{item.jumlah} x {fmtRp(item.harga_satuan)}</div>
                              </div>
                              <div className="shrink-0 text-sm font-semibold text-primary-700">{fmtRp(item.total)}</div>
                            </div>
                          ))}
                        </div>

                        {req.keterangan && (
                          <div className="mt-4 rounded-[20px] border border-slate-200 bg-white px-4 py-3 text-sm italic text-slate-500">
                            {req.keterangan}
                          </div>
                        )}

                        {isDM && (
                          <label className="mt-4 flex items-center gap-3 rounded-2xl bg-amber-50 px-3 py-2.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={skipAM}
                              onChange={(event) => setSkipAM(event.target.checked)}
                              className="h-4 w-4 rounded border-slate-300 accent-amber-500"
                            />
                            <span className="text-sm font-semibold text-amber-800">
                              Skip AM (district ini tidak punya Area Manager aktif)
                            </span>
                          </label>
                        )}

                        <div className="mt-4">
                          <label className="label">Catatan (opsional)</label>
                          <input
                            className="input"
                            type="text"
                            value={note}
                            onChange={(event) => setNote(event.target.value)}
                            placeholder="Catatan persetujuan..."
                          />
                        </div>

                        {showReject && (
                          <div className="mt-4">
                            <label className="label">Alasan Penolakan <span className="text-rose-500">*</span></label>
                            <input
                              className="input border-rose-200"
                              type="text"
                              value={rejectNote}
                              onChange={(event) => setRejectNote(event.target.value)}
                              placeholder="Wajib diisi..."
                            />
                          </div>
                        )}

                        <div className="mt-4 flex gap-2">
                          {!showReject ? (
                            <>
                              <LoadingButton loading={actioning} onClick={handleApprove} className="btn-primary flex-1">
                                Approve
                              </LoadingButton>
                              <button
                                type="button"
                                onClick={() => setShowReject(true)}
                                className="flex-1 rounded-2xl border border-rose-200 bg-rose-50 py-3 text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-100"
                              >
                                Tolak
                              </button>
                            </>
                          ) : (
                            <>
                              <LoadingButton
                                loading={actioning}
                                onClick={handleReject}
                                className="flex-1 rounded-2xl bg-rose-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-rose-700"
                              >
                                Konfirmasi Tolak
                              </LoadingButton>
                              <button
                                type="button"
                                onClick={() => setShowReject(false)}
                                className="flex-1 rounded-2xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                              >
                                Batal
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          )}
        </SectionPanel>

        <SectionPanel
          eyebrow="Riwayat"
          title="Sudah Diproses"
          actions={<ToneBadge tone="slate">{history.length}</ToneBadge>}
        >
          {history.length === 0 ? (
            <EmptyPanel title="Belum ada riwayat" description="Pengajuan yang sudah diproses akan muncul di sini." />
          ) : (
            <div className="space-y-2">
              {history.map((req) => {
                const status = STATUS_MAP[req.status] || { label: req.status, tone: 'slate' }
                return (
                  <div key={req.id} className="flex items-center justify-between rounded-[22px] bg-slate-50/85 px-4 py-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">
                        {(req.branch?.name || '-').replace('Bagi Kopi ', '')}
                      </div>
                      <div className="text-xs text-slate-400">
                        {fmtDateShort(req.tanggal_pengajuan)} · {fmtRp(req.total_pengajuan)} · {req.submitter?.full_name || '-'}
                      </div>
                    </div>
                    <ToneBadge tone={status.tone}>{status.label}</ToneBadge>
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
