import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { SmartBottomNav } from '../../components/BottomNav'
import {
  SubpageShell, SectionPanel, ToneBadge, EmptyPanel, AppIcon,
} from '../../components/ui/AppKit'
import { currentPeriodWIB, lastNPeriods, periodLabel, pctToScore, avg360ToScore, roleLabel } from '../../lib/utils'

const INPUT_ROLES = ['barista', 'kitchen', 'waitress', 'asst_head_store']

function ScorePicker({ value, onChange, disabled }) {
  const labels = ['', 'Sangat\nKurang', 'Kurang', 'Cukup', 'Baik', 'Sangat\nBaik']
  return (
    <div className="flex gap-1.5">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onClick={() => !disabled && onChange(n)}
          className={`flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl border py-2 text-xs font-semibold transition-all ${
            value === n
              ? 'border-primary-600 bg-primary-600 text-white shadow-sm'
              : disabled
                ? 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed'
                : 'border-slate-200 bg-white text-slate-600 hover:border-primary-300'
          }`}
        >
          <span className="text-sm font-bold">{n}</span>
          <span className="text-center text-[9px] leading-tight whitespace-pre-line opacity-70">{labels[n]}</span>
        </button>
      ))}
    </div>
  )
}

async function calcAutoValues(branchId, staffId, period) {
  const [y, m] = period.split('-').map(Number)
  const startDate = `${period}-01`
  const endDate = new Date(y, m, 0).toISOString().split('T')[0]

  const [ceklisRes, prepRes, threeSixtyRes] = await Promise.all([
    supabase.from('daily_checklists')
      .select('id', { count: 'exact' })
      .eq('branch_id', branchId)
      .gte('tanggal', startDate).lte('tanggal', endDate),
    supabase.from('daily_preparation')
      .select('id', { count: 'exact' })
      .eq('branch_id', branchId)
      .gte('tanggal', startDate).lte('tanggal', endDate),
    supabase.from('kpi_360_submissions')
      .select('id')
      .eq('evaluatee_id', staffId)
      .eq('period_month', period),
  ])

  const daysInMonth = new Date(y, m, 0).getDate()
  const maxCeklis = daysInMonth * 3
  const maxPrep = daysInMonth * 3
  const ceklisPct = maxCeklis > 0 ? Math.round((ceklisRes.count || 0) / maxCeklis * 100) : 0
  const prepPct = maxPrep > 0 ? Math.round((prepRes.count || 0) / maxPrep * 100) : 0

  let avg360 = 0
  if (threeSixtyRes.data?.length) {
    const subIds = threeSixtyRes.data.map(s => s.id)
    const { data: scores } = await supabase.from('kpi_360_scores')
      .select('score').in('submission_id', subIds)
    if (scores?.length) {
      avg360 = scores.reduce((a, s) => a + s.score, 0) / scores.length
    }
  }

  return {
    auto_checklist: pctToScore(ceklisPct),
    auto_preparation: pctToScore(prepPct),
    auto_360: avg360ToScore(avg360),
    ceklisPct,
    prepPct,
    avg360Raw: avg360,
  }
}

function StaffKPIForm({ staff, period, branchId, items, existingScores, isVerified, onSave, onClose }) {
  const [autoVals, setAutoVals] = useState(null)
  const [scores, setScores] = useState(() =>
    Object.fromEntries(existingScores.map(s => [s.item_key, s.score]))
  )
  const [catatan, setCatatan] = useState(
    () => Object.fromEntries(existingScores.map(s => [s.item_key, s.catatan || '']))
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    calcAutoValues(branchId, staff.id, period).then(setAutoVals)
  }, [branchId, staff.id, period])

  const autoKeys = ['auto_checklist', 'auto_preparation', 'auto_360']

  const mergedScores = { ...scores }
  if (autoVals) {
    if (items.find(i => i.item_key === 'auto_checklist')) mergedScores['auto_checklist'] = autoVals.auto_checklist
    if (items.find(i => i.item_key === 'auto_preparation')) mergedScores['auto_preparation'] = autoVals.auto_preparation
    if (items.find(i => i.item_key === 'auto_360')) mergedScores['auto_360'] = autoVals.auto_360
  }

  const totalWeighted = items.reduce((sum, item) => {
    const s = mergedScores[item.item_key] || 0
    return sum + s * (item.contribution / 100)
  }, 0)

  const allFilled = items.every(i => (mergedScores[i.item_key] || 0) > 0)

  const handleSubmit = async () => {
    if (!allFilled) { setError('Semua item harus diisi.'); return }
    setSaving(true); setError('')
    const { data: { user } } = await supabase.auth.getUser()

    const rows = items.map(item => ({
      staff_id: staff.id,
      branch_id: branchId,
      period_month: period,
      item_key: item.item_key,
      score: mergedScores[item.item_key],
      catatan: catatan[item.item_key]?.trim() || null,
      inputted_by: user.id,
      updated_at: new Date().toISOString(),
    }))

    const { error: err } = await supabase.from('kpi_personal_scores')
      .upsert(rows, { onConflict: 'staff_id,period_month,item_key' })

    if (err) { setError(err.message); setSaving(false); return }
    setSaving(false); onSave()
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-white/60 bg-white/90 backdrop-blur-xl">
        <div className="flex h-[4.4rem] items-center gap-3 px-4">
          <button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500">
            <AppIcon name="chevronLeft" size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Input KPI Personal</div>
            <div className="truncate text-base font-semibold text-slate-900">{staff.full_name}</div>
          </div>
          {isVerified
            ? <ToneBadge tone="ok">Terverifikasi</ToneBadge>
            : <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700">{roleLabel(staff.role)}</span>
          }
        </div>
      </header>

      <div className="flex-1 overflow-y-auto pb-32 px-4 py-4 space-y-4">
        {/* Preview weighted score */}
        {autoVals && (
          <div className="rounded-2xl border border-primary-100 bg-primary-50 p-4">
            <div className="text-xs font-semibold text-primary-700 mb-2">Preview Skor Tertimbang</div>
            <div className="text-3xl font-black text-primary-800">{totalWeighted.toFixed(2)}<span className="text-base font-semibold"> / 5</span></div>
            <div className="mt-2 text-xs text-slate-500 space-y-0.5">
              <div>Ceklis: {autoVals.ceklisPct}% → skor {autoVals.auto_checklist}</div>
              <div>Preparation: {autoVals.prepPct}% → skor {autoVals.auto_preparation}</div>
              <div>360°: avg {autoVals.avg360Raw.toFixed(2)} → skor {autoVals.auto_360}</div>
            </div>
          </div>
        )}

        {items.map((item, idx) => {
          const isAuto = autoKeys.includes(item.item_key)
          const scoreVal = mergedScores[item.item_key] || 0
          return (
            <div key={item.item_key} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="mb-1 flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-slate-900">{item.item_name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{item.cara_penilaian}</div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {isAuto && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-bold text-blue-600">Otomatis</span>}
                  <span className="text-xs font-bold text-slate-400">{item.contribution}%</span>
                </div>
              </div>
              <div className="mt-3">
                <ScorePicker
                  value={scoreVal}
                  onChange={v => setScores(s => ({ ...s, [item.item_key]: v }))}
                  disabled={isAuto || isVerified}
                />
              </div>
              {scoreVal > 0 && (
                <div className="mt-2 text-xs text-slate-500 text-center">
                  {[item.score_1, item.score_2, item.score_3, item.score_4, item.score_5][scoreVal - 1]}
                </div>
              )}
              {!isAuto && !isVerified && (
                <input
                  type="text"
                  value={catatan[item.item_key] || ''}
                  onChange={e => setCatatan(c => ({ ...c, [item.item_key]: e.target.value }))}
                  placeholder="Catatan (opsional)"
                  maxLength={200}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 placeholder:text-slate-400 focus:border-primary-400 focus:outline-none"
                />
              )}
            </div>
          )
        })}

        {error && <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">{error}</div>}
      </div>

      {!isVerified && (
        <div className="fixed bottom-0 inset-x-0 border-t border-slate-100 bg-white/90 backdrop-blur-xl px-4 py-4">
          <button onClick={handleSubmit} disabled={saving || !allFilled || !autoVals}
            className="w-full rounded-2xl bg-primary-600 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-50">
            {saving ? 'Menyimpan...' : existingScores.length ? 'Perbarui KPI' : 'Simpan KPI'}
          </button>
          {!allFilled && <div className="mt-2 text-center text-xs text-slate-400">Isi semua {items.length} item untuk menyimpan</div>}
        </div>
      )}
    </div>
  )
}

export default function KPIPersonalInputPage() {
  const { profile } = useAuth()
  const [period, setPeriod] = useState(currentPeriodWIB())
  const [staff, setStaff] = useState([])
  const [items, setItems] = useState({})
  const [scoreMap, setScoreMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [editTarget, setEditTarget] = useState(null)

  const loadData = useCallback(async () => {
    if (!profile?.branch_id) return
    setLoading(true)

    const [staffRes, baristaRes, kitchenRes, waitressRes, asstRes, scoresRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name, role')
        .eq('branch_id', profile.branch_id).in('role', INPUT_ROLES).eq('is_active', true).order('full_name'),
      supabase.from('kpi_personal_items').select('*').eq('role', 'barista').eq('is_active', true).order('sort_order'),
      supabase.from('kpi_personal_items').select('*').eq('role', 'kitchen').eq('is_active', true).order('sort_order'),
      supabase.from('kpi_personal_items').select('*').eq('role', 'waitress').eq('is_active', true).order('sort_order'),
      supabase.from('kpi_personal_items').select('*').eq('role', 'asst_head_store').eq('is_active', true).order('sort_order'),
      supabase.from('kpi_personal_scores').select('staff_id, item_key, score, catatan, verified_at')
        .eq('branch_id', profile.branch_id).eq('period_month', period),
    ])

    setStaff(staffRes.data || [])
    setItems({
      barista: baristaRes.data || [],
      kitchen: kitchenRes.data || [],
      waitress: waitressRes.data || [],
      asst_head_store: asstRes.data || [],
    })

    const smap = {}
    for (const row of (scoresRes.data || [])) {
      if (!smap[row.staff_id]) smap[row.staff_id] = []
      smap[row.staff_id].push(row)
    }
    setScoreMap(smap)
    setLoading(false)
  }, [profile, period])

  useEffect(() => { loadData() }, [loadData])

  const openEdit = (person) => {
    setEditTarget({
      staff: person,
      existingScores: scoreMap[person.id] || [],
      isVerified: !!(scoreMap[person.id]?.[0]?.verified_at),
    })
  }

  return (
    <>
      <SubpageShell title="Input KPI Personal" subtitle="Penilaian bulanan per staff" eyebrow="KPI Personal" footer={<SmartBottomNav />}>
        <div className="mx-auto max-w-2xl space-y-4 px-4 py-5 pb-32">
          <select value={period} onChange={e => setPeriod(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 focus:border-primary-400 focus:outline-none">
            {lastNPeriods(6).map(p => <option key={p} value={p}>{periodLabel(p)}</option>)}
          </select>

          {loading ? (
            <div className="flex justify-center py-10"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" /></div>
          ) : staff.length === 0 ? (
            <EmptyPanel message="Tidak ada staff yang bisa dinilai di cabang ini." />
          ) : (
            <SectionPanel title={`${staff.length} staff`}>
              <div className="divide-y divide-slate-100">
                {staff.map(person => {
                  const scores = scoreMap[person.id] || []
                  const isVerified = !!(scores[0]?.verified_at)
                  const hasFilled = scores.length > 0
                  return (
                    <button key={person.id} onClick={() => openEdit(person)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary-100 text-primary-700 text-sm font-bold">
                        {person.full_name.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-slate-900">{person.full_name}</div>
                        <div className="text-xs text-slate-500">{roleLabel(person.role)}</div>
                      </div>
                      {isVerified
                        ? <ToneBadge tone="ok">Terverifikasi</ToneBadge>
                        : hasFilled
                          ? <ToneBadge tone="info">Sudah diisi</ToneBadge>
                          : <ToneBadge tone="warn">Belum</ToneBadge>
                      }
                      <AppIcon name="chevronRight" size={16} className="text-slate-400 shrink-0" />
                    </button>
                  )
                })}
              </div>
            </SectionPanel>
          )}

          <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 text-xs text-blue-700 space-y-1">
            <div className="font-semibold">Catatan:</div>
            <div>• Skor ceklis, preparation, dan 360° dihitung otomatis dari data bulan tersebut.</div>
            <div>• KPI yang sudah diverifikasi DM tidak bisa diubah.</div>
            <div>• Batas pengisian: tanggal 5 bulan berikutnya.</div>
          </div>
        </div>
      </SubpageShell>

      {editTarget && (
        <StaffKPIForm
          staff={editTarget.staff}
          period={period}
          branchId={profile.branch_id}
          items={items[editTarget.staff.role] || []}
          existingScores={editTarget.existingScores}
          isVerified={editTarget.isVerified}
          onSave={() => { setEditTarget(null); loadData() }}
          onClose={() => setEditTarget(null)}
        />
      )}
    </>
  )
}
