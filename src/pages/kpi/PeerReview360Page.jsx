import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { SmartBottomNav } from '../../components/BottomNav'
import {
  SubpageShell, SectionPanel, SegmentedControl, ToneBadge, EmptyPanel, AppIcon,
} from '../../components/ui/AppKit'
import { currentPeriodWIB, lastNPeriods, periodLabel, roleLabel } from '../../lib/utils'

const STORE_360_ROLES = ['barista', 'kitchen', 'waitress', 'asst_head_store', 'head_store']

function ScorePicker({ value, onChange }) {
  const labels = ['', 'Sangat\nKurang', 'Kurang', 'Cukup', 'Baik', 'Sangat\nBaik']
  return (
    <div className="flex gap-1.5">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={`flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl border py-2 text-xs font-semibold transition-all ${
            value === n
              ? 'border-primary-600 bg-primary-600 text-white shadow-sm'
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

async function fetchStoreColleagues(profile) {
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('branch_id', profile.branch_id)
    .in('role', STORE_360_ROLES)
    .eq('is_active', true)
    .neq('id', profile.id)
    .order('full_name')
  return data || []
}

async function fetchManagerColleagues(profile) {
  if (profile.role === 'head_store') {
    const { data: branch } = await supabase
      .from('branches').select('district, area').eq('id', profile.branch_id).single()
    if (!branch) return []
    const [dmsRes, amsRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name, role').eq('role', 'district_manager')
        .contains('managed_districts', [branch.district]).eq('is_active', true),
      supabase.from('profiles').select('id, full_name, role').eq('role', 'area_manager')
        .contains('managed_areas', [branch.area]).eq('is_active', true),
    ])
    return [...(dmsRes.data || []), ...(amsRes.data || [])]
  }
  if (profile.role === 'district_manager') {
    const { data: branches } = await supabase.from('branches').select('id')
      .in('district', profile.managed_districts || [])
    const ids = (branches || []).map(b => b.id)
    const [hsRes, amsRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name, role').eq('role', 'head_store')
        .in('branch_id', ids).eq('is_active', true).order('full_name'),
      supabase.from('profiles').select('id, full_name, role').eq('role', 'area_manager')
        .eq('is_active', true).order('full_name'),
    ])
    return [...(hsRes.data || []), ...(amsRes.data || [])]
  }
  if (profile.role === 'area_manager') {
    const { data: branches } = await supabase.from('branches').select('id')
      .in('area', profile.managed_areas || [])
    const ids = (branches || []).map(b => b.id)
    const [hsRes, dmsRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name, role').eq('role', 'head_store')
        .in('branch_id', ids).eq('is_active', true).order('full_name'),
      supabase.from('profiles').select('id, full_name, role').eq('role', 'district_manager')
        .eq('is_active', true).order('full_name'),
    ])
    return [...(hsRes.data || []), ...(dmsRes.data || [])]
  }
  return []
}

function EvalForm({ evaluatee, items, existingSubmission, existingScores, period, groupType, branchId, onSave, onClose }) {
  const [scores, setScores] = useState(() => {
    if (existingScores?.length) {
      return Object.fromEntries(existingScores.map(s => [s.item_key, s.score]))
    }
    return items.reduce((a, i) => ({ ...a, [i.item_key]: 0 }), {})
  })
  const [catatan, setCatatan] = useState(existingSubmission?.catatan || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const allFilled = items.every(i => scores[i.item_key] > 0)

  const handleSubmit = async () => {
    if (!allFilled) { setError('Semua item harus diisi.'); return }
    setSaving(true); setError('')
    const { data: { user } } = await supabase.auth.getUser()
    const subPayload = {
      evaluator_id: user.id,
      evaluatee_id: evaluatee.id,
      group_type: groupType,
      period_month: period,
      catatan: catatan.trim() || null,
      updated_at: new Date().toISOString(),
    }
    if (branchId) subPayload.branch_id = branchId
    const { data: sub, error: subErr } = await supabase
      .from('kpi_360_submissions')
      .upsert(subPayload, { onConflict: 'evaluator_id,evaluatee_id,period_month' })
      .select('id').single()
    if (subErr) { setError(subErr.message); setSaving(false); return }
    const { error: scErr } = await supabase.from('kpi_360_scores')
      .upsert(items.map(i => ({ submission_id: sub.id, item_key: i.item_key, score: scores[i.item_key] })),
        { onConflict: 'submission_id,item_key' })
    if (scErr) { setError(scErr.message); setSaving(false); return }
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
            <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Penilaian 360°</div>
            <div className="truncate text-base font-semibold text-slate-900">{evaluatee.full_name}</div>
          </div>
          <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700">{roleLabel(evaluatee.role)}</span>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto pb-32 px-4 py-4 space-y-4">
        {items.map((item, idx) => (
          <div key={item.item_key} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="mb-1 flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-slate-900">{item.item_name}</div>
                <div className="text-xs text-slate-500 mt-0.5">{item.description}</div>
              </div>
              <span className="shrink-0 text-xs font-bold text-slate-400">{idx + 1}/{items.length}</span>
            </div>
            <div className="mt-3">
              <ScorePicker value={scores[item.item_key]} onChange={v => setScores(s => ({ ...s, [item.item_key]: v }))} />
            </div>
            {scores[item.item_key] > 0 && (
              <div className="mt-2 text-xs text-slate-500 text-center">
                {[item.score_1, item.score_2, item.score_3, item.score_4, item.score_5][scores[item.item_key] - 1]}
              </div>
            )}
          </div>
        ))}
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="text-sm font-semibold text-slate-900 mb-1">Catatan / Keluh Kesah</div>
          <div className="text-xs text-slate-500 mb-2">Opsional. Bersifat anonim. Maks. 1000 karakter.</div>
          <textarea
            value={catatan}
            onChange={e => { if (e.target.value.length <= 1000) setCatatan(e.target.value) }}
            rows={4}
            placeholder="Tulis catatan, masukan, atau keluhan..."
            className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-primary-400 focus:outline-none"
          />
          <div className="mt-1 text-right text-xs text-slate-400">{catatan.length}/1000</div>
        </div>
        {error && <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">{error}</div>}
      </div>
      <div className="fixed bottom-0 inset-x-0 border-t border-slate-100 bg-white/90 backdrop-blur-xl px-4 py-4">
        <button onClick={handleSubmit} disabled={saving || !allFilled}
          className="w-full rounded-2xl bg-primary-600 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-50">
          {saving ? 'Menyimpan...' : existingSubmission ? 'Perbarui Penilaian' : 'Kirim Penilaian'}
        </button>
        {!allFilled && <div className="mt-2 text-center text-xs text-slate-400">Isi semua {items.length} item untuk mengirim</div>}
      </div>
    </div>
  )
}

export default function PeerReview360Page() {
  const { profile } = useAuth()
  const [period, setPeriod] = useState(currentPeriodWIB())
  const [group, setGroup] = useState('store')
  const [items, setItems] = useState([])
  const [colleagues, setColleagues] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [evalTarget, setEvalTarget] = useState(null)
  const [error, setError] = useState('')

  const isHeadStore = profile?.role === 'head_store'
  const isManagerOnly = ['district_manager', 'area_manager'].includes(profile?.role)
  const groupType = isManagerOnly ? 'manager' : group

  const loadData = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    setError('')
    const [itemsRes, colleaguesData, subsRes] = await Promise.all([
      supabase.from('kpi_360_items').select('*').eq('group_type', groupType).eq('is_active', true).order('sort_order'),
      groupType === 'store' ? fetchStoreColleagues(profile) : fetchManagerColleagues(profile),
      supabase.from('kpi_360_submissions').select('id, evaluatee_id, catatan')
        .eq('evaluator_id', profile.id).eq('period_month', period).eq('group_type', groupType),
    ])
    if (itemsRes.error || subsRes.error) {
      setItems([])
      setColleagues([])
      setSubmissions([])
      setError(itemsRes.error?.message || subsRes.error?.message || 'Gagal memuat data penilaian 360.')
      setLoading(false)
      return
    }
    setItems(itemsRes.data || [])
    setColleagues(colleaguesData)
    setSubmissions(subsRes.data || [])
    setLoading(false)
  }, [profile, groupType, period])

  useEffect(() => { loadData() }, [loadData])

  const openEval = async (person) => {
    const existing = submissions.find(s => s.evaluatee_id === person.id)
    let existingScores = []
    if (existing) {
      const { data } = await supabase.from('kpi_360_scores').select('item_key, score').eq('submission_id', existing.id)
      existingScores = data || []
    }
    setEvalTarget({ person, existingSubmission: existing || null, existingScores })
  }

  const subMap = Object.fromEntries(submissions.map(s => [s.evaluatee_id, s]))

  return (
    <>
      <SubpageShell title="Penilaian 360°" subtitle="Nilai rekan kerja secara anonim" eyebrow="KPI Personal" footer={<SmartBottomNav />}>
        <div className="mx-auto max-w-2xl space-y-4 px-4 py-5 pb-32">
          <select value={period} onChange={e => setPeriod(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 focus:border-primary-400 focus:outline-none">
            {lastNPeriods(6).map(p => <option key={p} value={p}>{periodLabel(p)}</option>)}
          </select>

          {isHeadStore && (
            <SegmentedControl
              options={[{ key: 'store', label: 'Grup Toko' }, { key: 'manager', label: 'Grup Manager' }]}
              value={group} onChange={setGroup}
            />
          )}

          {loading ? (
            <div className="flex justify-center py-10"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" /></div>
          ) : error ? (
            <EmptyPanel title="Penilaian 360 tidak bisa dimuat" description={error} />
          ) : colleagues.length === 0 ? (
            <EmptyPanel title="Belum ada rekan untuk dinilai" description="Tidak ada rekan yang bisa dinilai untuk periode ini." />
          ) : (
            <SectionPanel title={`${colleagues.length} rekan kerja`}>
              <div className="divide-y divide-slate-100">
                {colleagues.map(person => (
                  <button key={person.id} onClick={() => openEval(person)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary-100 text-primary-700 text-sm font-bold">
                      {person.full_name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-slate-900">{person.full_name}</div>
                      <div className="text-xs text-slate-500">{roleLabel(person.role)}</div>
                    </div>
                    {subMap[person.id] ? <ToneBadge tone="ok">Sudah dinilai</ToneBadge> : <ToneBadge tone="warn">Belum</ToneBadge>}
                    <AppIcon name="chevronRight" size={16} className="text-slate-400 shrink-0" />
                  </button>
                ))}
              </div>
            </SectionPanel>
          )}

          <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 text-xs text-blue-700 space-y-1">
            <div className="font-semibold">Catatan penting:</div>
            <div>• Penilaian bersifat anonim — nama penilai tidak ditampilkan ke yang dinilai.</div>
            <div>• Kamu tidak bisa menilai diri sendiri.</div>
            <div>• Batas pengisian: tanggal 5 bulan berikutnya.</div>
          </div>
        </div>
      </SubpageShell>

      {evalTarget && (
        <EvalForm
          evaluatee={evalTarget.person} items={items}
          existingSubmission={evalTarget.existingSubmission} existingScores={evalTarget.existingScores}
          period={period} groupType={groupType} branchId={profile?.branch_id}
          onSave={() => { setEvalTarget(null); loadData() }}
          onClose={() => setEvalTarget(null)}
        />
      )}
    </>
  )
}
