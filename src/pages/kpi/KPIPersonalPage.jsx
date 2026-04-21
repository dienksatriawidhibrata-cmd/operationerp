import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { SmartBottomNav } from '../../components/BottomNav'
import {
  SubpageShell, SectionPanel, ToneBadge, EmptyPanel,
} from '../../components/ui/AppKit'
import { currentPeriodWIB, lastNPeriods, periodLabel, roleLabel } from '../../lib/utils'
import {
  KPI_PERSONAL_STORE_TARGET_ROLES,
  canVerifyKpiTarget,
  getKpiVerificationRole,
} from '../../lib/access'
import { getDefaultPersonalItems } from '../../lib/kpiDefaults'

const BASE_VIEW_ROLES = ['barista', 'kitchen', 'waitress', 'asst_head_store']

function gradeInfo(score) {
  if (score >= 4.5) return { label: 'Outstanding', color: 'text-green-700 bg-green-50' }
  if (score >= 3.5) return { label: 'Good', color: 'text-blue-700 bg-blue-50' }
  if (score >= 2.5) return { label: 'Fair', color: 'text-amber-700 bg-amber-50' }
  return { label: 'Needs Improvement', color: 'text-rose-700 bg-rose-50' }
}

function ScoreBar({ value, max = 5 }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div className="h-1.5 rounded-full bg-primary-500 transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-right text-xs font-bold text-slate-700">{value.toFixed(1)}</span>
    </div>
  )
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

async function loadVisiblePeople(profile) {
  if (!profile?.role) return []

  if (BASE_VIEW_ROLES.includes(profile.role)) {
    return [normalizeProfile(profile)]
  }

  if (profile.role === 'head_store') {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, role, branch_id')
      .eq('branch_id', profile.branch_id)
      .in('role', [...BASE_VIEW_ROLES, 'head_store'])
      .eq('is_active', true)
      .order('full_name')
    if (error) throw new Error(error.message || 'Gagal memuat daftar KPI.')
    return (data || []).map((person) => normalizeProfile(person))
  }

  if (profile.role === 'district_manager') {
    const [branchesRes, profilesRes, areaManagersRes] = await Promise.all([
      supabase.from('branches').select('id, district, area').in('district', profile.managed_districts || []),
      supabase.from('profiles').select('id, full_name, role, branch_id, managed_districts, managed_areas')
        .in('role', [...BASE_VIEW_ROLES, 'head_store', 'district_manager'])
        .eq('is_active', true)
        .order('full_name'),
      supabase.from('profiles').select('id, managed_areas')
        .eq('role', 'area_manager')
        .eq('is_active', true),
    ])
    if (branchesRes.error || profilesRes.error || areaManagersRes.error) {
      throw new Error(branchesRes.error?.message || profilesRes.error?.message || areaManagersRes.error?.message || 'Gagal memuat daftar KPI.')
    }
    const branchIds = new Set((branchesRes.data || []).map((branch) => branch.id))
    const scopedProfiles = (profilesRes.data || []).filter((person) => {
      if (person.role === 'district_manager') return person.id === profile.id
      return branchIds.has(person.branch_id)
    })
    return scopedProfiles.map((person) => normalizeProfile(person, {
      has_area_manager: person.role === 'district_manager'
        ? hasAreaManagerForDistrict(branchesRes.data || [], areaManagersRes.data || [], person.managed_districts || [])
        : true,
    }))
  }

  if (profile.role === 'area_manager') {
    const [branchesRes, districtManagersRes, headStoresRes] = await Promise.all([
      supabase.from('branches').select('id, district, area').in('area', profile.managed_areas || []),
      supabase.from('profiles').select('id, full_name, role, managed_districts, managed_areas')
        .eq('role', 'district_manager')
        .eq('is_active', true)
        .order('full_name'),
      supabase.from('profiles').select('id, full_name, role, branch_id')
        .eq('role', 'head_store')
        .eq('is_active', true)
        .order('full_name'),
    ])
    if (branchesRes.error || districtManagersRes.error || headStoresRes.error) {
      throw new Error(branchesRes.error?.message || districtManagersRes.error?.message || headStoresRes.error?.message || 'Gagal memuat daftar KPI.')
    }
    const branchIds = new Set((branchesRes.data || []).map((branch) => branch.id))
    const districts = new Set((branchesRes.data || []).map((branch) => branch.district))
    const districtManagers = (districtManagersRes.data || [])
      .filter((manager) => (manager.managed_districts || []).some((district) => districts.has(district)))
      .map((manager) => normalizeProfile(manager, { has_area_manager: true }))
    const headStores = (headStoresRes.data || [])
      .filter((person) => branchIds.has(person.branch_id))
      .map((person) => normalizeProfile(person, { has_area_manager: true }))
    return [...districtManagers, ...headStores]
  }

  if (profile.role === 'ops_manager' || profile.role === 'support_spv') {
    const [branchesRes, districtManagersRes, headStoresRes, areaManagersRes] = await Promise.all([
      supabase.from('branches').select('id, district, area'),
      supabase.from('profiles').select('id, full_name, role, managed_districts, managed_areas')
        .eq('role', 'district_manager')
        .eq('is_active', true)
        .order('full_name'),
      supabase.from('profiles').select('id, full_name, role, branch_id')
        .eq('role', 'head_store')
        .eq('is_active', true)
        .order('full_name'),
      supabase.from('profiles').select('id, managed_areas')
        .eq('role', 'area_manager')
        .eq('is_active', true),
    ])
    if (branchesRes.error || districtManagersRes.error || headStoresRes.error || areaManagersRes.error) {
      throw new Error(branchesRes.error?.message || districtManagersRes.error?.message || headStoresRes.error?.message || areaManagersRes.error?.message || 'Gagal memuat daftar KPI.')
    }
    const headStores = (headStoresRes.data || []).map((person) => normalizeProfile(person, { has_area_manager: true }))
    const districtManagers = (districtManagersRes.data || []).map((manager) => normalizeProfile(manager, {
      has_area_manager: hasAreaManagerForDistrict(branchesRes.data || [], areaManagersRes.data || [], manager.managed_districts || []),
    }))
    return [...headStores, ...districtManagers]
  }

  if (profile.role === 'trainer') {
    return []
  }

  return []
}

function aggregateScoreRows(items, scores) {
  const byItem = {}
  scores.forEach((row) => {
    if (!byItem[row.item_key]) byItem[row.item_key] = []
    byItem[row.item_key].push(row)
  })

  return items.map((item) => {
    const rows = byItem[item.item_key] || []
    const avgScore = rows.length
      ? rows.reduce((sum, row) => sum + row.score, 0) / rows.length
      : 0
    return { item, rows, avgScore }
  })
}

function expectedEvaluatorRoles(staff) {
  if (KPI_PERSONAL_STORE_TARGET_ROLES.includes(staff.role)) return ['head_store']
  if (staff.role === 'head_store') return ['district_manager', 'support_spv']
  if (staff.role === 'district_manager') {
    return staff.has_area_manager === false
      ? ['ops_manager', 'support_spv']
      : ['area_manager', 'support_spv']
  }
  return []
}

function KPIScorecard({ staff, period, viewerRole, canVerify, onVerified }) {
  const [items, setItems] = useState([])
  const [scores, setScores] = useState([])
  const [evaluatorMap, setEvaluatorMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!staff) return
    const load = async () => {
      setLoading(true)
      setError('')
      const [itemsRes, scoresRes] = await Promise.all([
        supabase.from('kpi_personal_items').select('*').eq('role', staff.role).eq('is_active', true).order('sort_order'),
        supabase.from('kpi_personal_scores').select('item_key, score, notes, verified_at, scored_by')
          .eq('staff_id', staff.id).eq('period_month', period),
      ])
      if (itemsRes.error || scoresRes.error) {
        setItems([])
        setScores([])
        setEvaluatorMap({})
        setError(itemsRes.error?.message || scoresRes.error?.message || 'Gagal memuat KPI personal.')
        setLoading(false)
        return
      }

      const nextScores = scoresRes.data || []
      const scorerIds = [...new Set(nextScores.map((row) => row.scored_by).filter(Boolean))]
      let nextEvaluatorMap = {}
      if (scorerIds.length) {
        const { data: scorers, error: scorerError } = await supabase
          .from('profiles')
          .select('id, full_name, role')
          .in('id', scorerIds)
        if (scorerError) {
          setError(scorerError.message || 'Gagal memuat penilai KPI.')
          setLoading(false)
          return
        }
        nextEvaluatorMap = Object.fromEntries((scorers || []).map((scorer) => [scorer.id, scorer]))
      }

      setItems((itemsRes.data || []).length ? (itemsRes.data || []) : getDefaultPersonalItems(staff.role))
      setScores(nextScores)
      setEvaluatorMap(nextEvaluatorMap)
      setLoading(false)
    }
    load()
  }, [staff, period])

  const aggregated = useMemo(() => aggregateScoreRows(items, scores), [items, scores])
  const isVerified = scores.some((row) => !!row.verified_at)
  const totalWeighted = aggregated.reduce((sum, entry) => sum + entry.avgScore * (entry.item.contribution / 100), 0)
  const grade = gradeInfo(totalWeighted)
  const expectedRoles = expectedEvaluatorRoles(staff)
  const submittedRoles = new Set(
    scores
      .map((row) => evaluatorMap[row.scored_by]?.role)
      .filter(Boolean)
  )
  const readyToVerify = expectedRoles.length > 0 && expectedRoles.every((role) => submittedRoles.has(role))

  const evaluatorGroups = useMemo(() => {
    const grouped = {}
    scores.forEach((row) => {
      if (!grouped[row.scored_by]) grouped[row.scored_by] = []
      grouped[row.scored_by].push(row)
    })
    return Object.entries(grouped).map(([scoredBy, rows]) => ({
      id: scoredBy,
      scorer: evaluatorMap[scoredBy],
      rows,
    }))
  }, [evaluatorMap, scores])

  const handleVerify = async () => {
    setVerifying(true)
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    const { error: verifyError } = await supabase
      .from('kpi_personal_scores')
      .update({ verified_at: new Date().toISOString(), verified_by: user?.id || null })
      .eq('staff_id', staff.id)
      .eq('period_month', period)

    if (verifyError) {
      setError(verifyError.message || 'Gagal memverifikasi KPI.')
      setVerifying(false)
      return
    }

    setVerifying(false)
    onVerified()
  }

  if (loading) return <div className="flex justify-center py-8"><div className="h-7 w-7 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" /></div>
  if (error) return <EmptyPanel title="KPI tidak bisa dimuat" description={error} />
  if (!scores.length) return <EmptyPanel title="Belum ada data KPI" description="Belum ada data KPI untuk periode ini." />

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-primary-100 bg-gradient-to-br from-primary-50 to-white p-5">
        <div className="mb-3 flex items-start justify-between">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Skor KPI Personal</div>
            <div className="mt-1 text-4xl font-black text-primary-800">{totalWeighted.toFixed(2)}<span className="text-lg font-semibold text-primary-400"> / 5</span></div>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${grade.color}`}>{grade.label}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          {isVerified
            ? <ToneBadge tone="ok">Terverifikasi {roleLabel(getKpiVerificationRole(staff.role))}</ToneBadge>
            : <ToneBadge tone="warn">Belum diverifikasi</ToneBadge>}
          <span>{periodLabel(period)}</span>
          <span>{submittedRoles.size}/{expectedRoles.length || submittedRoles.size} penilai selesai</span>
        </div>
      </div>

      {canVerify && !isVerified && (
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
          <div className="text-sm font-semibold text-amber-800">Verifikasi KPI</div>
          <div className="mt-1 text-xs text-amber-700">
            {readyToVerify
              ? `Semua penilai wajib untuk ${roleLabel(staff.role)} sudah mengisi.`
              : `Menunggu input dari: ${expectedRoles.filter((role) => !submittedRoles.has(role)).map(roleLabel).join(', ')}`}
          </div>
          <button
            type="button"
            onClick={handleVerify}
            disabled={!readyToVerify || verifying}
            className="mt-3 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {verifying ? 'Memverifikasi...' : 'Verifikasi KPI'}
          </button>
        </div>
      )}

      <SectionPanel title="Rincian Per Item">
        <div className="divide-y divide-slate-100">
          {aggregated.map(({ item, avgScore, rows }) => (
            <div key={item.item_key} className="px-4 py-3">
              <div className="mb-1.5 flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-slate-800">{item.item_name}</div>
                  <div className="mt-0.5 text-[10px] text-slate-500">{rows.length} input penilai</div>
                </div>
                <span className="ml-2 text-[10px] text-slate-400">{item.contribution}%</span>
              </div>
              <ScoreBar value={avgScore} />
            </div>
          ))}
        </div>
      </SectionPanel>

      {evaluatorGroups.length > 0 && (
        <SectionPanel title={`Input Penilai (${evaluatorGroups.length})`}>
          <div className="divide-y divide-slate-100">
            {evaluatorGroups.map(({ id, scorer, rows }) => (
              <div key={id} className="px-4 py-3">
                <div className="text-xs font-semibold text-slate-800">{scorer?.full_name || 'Penilai'}</div>
                <div className="text-[10px] text-slate-500">{roleLabel(scorer?.role)}</div>
                {rows.some((row) => row.notes) ? (
                  <div className="mt-2 space-y-1">
                    {rows.filter((row) => row.notes).map((row) => (
                      <div key={`${id}-${row.item_key}`} className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
                        <span className="font-semibold">{row.item_key}</span>: {row.notes}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-2 text-xs italic text-slate-400">Tidak ada catatan.</div>
                )}
              </div>
            ))}
          </div>
        </SectionPanel>
      )}

      {!canVerify && canVerifyKpiTarget(viewerRole, staff.role) && !isVerified && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
          Verifikasi untuk role ini dilakukan oleh {roleLabel(getKpiVerificationRole(staff.role))}.
        </div>
      )}
    </div>
  )
}

export default function KPIPersonalPage() {
  const { profile } = useAuth()
  const [period, setPeriod] = useState(currentPeriodWIB())
  const [staffList, setStaffList] = useState([])
  const [selectedStaff, setSelectedStaff] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const loadStaff = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    setError('')
    try {
      const list = await loadVisiblePeople(profile)
      setStaffList(list)
      setSelectedStaff((current) => list.find((person) => person.id === current?.id) || list[0] || null)
    } catch (err) {
      setStaffList([])
      setSelectedStaff(null)
      setError(err.message || 'Gagal memuat daftar staff.')
    } finally {
      setLoading(false)
    }
  }, [profile])

  useEffect(() => { loadStaff() }, [loadStaff, reloadKey])

  const canVerifySelected = selectedStaff ? canVerifyKpiTarget(profile?.role, selectedStaff.role) : false

  return (
    <SubpageShell title="KPI Personal" subtitle="Scorecard penilaian bulanan" eyebrow="KPI Personal" footer={<SmartBottomNav />}>
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-5 pb-32">
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 focus:border-primary-400 focus:outline-none"
        >
          {lastNPeriods(6).map((p) => <option key={p} value={p}>{periodLabel(p)}</option>)}
        </select>

        {staffList.length > 0 && (
          <select
            value={selectedStaff?.id || ''}
            onChange={(e) => setSelectedStaff(staffList.find((staff) => staff.id === e.target.value) || null)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 focus:border-primary-400 focus:outline-none"
          >
            {staffList.map((staff) => (
              <option key={staff.id} value={staff.id}>{staff.full_name} - {roleLabel(staff.role)}</option>
            ))}
          </select>
        )}

        {loading ? (
          <div className="flex justify-center py-10"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" /></div>
        ) : error ? (
          <EmptyPanel title="Daftar staff tidak bisa dimuat" description={error} />
        ) : !selectedStaff ? (
          <EmptyPanel title="Belum ada data KPI" description="Pilih staff untuk melihat KPI." />
        ) : (
          <KPIScorecard
            key={`${selectedStaff.id}-${period}-${reloadKey}`}
            staff={selectedStaff}
            period={period}
            viewerRole={profile?.role}
            canVerify={canVerifySelected}
            onVerified={() => setReloadKey((value) => value + 1)}
          />
        )}
      </div>
    </SubpageShell>
  )
}
