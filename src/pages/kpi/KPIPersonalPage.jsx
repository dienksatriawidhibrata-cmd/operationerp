import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { SmartBottomNav } from '../../components/BottomNav'
import {
  SubpageShell, SectionPanel, ToneBadge, EmptyPanel, AppIcon,
} from '../../components/ui/AppKit'
import { currentPeriodWIB, lastNPeriods, periodLabel, roleLabel } from '../../lib/utils'

const VIEW_ROLES = ['barista', 'kitchen', 'waitress', 'asst_head_store']
const MANAGER_ROLES = ['district_manager', 'area_manager', 'ops_manager']

function gradeInfo(score) {
  if (score >= 4.5) return { label: 'Outstanding', tone: 'ok', color: 'text-green-700 bg-green-50' }
  if (score >= 3.5) return { label: 'Good', tone: 'ok', color: 'text-blue-700 bg-blue-50' }
  if (score >= 2.5) return { label: 'Fair', tone: 'warn', color: 'text-amber-700 bg-amber-50' }
  return { label: 'Needs Improvement', tone: 'err', color: 'text-rose-700 bg-rose-50' }
}

function ScoreBar({ value, max = 5 }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-1.5 rounded-full bg-primary-500 transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-right text-xs font-bold text-slate-700">{value.toFixed(1)}</span>
    </div>
  )
}

function KPIScorecard({ staff, period, branchId, isOpsManager }) {
  const [items, setItems] = useState([])
  const [scores, setScores] = useState([])
  const [feedbacks, setFeedbacks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!staff) return
    const load = async () => {
      setLoading(true)
      const [itemsRes, scoresRes, subRes] = await Promise.all([
        supabase.from('kpi_personal_items').select('*').eq('role', staff.role).eq('is_active', true).order('sort_order'),
        supabase.from('kpi_personal_scores').select('item_key, score, catatan, verified_at, inputted_by')
          .eq('staff_id', staff.id).eq('period_month', period),
        supabase.from('kpi_360_submissions').select('id, catatan, evaluator_id')
          .eq('evaluatee_id', staff.id).eq('period_month', period),
      ])
      setItems(itemsRes.data || [])
      setScores(scoresRes.data || [])

      const subs = subRes.data || []
      if (subs.length && isOpsManager) {
        const evalIds = subs.map(s => s.evaluator_id)
        const { data: evalProfiles } = await supabase.from('profiles').select('id, full_name').in('id', evalIds)
        const evalMap = Object.fromEntries((evalProfiles || []).map(p => [p.id, p.full_name]))
        setFeedbacks(subs.map(s => ({ ...s, evaluator_name: evalMap[s.evaluator_id] || 'Anonim' })))
      } else {
        setFeedbacks(subs.map(s => ({ ...s, evaluator_name: 'Anonim' })))
      }
      setLoading(false)
    }
    load()
  }, [staff, period, isOpsManager])

  if (loading) return <div className="flex justify-center py-8"><div className="h-7 w-7 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" /></div>
  if (!scores.length) return <EmptyPanel message="Belum ada data KPI untuk periode ini." />

  const scoreMap = Object.fromEntries(scores.map(s => [s.item_key, s]))
  const isVerified = !!(scores[0]?.verified_at)
  const totalWeighted = items.reduce((sum, item) => {
    const s = scoreMap[item.item_key]?.score || 0
    return sum + s * (item.contribution / 100)
  }, 0)
  const grade = gradeInfo(totalWeighted)

  return (
    <div className="space-y-4">
      {/* Summary card */}
      <div className="rounded-2xl border border-primary-100 bg-gradient-to-br from-primary-50 to-white p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Skor KPI Personal</div>
            <div className="text-4xl font-black text-primary-800 mt-1">{totalWeighted.toFixed(2)}<span className="text-lg font-semibold text-primary-400"> / 5</span></div>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${grade.color}`}>{grade.label}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          {isVerified
            ? <ToneBadge tone="ok">Terverifikasi DM</ToneBadge>
            : <ToneBadge tone="warn">Belum diverifikasi</ToneBadge>
          }
          <span>·</span>
          <span>{periodLabel(period)}</span>
        </div>
      </div>

      {/* Items */}
      <SectionPanel title="Rincian Per Item">
        <div className="divide-y divide-slate-100">
          {items.map(item => {
            const s = scoreMap[item.item_key]
            const score = s?.score || 0
            const isAuto = ['auto_checklist', 'auto_preparation', 'auto_360'].includes(item.item_key)
            return (
              <div key={item.item_key} className="px-4 py-3">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-slate-800">{item.item_name}</div>
                    {s?.catatan && <div className="text-[10px] text-slate-500 mt-0.5 italic">"{s.catatan}"</div>}
                  </div>
                  <div className="flex items-center gap-1.5 ml-2 shrink-0">
                    {isAuto && <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[8px] font-bold text-blue-600">Auto</span>}
                    <span className="text-[10px] text-slate-400">{item.contribution}%</span>
                  </div>
                </div>
                <ScoreBar value={score} />
              </div>
            )
          })}
        </div>
      </SectionPanel>

      {/* 360° feedback */}
      {feedbacks.length > 0 && (
        <SectionPanel title={`Feedback 360° (${feedbacks.length} penilaian)`}>
          <div className="divide-y divide-slate-100">
            {feedbacks.map((fb, i) => (
              <div key={fb.id} className="px-4 py-3">
                <div className="text-[10px] font-semibold text-slate-400 mb-1">
                  {isOpsManager ? fb.evaluator_name : `Penilai ${i + 1}`}
                </div>
                {fb.catatan
                  ? <p className="text-xs text-slate-700 leading-relaxed">"{fb.catatan}"</p>
                  : <p className="text-xs text-slate-400 italic">Tidak ada catatan</p>
                }
              </div>
            ))}
          </div>
        </SectionPanel>
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

  const isOwnView = VIEW_ROLES.includes(profile?.role)
  const isHeadStore = profile?.role === 'head_store'
  const isManager = MANAGER_ROLES.includes(profile?.role)
  const isOpsManager = profile?.role === 'ops_manager'
  const canPickStaff = isHeadStore || isManager || ['support_spv', 'trainer'].includes(profile?.role)

  const loadStaff = useCallback(async () => {
    if (!profile) return
    if (isOwnView) {
      setSelectedStaff(profile)
      setLoading(false)
      return
    }
    setLoading(true)

    let query = supabase.from('profiles').select('id, full_name, role, branch_id')
      .in('role', VIEW_ROLES).eq('is_active', true).order('full_name')

    if (isHeadStore) {
      query = query.eq('branch_id', profile.branch_id)
    } else if (profile?.role === 'district_manager') {
      const { data: branches } = await supabase.from('branches').select('id')
        .in('district', profile.managed_districts || [])
      const ids = (branches || []).map(b => b.id)
      query = query.in('branch_id', ids)
    } else if (profile?.role === 'area_manager') {
      const { data: branches } = await supabase.from('branches').select('id')
        .in('area', profile.managed_areas || [])
      const ids = (branches || []).map(b => b.id)
      query = query.in('branch_id', ids)
    }

    const { data } = await query
    const list = data || []
    setStaffList(list)
    if (list.length) setSelectedStaff(list[0])
    setLoading(false)
  }, [profile, isOwnView, isHeadStore])

  useEffect(() => { loadStaff() }, [loadStaff])

  return (
    <SubpageShell title="KPI Personal" subtitle="Scorecard penilaian bulanan" eyebrow="KPI Personal" footer={<SmartBottomNav />}>
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-5 pb-32">
        <select value={period} onChange={e => setPeriod(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 focus:border-primary-400 focus:outline-none">
          {lastNPeriods(6).map(p => <option key={p} value={p}>{periodLabel(p)}</option>)}
        </select>

        {canPickStaff && staffList.length > 0 && (
          <select value={selectedStaff?.id || ''}
            onChange={e => setSelectedStaff(staffList.find(s => s.id === e.target.value) || null)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 focus:border-primary-400 focus:outline-none">
            {staffList.map(s => (
              <option key={s.id} value={s.id}>{s.full_name} — {roleLabel(s.role)}</option>
            ))}
          </select>
        )}

        {loading ? (
          <div className="flex justify-center py-10"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" /></div>
        ) : !selectedStaff ? (
          <EmptyPanel message="Pilih staff untuk melihat KPI." />
        ) : (
          <KPIScorecard
            staff={selectedStaff}
            period={period}
            branchId={selectedStaff.branch_id || profile?.branch_id}
            isOpsManager={isOpsManager}
          />
        )}
      </div>
    </SubpageShell>
  )
}
