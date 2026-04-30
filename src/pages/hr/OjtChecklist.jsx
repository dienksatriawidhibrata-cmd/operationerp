import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import {
  SubpageShell, SectionPanel, LoadingButton, ToneBadge, EmptyPanel,
} from '../../components/ui/AppKit'
import { SmartBottomNav } from '../../components/BottomNav'
import { fmtDate } from '../../lib/utils'
import { useToast } from '../../contexts/ToastContext'
import { OJT_ITEMS, OJT_SIGNERS } from '../../lib/recruitment'

// Role → kunci kolom sign-off
function signerKeyForRole(role) {
  if (role === 'head_store') return 'hs'
  if (role === 'trainer')    return 'trainer'
  if (['staff','barista','kitchen','waitress','asst_head_store'].includes(role)) return 'staff'
  if (['hr_staff','hr_spv','hr_legal','hr_administrator','ops_manager','support_spv'].includes(role)) return null // HR bisa lihat semua, tidak bisa sign
  return null
}

function pctComplete(checklist, signerKey) {
  if (!checklist || !signerKey) return 0
  const done = OJT_ITEMS.filter(it => checklist[it.key]?.[signerKey]).length
  return Math.round((done / OJT_ITEMS.length) * 100)
}

function allItemsDone(checklist, signerKey) {
  return OJT_ITEMS.every(it => checklist[it.key]?.[signerKey])
}

export default function OjtChecklist() {
  const { id } = useParams()      // candidate_id
  const { profile } = useAuth()
  const { showToast } = useToast()

  const [candidate, setCandidate] = useState(null)
  const [ckl, setCkl] = useState(null)   // ojt_checklists row
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [signingOff, setSigningOff] = useState(false)

  const role = profile?.role
  const myKey = signerKeyForRole(role)
  const isHR = ['hr_staff','hr_spv','hr_legal','hr_administrator','ops_manager','support_spv'].includes(role)

  useEffect(() => {
    load()
  }, [id])

  async function load() {
    const [{ data: c }, { data: ck }] = await Promise.all([
      supabase.from('candidates')
        .select('id, full_name, applied_position, branch_id, current_stage, branches(name)')
        .eq('id', id)
        .single(),
      supabase.from('ojt_checklists')
        .select('*')
        .eq('candidate_id', id)
        .maybeSingle(),
    ])
    setCandidate(c)
    setCkl(ck)
    setLoading(false)
  }

  // Inisialisasi checklist record jika belum ada
  async function initChecklist() {
    if (!candidate) return
    setSaving(true)
    const { data, error } = await supabase.from('ojt_checklists')
      .insert({
        candidate_id: id,
        branch_id: candidate.branch_id,
        checklist: {},
        created_by: profile?.id,
      })
      .select()
      .single()

    if (error) {
      showToast('Gagal inisialisasi: ' + error.message, 'error')
    } else {
      setCkl(data)
    }
    setSaving(false)
  }

  // Toggle satu item untuk kolom signer aktif
  async function toggleItem(itemKey) {
    if (!myKey || !ckl) return
    const current = ckl.checklist?.[itemKey]?.[myKey] ?? false
    const newChecklist = {
      ...ckl.checklist,
      [itemKey]: {
        ...(ckl.checklist?.[itemKey] ?? {}),
        [myKey]: !current,
      },
    }

    // Optimistic update
    setCkl(prev => ({ ...prev, checklist: newChecklist }))

    const { error } = await supabase.from('ojt_checklists')
      .update({ checklist: newChecklist })
      .eq('id', ckl.id)

    if (error) {
      showToast('Gagal simpan: ' + error.message, 'error')
      // Rollback
      setCkl(prev => ({ ...prev, checklist: ckl.checklist }))
    }
  }

  // Final sign-off keseluruhan
  async function finalSignOff() {
    if (!myKey || !ckl) return
    if (!allItemsDone(ckl.checklist, myKey)) {
      return showToast('Semua item harus di-tick terlebih dahulu', 'error')
    }

    const signedCol = `signed_${myKey}`
    const signedByCol = `signed_${myKey}_by`
    const signedAtCol = `signed_${myKey}_at`

    setSigningOff(true)
    const { error } = await supabase.from('ojt_checklists')
      .update({
        [signedCol]:   true,
        [signedByCol]: profile?.id,
        [signedAtCol]: new Date().toISOString(),
      })
      .eq('id', ckl.id)

    if (error) {
      showToast('Gagal: ' + error.message, 'error')
    } else {
      showToast('Sign-off berhasil', 'success')
      await load()
    }
    setSigningOff(false)
  }

  if (loading) {
    return (
      <SubpageShell title="OJT Checklist" backTo={`/hr/candidates/${id}`}>
        <p className="text-xs text-slate-400 px-4 py-6">Memuat...</p>
      </SubpageShell>
    )
  }

  if (!candidate) {
    return (
      <SubpageShell title="OJT Checklist" backTo="/hr">
        <EmptyPanel message="Kandidat tidak ditemukan" />
      </SubpageShell>
    )
  }

  const checklist = ckl?.checklist ?? {}

  // Progress per signer
  const progress = OJT_SIGNERS.map(s => ({
    ...s,
    done: OJT_ITEMS.filter(it => checklist[it.key]?.[s.key]).length,
    total: OJT_ITEMS.length,
    signed: ckl?.[s.col] ?? false,
    signed_at: ckl?.[`${s.col}_at`],
  }))

  return (
    <SubpageShell
      title="OJT Checklist"
      eyebrow={candidate.full_name}
      backTo={`/hr/candidates/${id}`}
    >
      {/* Info kandidat */}
      <div className="mx-4 mt-4 bg-slate-50 rounded-xl px-4 py-3 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-800">{candidate.full_name}</div>
          <div className="text-xs text-slate-500 mt-0.5">
            {candidate.branches?.name ?? '-'} · {candidate.applied_position}
          </div>
        </div>
        <ToneBadge
          tone={ckl?.is_complete ? 'ok' : 'warn'}
          label={ckl?.is_complete ? 'Selesai' : 'Berlangsung'}
        />
      </div>

      {/* Progress per kolom */}
      <div className="grid grid-cols-3 gap-2 mx-4 mt-3">
        {progress.map(s => (
          <div key={s.key} className={`rounded-xl p-3 text-center ${s.signed ? 'bg-green-50' : 'bg-slate-50'}`}>
            <div className={`text-lg font-bold ${s.signed ? 'text-green-700' : 'text-slate-700'}`}>
              {s.done}/{s.total}
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5">{s.label}</div>
            {s.signed && (
              <div className="text-xs text-green-600 mt-0.5">Signed</div>
            )}
          </div>
        ))}
      </div>

      {/* Inisialisasi jika belum ada */}
      {!ckl && (myKey || isHR) && (
        <div className="mx-4 mt-3">
          <LoadingButton
            loading={saving}
            onClick={initChecklist}
            className="w-full btn-primary text-sm py-2.5"
          >
            Mulai OJT Checklist
          </LoadingButton>
        </div>
      )}

      {/* Tabel checklist */}
      {ckl && (
        <SectionPanel title="Item Checklist" className="mx-4 mt-4">
          {/* Header kolom */}
          <div className="grid grid-cols-[1fr_40px_40px_40px] gap-1 px-4 py-2 border-b border-slate-100">
            <span className="text-xs font-semibold text-slate-500">Item</span>
            {OJT_SIGNERS.map(s => (
              <span key={s.key} className="text-xs font-semibold text-slate-500 text-center">{s.label.split(' ')[0]}</span>
            ))}
          </div>

          {/* Rows */}
          <div className="divide-y divide-slate-50">
            {OJT_ITEMS.map(item => (
              <div key={item.key} className="grid grid-cols-[1fr_40px_40px_40px] gap-1 px-4 py-2.5 items-start">
                <span className="text-xs text-slate-700 leading-relaxed pr-2">{item.label}</span>
                {OJT_SIGNERS.map(s => {
                  const checked = checklist[item.key]?.[s.key] ?? false
                  const isMyCol = myKey === s.key
                  const signed = ckl?.[s.col]

                  return (
                    <div key={s.key} className="flex justify-center pt-0.5">
                      {isMyCol && !signed ? (
                        <button
                          onClick={() => toggleItem(item.key)}
                          className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                            checked
                              ? 'bg-green-500 border-green-500 text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {checked && (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                              <path d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                      ) : (
                        <div className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                          checked
                            ? signed
                              ? 'bg-green-100 border-green-300 text-green-600'
                              : 'bg-green-500 border-green-500 text-white'
                            : 'border-slate-200 bg-slate-50'
                        }`}>
                          {checked && (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                              <path d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>

          {/* Final sign-off button */}
          {myKey && ckl && !ckl[`signed_${myKey}`] && (
            <div className="px-4 pb-3 pt-2">
              <LoadingButton
                loading={signingOff}
                onClick={finalSignOff}
                disabled={!allItemsDone(checklist, myKey)}
                className="w-full btn-primary text-sm py-2.5 disabled:opacity-40"
              >
                Final Sign-Off ({OJT_SIGNERS.find(s => s.key === myKey)?.label})
              </LoadingButton>
              {!allItemsDone(checklist, myKey) && (
                <p className="text-xs text-slate-400 text-center mt-1.5">
                  Tick semua {OJT_ITEMS.length} item terlebih dahulu
                </p>
              )}
            </div>
          )}

          {/* Signed status summary */}
          {progress.some(s => s.signed) && (
            <div className="px-4 pb-3 space-y-1">
              {progress.filter(s => s.signed).map(s => (
                <div key={s.key} className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center">
                    <svg className="w-2.5 h-2.5 text-green-600" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-xs text-slate-600">
                    <strong>{s.label}</strong> sign-off {s.signed_at ? fmtDate(s.signed_at) : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </SectionPanel>
      )}

      {/* HR view — info saja, tidak bisa sign */}
      {isHR && !myKey && ckl && (
        <div className="mx-4 mt-2 mb-4">
          <p className="text-xs text-slate-400 text-center">
            HR hanya bisa melihat. Sign-off dilakukan oleh HS, Trainer, dan Staff.
          </p>
        </div>
      )}

      <div className="h-24" />
      <SmartBottomNav />
    </SubpageShell>
  )
}
