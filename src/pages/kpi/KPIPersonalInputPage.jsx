import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { SmartBottomNav } from '../../components/BottomNav'
import {
  SubpageShell, SectionPanel, ToneBadge, EmptyPanel, AppIcon,
} from '../../components/ui/AppKit'
import { currentPeriodWIB, lastNPeriods, periodBounds, periodLabel, pctToScore, avg360ToScore, roleLabel } from '../../lib/utils'
import {
  KPI_PERSONAL_STORE_TARGET_ROLES,
  canEvaluateKpiTarget,
  getKpiVerificationRole,
} from '../../lib/access'
import { getDefaultPersonalItems } from '../../lib/kpiDefaults'

const AUTO_SOURCE_TYPES = ['auto_checklist', 'auto_preparation', 'auto_360']

function ScorePicker({ value, onChange, disabled }) {
  const labels = ['', 'Sangat\nKurang', 'Kurang', 'Cukup', 'Baik', 'Sangat\nBaik']
  return (
    <div className="flex gap-1.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onClick={() => !disabled && onChange(n)}
          className={`flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl border py-2 text-xs font-semibold transition-all ${
            value === n
              ? 'border-primary-600 bg-primary-600 text-white shadow-sm'
              : disabled
                ? 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300'
                : 'border-slate-200 bg-white text-slate-600 hover:border-primary-300'
          }`}
        >
          <span className="text-sm font-bold">{n}</span>
          <span className="whitespace-pre-line text-center text-[9px] leading-tight opacity-70">{labels[n]}</span>
        </button>
      ))}
    </div>
  )
}

async function calcAutoValues(branchId, staff, period) {
  const { startDate, endDate, daysInMonth } = periodBounds(period)
  const usePersonalSubmissionTracking = ['staff', 'barista', 'kitchen', 'waitress'].includes(staff?.role)

  let ceklisQuery = supabase.from('daily_checklists')
    .select('id', { count: 'exact', head: true })
    .eq('branch_id', branchId)
    .gte('tanggal', startDate)
    .lte('tanggal', endDate)

  let prepQuery = supabase.from('daily_preparation')
    .select('id', { count: 'exact', head: true })
    .eq('branch_id', branchId)
    .gte('tanggal', startDate)
    .lte('tanggal', endDate)

  if (usePersonalSubmissionTracking && staff?.id) {
    ceklisQuery = ceklisQuery.eq('submitted_by', staff.id)
    prepQuery = prepQuery.eq('submitted_by', staff.id)
  }

  const [ceklisRes, prepRes, threeSixtyRes] = await Promise.all([
    ceklisQuery,
    prepQuery,
    supabase.from('kpi_360_submissions')
      .select('id')
      .eq('evaluatee_id', staff.id)
      .eq('period_month', period),
  ])

  if (ceklisRes.error || prepRes.error || threeSixtyRes.error) {
    throw new Error(ceklisRes.error?.message || prepRes.error?.message || threeSixtyRes.error?.message || 'Gagal menghitung skor otomatis.')
  }

  const maxCeklis = daysInMonth * 3
  const maxPrep = daysInMonth * 3
  const ceklisPct = maxCeklis > 0 ? Math.round(((ceklisRes.count || 0) / maxCeklis) * 100) : 0
  const prepPct = maxPrep > 0 ? Math.round(((prepRes.count || 0) / maxPrep) * 100) : 0

  let avg360 = 0
  if (threeSixtyRes.data?.length) {
    const subIds = threeSixtyRes.data.map((submission) => submission.id)
    const { data: scores, error: scoreError } = await supabase.from('kpi_360_scores')
      .select('score')
      .in('submission_id', subIds)

    if (scoreError) {
      throw new Error(scoreError.message || 'Gagal membaca skor 360.')
    }

    if (scores?.length) {
      avg360 = scores.reduce((sum, score) => sum + score.score, 0) / scores.length
    }
  }

  return {
    checklistScore: pctToScore(ceklisPct),
    preparationScore: pctToScore(prepPct),
    score360: avg360ToScore(avg360),
    ceklisPct,
    prepPct,
    avg360Raw: avg360,
  }
}

function resolveAutoScore(item, autoVals) {
  if (!item?.source_type || !autoVals) return null
  if (item.source_type === 'auto_checklist') return autoVals.checklistScore
  if (item.source_type === 'auto_preparation') return autoVals.preparationScore
  if (item.source_type === 'auto_360') return autoVals.score360
  return null
}

function normalizeProfile(profile, extras = {}) {
  return {
    ...profile,
    branch_id: profile.branch_id || null,
    managed_districts: profile.managed_districts || [],
    managed_areas: profile.managed_areas || [],
    ...extras,
  }
}

function resolveDistrictAreas(branches = [], managedDistricts = []) {
  const districts = new Set(managedDistricts || [])
  return [...new Set(
    branches
      .filter((branch) => districts.has(branch.district))
      .map((branch) => branch.area)
      .filter(Boolean)
  )]
}

function hasAreaManagerForDistrict(branches = [], areaManagers = [], managedDistricts = []) {
  const areas = resolveDistrictAreas(branches, managedDistricts)
  if (!areas.length) return false
  return areaManagers.some((manager) => (manager.managed_areas || []).some((area) => areas.includes(area)))
}

async function loadKpiTargets(profile) {
  if (!profile?.role) return []

  if (profile.role === 'head_store') {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, role, branch_id')
      .eq('branch_id', profile.branch_id)
      .in('role', KPI_PERSONAL_STORE_TARGET_ROLES)
      .eq('is_active', true)
      .order('full_name')
    if (error) throw new Error(error.message || 'Gagal memuat staff toko.')
    return (data || []).map((person) => normalizeProfile(person))
  }

  if (profile.role === 'district_manager') {
    const [branchesRes, headStoreRes, areaManagersRes] = await Promise.all([
      supabase.from('branches').select('id, district, area').in('district', profile.managed_districts || []),
      supabase.from('profiles').select('id, full_name, role, branch_id')
        .eq('role', 'head_store')
        .eq('is_active', true),
      supabase.from('profiles').select('id, managed_areas')
        .eq('role', 'area_manager')
        .eq('is_active', true),
    ])
    if (branchesRes.error || headStoreRes.error || areaManagersRes.error) {
      throw new Error(branchesRes.error?.message || headStoreRes.error?.message || areaManagersRes.error?.message || 'Gagal memuat target KPI.')
    }
    const branchIds = new Set((branchesRes.data || []).map((branch) => branch.id))
    return (headStoreRes.data || [])
      .filter((person) => branchIds.has(person.branch_id))
      .map((person) => normalizeProfile(person, {
        has_area_manager: hasAreaManagerForDistrict(branchesRes.data || [], areaManagersRes.data || [], profile.managed_districts || []),
      }))
  }

  if (profile.role === 'area_manager') {
    const [branchesRes, districtManagersRes] = await Promise.all([
      supabase.from('branches').select('district, area').in('area', profile.managed_areas || []),
      supabase.from('profiles').select('id, full_name, role, managed_districts, managed_areas')
        .eq('role', 'district_manager')
        .eq('is_active', true)
        .order('full_name'),
    ])
    if (branchesRes.error || districtManagersRes.error) {
      throw new Error(branchesRes.error?.message || districtManagersRes.error?.message || 'Gagal memuat target KPI.')
    }
    const allowedDistricts = new Set((branchesRes.data || []).map((branch) => branch.district))
    return (districtManagersRes.data || [])
      .filter((manager) => (manager.managed_districts || []).some((district) => allowedDistricts.has(district)))
      .map((manager) => normalizeProfile(manager, { has_area_manager: true }))
  }

  if (profile.role === 'ops_manager') {
    const [branchesRes, districtManagersRes, areaManagersRes] = await Promise.all([
      supabase.from('branches').select('district, area'),
      supabase.from('profiles').select('id, full_name, role, managed_districts, managed_areas')
        .eq('role', 'district_manager')
        .eq('is_active', true)
        .order('full_name'),
      supabase.from('profiles').select('id, managed_areas')
        .eq('role', 'area_manager')
        .eq('is_active', true),
    ])
    if (branchesRes.error || districtManagersRes.error || areaManagersRes.error) {
      throw new Error(branchesRes.error?.message || districtManagersRes.error?.message || areaManagersRes.error?.message || 'Gagal memuat target KPI.')
    }
    return (districtManagersRes.data || [])
      .map((manager) => normalizeProfile(manager, {
        has_area_manager: hasAreaManagerForDistrict(branchesRes.data || [], areaManagersRes.data || [], manager.managed_districts || []),
      }))
      .filter((manager) => !manager.has_area_manager)
  }

  if (profile.role === 'support_spv') {
    const [headStoreRes, districtManagersRes, branchesRes, areaManagersRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name, role, branch_id')
        .eq('role', 'head_store')
        .eq('is_active', true)
        .order('full_name'),
      supabase.from('profiles').select('id, full_name, role, managed_districts, managed_areas')
        .eq('role', 'district_manager')
        .eq('is_active', true)
        .order('full_name'),
      supabase.from('branches').select('district, area'),
      supabase.from('profiles').select('id, managed_areas')
        .eq('role', 'area_manager')
        .eq('is_active', true),
    ])
    if (headStoreRes.error || districtManagersRes.error || branchesRes.error || areaManagersRes.error) {
      throw new Error(headStoreRes.error?.message || districtManagersRes.error?.message || branchesRes.error?.message || areaManagersRes.error?.message || 'Gagal memuat target KPI.')
    }
    const headStores = (headStoreRes.data || []).map((person) => normalizeProfile(person, { has_area_manager: true }))
    const districtManagers = (districtManagersRes.data || []).map((manager) => normalizeProfile(manager, {
      has_area_manager: hasAreaManagerForDistrict(branchesRes.data || [], areaManagersRes.data || [], manager.managed_districts || []),
    }))
    return [...headStores, ...districtManagers]
  }

  return []
}

async function loadKpiItems(roles = []) {
  const uniqueRoles = [...new Set(roles)].filter(Boolean)
  const itemEntries = await Promise.all(
    uniqueRoles.map(async (role) => {
      const { data, error } = await supabase
        .from('kpi_personal_items')
        .select('*')
        .eq('role', role)
        .eq('is_active', true)
        .order('sort_order')
      if (error) throw new Error(error.message || `Gagal memuat item KPI ${role}.`)
      return [role, (data || []).length ? (data || []) : getDefaultPersonalItems(role)]
    })
  )
  return Object.fromEntries(itemEntries)
}

function evaluatorBadgeText(currentUserId, rows = []) {
  const scorerIds = [...new Set(rows.map((row) => row.scored_by).filter(Boolean))]
  if (!scorerIds.length) return null
  if (scorerIds.includes(currentUserId)) return 'Sudah diisi'
  return `${scorerIds.length} penilai`
}

function TargetKPIForm({ staff, period, branchId, items, existingScores, isVerified, onSave, onClose }) {
  const [autoVals, setAutoVals] = useState(null)
  const [scores, setScores] = useState(() => Object.fromEntries(existingScores.map((score) => [score.item_key, score.score])))
  const [notes, setNotes] = useState(() => Object.fromEntries(existingScores.map((score) => [score.item_key, score.notes || ''])))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const needsAutoValues = !!branchId && items.some((item) => AUTO_SOURCE_TYPES.includes(item.source_type))

  useEffect(() => {
    if (!needsAutoValues) {
      setAutoVals({})
      return undefined
    }

    let active = true
    setAutoVals(null)

    calcAutoValues(branchId, staff, period)
      .then((result) => {
        if (active) setAutoVals(result)
      })
      .catch((err) => {
        if (active) setError(err.message || 'Gagal menghitung skor otomatis.')
      })

    return () => {
      active = false
    }
  }, [branchId, needsAutoValues, period, staff])

  const mergedScores = { ...scores }
  items.forEach((item) => {
    const autoScore = resolveAutoScore(item, autoVals)
    if (autoScore != null) mergedScores[item.item_key] = autoScore
  })

  const totalWeighted = items.reduce((sum, item) => {
    const score = mergedScores[item.item_key] || 0
    return sum + score * (item.contribution / 100)
  }, 0)

  const allFilled = items.every((item) => (mergedScores[item.item_key] || 0) > 0)

  const handleSubmit = async () => {
    if (!allFilled) {
      setError('Semua item harus diisi.')
      return
    }

    setSaving(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    const timestamp = new Date().toISOString()
    const rows = items.map((item) => ({
      staff_id: staff.id,
      branch_id: branchId || null,
      period_month: period,
      item_key: item.item_key,
      score: mergedScores[item.item_key],
      notes: notes[item.item_key]?.trim() || null,
      scored_by: user.id,
      updated_at: timestamp,
    }))

    const { error: deleteError } = await supabase
      .from('kpi_personal_scores')
      .delete()
      .eq('staff_id', staff.id)
      .eq('period_month', period)
      .eq('scored_by', user.id)

    if (deleteError) {
      setError(deleteError.message)
      setSaving(false)
      return
    }

    const { error: insertError } = await supabase
      .from('kpi_personal_scores')
      .insert(rows)

    if (insertError) {
      setError(insertError.message)
      setSaving(false)
      return
    }

    setSaving(false)
    onSave()
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
            : <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700">{roleLabel(staff.role)}</span>}
        </div>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 pb-32">
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-500">Verifier</div>
          <div className="mt-1 text-sm font-semibold text-slate-900">{roleLabel(getKpiVerificationRole(staff.role))}</div>
        </div>

        {autoVals && needsAutoValues && (
          <div className="rounded-2xl border border-primary-100 bg-primary-50 p-4">
            <div className="mb-2 text-xs font-semibold text-primary-700">Preview Skor Tertimbang</div>
            <div className="text-3xl font-black text-primary-800">{totalWeighted.toFixed(2)}<span className="text-base font-semibold"> / 5</span></div>
            <div className="mt-2 space-y-0.5 text-xs text-slate-500">
              <div>Ceklis: {autoVals.ceklisPct}% - skor {autoVals.checklistScore}</div>
              <div>Preparation: {autoVals.prepPct}% - skor {autoVals.preparationScore}</div>
              <div>360: avg {autoVals.avg360Raw.toFixed(2)} - skor {autoVals.score360}</div>
            </div>
          </div>
        )}

        {items.map((item) => {
          const isAuto = AUTO_SOURCE_TYPES.includes(item.source_type)
          const scoreVal = mergedScores[item.item_key] || 0

          return (
            <div key={item.item_key} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="mb-1 flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-slate-900">{item.item_name}</div>
                  <div className="mt-0.5 text-xs text-slate-500">{item.cara_penilaian}</div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {isAuto && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-bold text-blue-600">Otomatis</span>}
                  <span className="text-xs font-bold text-slate-400">{item.contribution}%</span>
                </div>
              </div>

              <div className="mt-3">
                <ScorePicker
                  value={scoreVal}
                  onChange={(value) => setScores((current) => ({ ...current, [item.item_key]: value }))}
                  disabled={isAuto || isVerified}
                />
              </div>

              {scoreVal > 0 && (
                <div className="mt-2 text-center text-xs text-slate-500">
                  {[item.score_1, item.score_2, item.score_3, item.score_4, item.score_5][scoreVal - 1]}
                </div>
              )}

              {!isAuto && !isVerified && (
                <input
                  type="text"
                  value={notes[item.item_key] || ''}
                  onChange={(e) => setNotes((current) => ({ ...current, [item.item_key]: e.target.value }))}
                  placeholder="Catatan (opsional)"
                  maxLength={200}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 placeholder:text-slate-400 focus:border-primary-400 focus:outline-none"
                />
              )}
            </div>
          )
        })}

        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      </div>

      {!isVerified && (
        <div className="fixed inset-x-0 bottom-0 border-t border-slate-100 bg-white/90 px-4 py-4 backdrop-blur-xl">
          <button
            onClick={handleSubmit}
            disabled={saving || !allFilled || (needsAutoValues && !autoVals)}
            className="w-full rounded-2xl bg-primary-600 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-50"
          >
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
  const [error, setError] = useState('')

  const loadData = useCallback(async () => {
    if (!profile?.role) return

    setLoading(true)
    setError('')

    try {
      const targets = await loadKpiTargets(profile)
      const evaluableTargets = targets.filter((target) => canEvaluateKpiTarget(profile.role, target.role, {
        hasAreaManager: target.has_area_manager,
      }))

      const [nextItems, scoresRes] = await Promise.all([
        loadKpiItems(evaluableTargets.map((target) => target.role)),
        evaluableTargets.length
          ? supabase.from('kpi_personal_scores')
            .select('staff_id, item_key, score, notes, verified_at, scored_by')
            .in('staff_id', evaluableTargets.map((target) => target.id))
            .eq('period_month', period)
          : Promise.resolve({ data: [], error: null }),
      ])

      if (scoresRes.error) {
        throw new Error(scoresRes.error.message || 'Gagal memuat skor KPI.')
      }

      const nextScoreMap = {}
      for (const row of scoresRes.data || []) {
        if (!nextScoreMap[row.staff_id]) nextScoreMap[row.staff_id] = []
        nextScoreMap[row.staff_id].push(row)
      }

      setStaff(evaluableTargets)
      setItems(nextItems)
      setScoreMap(nextScoreMap)
    } catch (err) {
      setStaff([])
      setItems({})
      setScoreMap({})
      setError(err.message || 'Gagal memuat data KPI personal.')
    } finally {
      setLoading(false)
    }
  }, [period, profile])

  useEffect(() => {
    loadData()
  }, [loadData])

  const openEdit = (person) => {
    const rows = scoreMap[person.id] || []
    setEditTarget({
      staff: person,
      existingScores: rows.filter((row) => row.scored_by === profile?.id),
      isVerified: rows.some((row) => !!row.verified_at),
    })
  }

  return (
    <>
      <SubpageShell title="Input KPI Personal" subtitle="Penilaian bulanan sesuai role penilai" eyebrow="KPI Personal" footer={<SmartBottomNav />}>
        <div className="mx-auto max-w-2xl space-y-4 px-4 py-5 pb-32">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 focus:border-primary-400 focus:outline-none"
          >
            {lastNPeriods(6).map((value) => <option key={value} value={value}>{periodLabel(value)}</option>)}
          </select>

          {loading ? (
            <div className="flex justify-center py-10"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" /></div>
          ) : error ? (
            <EmptyPanel title="Data KPI tidak bisa dimuat" description={error} />
          ) : staff.length === 0 ? (
            <EmptyPanel title="Tidak ada target KPI" description="Belum ada target yang sesuai dengan scope penilaian kamu." />
          ) : (
            <SectionPanel title={`${staff.length} target penilaian`}>
              <div className="divide-y divide-slate-100">
                {staff.map((person) => {
                  const rows = scoreMap[person.id] || []
                  const isVerified = rows.some((row) => !!row.verified_at)
                  const fillState = evaluatorBadgeText(profile?.id, rows)

                  return (
                    <button
                      key={person.id}
                      onClick={() => openEdit(person)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary-100 text-sm font-bold text-primary-700">
                        {person.full_name.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-slate-900">{person.full_name}</div>
                        <div className="text-xs text-slate-500">{roleLabel(person.role)}</div>
                      </div>
                      {isVerified
                        ? <ToneBadge tone="ok">Terverifikasi</ToneBadge>
                        : fillState
                          ? <ToneBadge tone="info">{fillState}</ToneBadge>
                          : <ToneBadge tone="warn">Belum</ToneBadge>}
                      <AppIcon name="chevronRight" size={16} className="shrink-0 text-slate-400" />
                    </button>
                  )
                })}
              </div>
            </SectionPanel>
          )}

          <div className="space-y-1 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-700">
            <div className="font-semibold">Catatan:</div>
            <div>- KPI store level tetap memakai skor otomatis untuk item checklist, preparation, dan 360.</div>
            <div>- `Head Store` dinilai oleh `District Manager` dan `Support Supervisor`, lalu diverifikasi `Area Manager`.</div>
            <div>- `District Manager` dinilai oleh `Area Manager` dan `Support Supervisor`. Jika tidak punya `Area Manager`, penilaian dilakukan `Ops Manager` dan `Support Supervisor`, lalu diverifikasi `Ops Manager`.</div>
            <div>- KPI yang sudah diverifikasi tidak bisa diubah lagi.</div>
          </div>
        </div>
      </SubpageShell>

      {editTarget && (
        <TargetKPIForm
          staff={editTarget.staff}
          period={period}
          branchId={editTarget.staff.branch_id}
          items={items[editTarget.staff.role] || []}
          existingScores={editTarget.existingScores}
          isVerified={editTarget.isVerified}
          onSave={() => {
            setEditTarget(null)
            loadData()
          }}
          onClose={() => setEditTarget(null)}
        />
      )}
    </>
  )
}
