import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { todayWIB } from '../../lib/utils'
import { getBranchShifts } from '../../lib/constants'
import { useToast } from '../../contexts/ToastContext'
import { SmartBottomNav } from '../../components/BottomNav'
import { getScopeLabel, isManagerRole } from '../../lib/access'
import {
  AppIcon,
  EmptyPanel,
  InlineStat,
  SectionPanel,
  SubpageShell,
} from '../../components/ui/AppKit'

const DAY_LABELS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des']

function getWeekDays(anchor) {
  const d = new Date(`${anchor}T12:00:00`)
  const dow = d.getDay()
  const monday = new Date(d)
  monday.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1))
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday)
    day.setDate(monday.getDate() + index)
    return day.toISOString().slice(0, 10)
  })
}

function fmtDay(dateStr) {
  const date = new Date(`${dateStr}T12:00:00`)
  return `${date.getDate()} ${MONTH_SHORT[date.getMonth()]}`
}

function shiftColor(shiftType) {
  if (!shiftType || shiftType === 'DAY OFF') return 'text-slate-400'
  if (shiftType.startsWith('OPENING')) return 'text-blue-600'
  if (shiftType.startsWith('MIDDLE')) return 'text-violet-600'
  if (shiftType.startsWith('CLOSING')) return 'text-rose-600'
  return 'text-primary-600'
}

export default function JadwalShift() {
  const { profile } = useAuth()
  const { toastSuccess, toastError } = useToast()
  const today = todayWIB()
  const isManager = isManagerRole(profile?.role)

  const [branches, setBranches] = useState([])
  const [selectedBranchId, setSelectedBranchId] = useState(profile?.branch_id || '')
  const [weekDays, setWeekDays] = useState(() => getWeekDays(today))
  const [activeDay, setActiveDay] = useState(today)
  const [staff, setStaff] = useState([])
  const [scheduleMap, setScheduleMap] = useState({})
  const [pendingMap, setPendingMap] = useState({})
  const [loadingStaff, setLoadingStaff] = useState(true)
  const [loadingSchedule, setLoadingSchedule] = useState(true)
  const [saving, setSaving] = useState(false)

  const branchId = isManager ? selectedBranchId : profile?.branch_id
  const selectedBranch = isManager
    ? branches.find((branch) => branch.id === selectedBranchId)
    : profile?.branch
  const branchName = selectedBranch?.name || ''
  const shifts = getBranchShifts(branchName)
  const scopeLabel = useMemo(() => getScopeLabel(profile, branches), [branches, profile])

  useEffect(() => {
    if (!isManager || !profile?.role) return

    const loadBranches = async () => {
      let branchQuery = supabase.from('branches').select('id,name,district,area').eq('is_active', true)
      if (profile.role === 'district_manager') {
        branchQuery = branchQuery.in('district', profile.managed_districts || [])
      } else if (profile.role === 'area_manager') {
        branchQuery = branchQuery.in('area', profile.managed_areas || [])
      }

      const { data } = await branchQuery.order('name')
      const rows = data || []
      setBranches(rows)
      if (!selectedBranchId && rows.length > 0) {
        setSelectedBranchId(rows[0].id)
      }
    }

    loadBranches()
  }, [isManager, profile?.managed_areas, profile?.managed_districts, profile?.role, selectedBranchId])

  useEffect(() => {
    if (!weekDays.includes(activeDay)) {
      setActiveDay(weekDays[0])
    }
  }, [activeDay, weekDays])

  useEffect(() => {
    if (!branchId) {
      setStaff([])
      setScheduleMap({})
      setPendingMap({})
      setLoadingStaff(false)
      setLoadingSchedule(false)
      return
    }

    fetchStaff()
  }, [branchId])

  useEffect(() => {
    if (!branchId) return
    fetchSchedule()
  }, [branchId, weekDays])

  useEffect(() => {
    if (staff.length === 0) return
    const nextPendingMap = {}
    staff.forEach((member) => {
      const key = `${member.id}:${activeDay}`
      nextPendingMap[member.id] = scheduleMap[key]?.shift_type || ''
    })
    setPendingMap(nextPendingMap)
  }, [activeDay, scheduleMap, staff])

  const fetchStaff = async () => {
    setLoadingStaff(true)
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .in('role', ['staff', 'barista', 'kitchen', 'waitress', 'asst_head_store', 'head_store'])
      .order('full_name')

    setStaff(data || [])
    setLoadingStaff(false)
  }

  const fetchSchedule = async () => {
    setLoadingSchedule(true)
    const [from, to] = [weekDays[0], weekDays[6]]
    const { data } = await supabase
      .from('shift_schedules')
      .select('staff_id, tanggal, shift_type, shift_hour')
      .eq('branch_id', branchId)
      .gte('tanggal', from)
      .lte('tanggal', to)

    const map = {}
    ;(data || []).forEach((row) => {
      map[`${row.staff_id}:${row.tanggal}`] = row
    })
    setScheduleMap(map)
    setLoadingSchedule(false)
  }

  const prevWeek = () => {
    const prev = new Date(`${weekDays[0]}T12:00:00`)
    prev.setDate(prev.getDate() - 7)
    setWeekDays(getWeekDays(prev.toISOString().slice(0, 10)))
  }

  const nextWeek = () => {
    const next = new Date(`${weekDays[6]}T12:00:00`)
    next.setDate(next.getDate() + 7)
    setWeekDays(getWeekDays(next.toISOString().slice(0, 10)))
  }

  const handleShiftChange = (staffId, shiftType) => {
    setPendingMap((prev) => ({ ...prev, [staffId]: shiftType }))
  }

  const isDirty = staff.some((member) => {
    const saved = scheduleMap[`${member.id}:${activeDay}`]?.shift_type || ''
    return (pendingMap[member.id] || '') !== saved
  })

  const handleSave = async () => {
    setSaving(true)

    const shiftHourMap = Object.fromEntries(shifts.map((shift) => [shift.shift, shift.hour]))
    const rows = staff
      .filter((member) => pendingMap[member.id])
      .map((member) => ({
        branch_id: branchId,
        staff_id: member.id,
        tanggal: activeDay,
        shift_type: pendingMap[member.id],
        shift_hour: shiftHourMap[pendingMap[member.id]] || null,
        created_by: profile.id,
      }))

    if (rows.length === 0) {
      setSaving(false)
      return
    }

    const { error } = await supabase
      .from('shift_schedules')
      .upsert(rows, { onConflict: 'branch_id,staff_id,tanggal' })

    if (error) {
      toastError(`Gagal menyimpan jadwal: ${error.message}`)
    } else {
      toastSuccess('Jadwal berhasil disimpan.')
      await fetchSchedule()
    }
    setSaving(false)
  }

  const shiftSummary = {}
  staff.forEach((member) => {
    const shift = pendingMap[member.id] || ''
    if (shift) shiftSummary[shift] = (shiftSummary[shift] || 0) + 1
  })

  const assignedCount = Object.values(shiftSummary).reduce((total, count) => total + count, 0)
  const weekLabel = `${fmtDay(weekDays[0])} - ${fmtDay(weekDays[6])}`

  return (
    <SubpageShell
      title="Jadwal Shift"
      subtitle={`${(branchName || 'Pilih toko').replace('Bagi Kopi ', '')} - ${weekLabel}`}
      eyebrow="People - Jadwal"
      footer={<SmartBottomNav />}
    >
      {isManager && (
        <SectionPanel
          eyebrow="Scope"
          title="Pilih Toko"
          description={`Kamu sedang mengatur jadwal untuk ${scopeLabel}. Pilih toko yang ingin diedit dari daftar di bawah.`}
        >
          <select
            className="input"
            value={selectedBranchId}
            onChange={(event) => setSelectedBranchId(event.target.value)}
          >
            {!branches.length && <option value="">Belum ada toko dalam scope</option>}
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name.replace('Bagi Kopi ', '')} - {branch.district}
              </option>
            ))}
          </select>
        </SectionPanel>
      )}

      <div className={`flex items-center gap-2 ${isManager ? 'mt-5' : ''} mb-5`}>
        <button
          type="button"
          onClick={prevWeek}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
        >
          <AppIcon name="chevronLeft" size={16} />
        </button>
        <div className="flex-1 text-center text-sm font-bold text-slate-800">{weekLabel}</div>
        <button
          type="button"
          onClick={nextWeek}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
        >
          <AppIcon name="chevronRight" size={16} />
        </button>
      </div>

      <div className="mb-5 grid grid-cols-7 gap-1">
        {weekDays.map((day, index) => {
          const isActive = day === activeDay
          const isToday = day === today
          const date = new Date(`${day}T12:00:00`)
          return (
            <button
              key={day}
              type="button"
              onClick={() => setActiveDay(day)}
              className={`flex flex-col items-center rounded-2xl py-2.5 transition-colors ${
                isActive
                  ? 'bg-primary-600 text-white shadow-sm'
                  : isToday
                    ? 'bg-primary-50 text-primary-700'
                    : 'bg-white text-slate-500 hover:bg-slate-50'
              }`}
            >
              <span className="text-[10px] font-semibold leading-none">{DAY_LABELS[index]}</span>
              <span className="mt-1 text-[13px] font-black leading-none">{date.getDate()}</span>
            </button>
          )
        })}
      </div>

      <SectionPanel eyebrow="Ringkasan" title={`Jadwal ${fmtDay(activeDay)}`}>
        <div className="grid grid-cols-3 gap-3">
          <InlineStat label="Total Staff" value={staff.length} tone="primary" />
          <InlineStat label="Terjadwal" value={assignedCount} tone={assignedCount === staff.length ? 'emerald' : 'amber'} />
          <InlineStat label="Belum" value={staff.length - assignedCount} tone={staff.length - assignedCount > 0 ? 'amber' : 'emerald'} />
        </div>
        {Object.keys(shiftSummary).length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(shiftSummary).map(([shift, count]) => (
              <span key={shift} className={`rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold ${shiftColor(shift)}`}>
                {shift} ({count})
              </span>
            ))}
          </div>
        )}
      </SectionPanel>

      <div className="mt-5">
        <SectionPanel eyebrow="Staff" title="Atur Shift">
          {!branchId ? (
            <EmptyPanel title="Pilih toko terlebih dahulu" description="Daftar staff dan jadwal akan muncul setelah toko dipilih." />
          ) : loadingStaff || loadingSchedule ? (
            <p className="text-sm text-slate-400">Memuat...</p>
          ) : staff.length === 0 ? (
            <EmptyPanel title="Tidak ada staff aktif" description="Belum ada staff aktif di cabang ini." />
          ) : (
            <div className="space-y-2">
              {staff.map((member) => {
                const currentShift = pendingMap[member.id] || ''
                const savedShift = scheduleMap[`${member.id}:${activeDay}`]?.shift_type || ''
                const changed = currentShift !== savedShift

                return (
                  <div key={member.id} className="flex items-center gap-3 rounded-[18px] bg-slate-50 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">{member.full_name}</p>
                      <p className="text-[10px] capitalize text-slate-400">{member.role.replace(/_/g, ' ')}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {changed && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" title="Belum disimpan" />}
                      <select
                        className="input w-36 py-1.5 text-xs"
                        value={currentShift}
                        onChange={(event) => handleShiftChange(member.id, event.target.value)}
                      >
                        <option value="">- Pilih -</option>
                        {shifts.map((shift) => (
                          <option key={shift.shift} value={shift.shift}>
                            {shift.shift}{shift.hour ? ` (${shift.hour})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </SectionPanel>
      </div>

      {staff.length > 0 && branchId && (
        <div className="mt-5">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !isDirty}
            className={`w-full rounded-2xl py-3.5 text-sm font-bold transition-colors ${
              isDirty
                ? 'bg-primary-600 text-white hover:bg-primary-700 active:scale-[0.98]'
                : 'cursor-not-allowed bg-slate-100 text-slate-400'
            }`}
          >
            {saving ? 'Menyimpan...' : isDirty ? `Simpan Jadwal ${fmtDay(activeDay)}` : 'Jadwal Tersimpan'}
          </button>
        </div>
      )}
    </SubpageShell>
  )
}
