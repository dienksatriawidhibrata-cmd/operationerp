import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { todayWIB } from '../../lib/utils'
import { getBranchShifts } from '../../lib/constants'
import { useToast } from '../../contexts/ToastContext'
import { StaffBottomNav } from '../../components/BottomNav'
import {
  AppIcon,
  EmptyPanel,
  InlineStat,
  SectionPanel,
  SubpageShell,
} from '../../components/ui/AppKit'

const DAY_LABELS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
const MONTH_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agt','Sep','Okt','Nov','Des']

function getWeekDays(anchor) {
  const d = new Date(anchor + 'T12:00:00')
  const dow = d.getDay()
  const monday = new Date(d)
  monday.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1))
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(monday)
    dd.setDate(monday.getDate() + i)
    return dd.toISOString().slice(0, 10)
  })
}

function fmtDay(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`
}

function shiftColor(shiftType) {
  if (!shiftType || shiftType === 'DAY OFF') return 'text-slate-400'
  if (shiftType.startsWith('OPENING'))  return 'text-blue-600'
  if (shiftType.startsWith('MIDDLE'))   return 'text-violet-600'
  if (shiftType.startsWith('CLOSING'))  return 'text-rose-600'
  return 'text-primary-600'
}

export default function JadwalShift() {
  const { profile } = useAuth()
  const { toastSuccess, toastError } = useToast()
  const today = todayWIB()
  const branchId = profile?.branch_id
  const branchName = profile?.branch?.name || ''

  const shifts = getBranchShifts(branchName)

  const [weekDays, setWeekDays] = useState(() => getWeekDays(today))
  const [activeDay, setActiveDay] = useState(today)
  const [staff, setStaff] = useState([])
  const [scheduleMap, setScheduleMap] = useState({})  // key: `staffId:date`
  const [pendingMap, setPendingMap] = useState({})    // key: staffId → shiftType (unsaved for activeDay)
  const [loadingStaff, setLoadingStaff] = useState(true)
  const [loadingSchedule, setLoadingSchedule] = useState(true)
  const [saving, setSaving] = useState(false)

  // Adjust activeDay when week changes (keep same weekday index or reset to Monday)
  useEffect(() => {
    if (!weekDays.includes(activeDay)) {
      setActiveDay(weekDays[0])
    }
  }, [weekDays])

  useEffect(() => {
    if (!branchId) return
    fetchStaff()
  }, [branchId])

  useEffect(() => {
    if (!branchId) return
    fetchSchedule()
  }, [branchId, weekDays])

  // Populate pendingMap from scheduleMap whenever activeDay changes
  useEffect(() => {
    if (staff.length === 0) return
    const next = {}
    staff.forEach((s) => {
      const key = `${s.id}:${activeDay}`
      next[s.id] = scheduleMap[key]?.shift_type || ''
    })
    setPendingMap(next)
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
    if (data) {
      data.forEach((row) => {
        map[`${row.staff_id}:${row.tanggal}`] = row
      })
    }
    setScheduleMap(map)
    setLoadingSchedule(false)
  }

  const prevWeek = () => {
    const prev = new Date(weekDays[0] + 'T12:00:00')
    prev.setDate(prev.getDate() - 7)
    setWeekDays(getWeekDays(prev.toISOString().slice(0, 10)))
  }

  const nextWeek = () => {
    const next = new Date(weekDays[6] + 'T12:00:00')
    next.setDate(next.getDate() + 7)
    setWeekDays(getWeekDays(next.toISOString().slice(0, 10)))
  }

  const handleShiftChange = (staffId, shiftType) => {
    setPendingMap((prev) => ({ ...prev, [staffId]: shiftType }))
  }

  const isDirty = staff.some((s) => {
    const saved = scheduleMap[`${s.id}:${activeDay}`]?.shift_type || ''
    return (pendingMap[s.id] || '') !== saved
  })

  const handleSave = async () => {
    setSaving(true)

    const shiftHourMap = Object.fromEntries(shifts.map((s) => [s.shift, s.hour]))
    const rows = staff
      .filter((s) => pendingMap[s.id])
      .map((s) => ({
        branch_id:  branchId,
        staff_id:   s.id,
        tanggal:    activeDay,
        shift_type: pendingMap[s.id],
        shift_hour: shiftHourMap[pendingMap[s.id]] || null,
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
      toastError('Gagal menyimpan jadwal: ' + error.message)
    } else {
      toastSuccess('Jadwal berhasil disimpan.')
      await fetchSchedule()
    }
    setSaving(false)
  }

  // Summary per shift for activeDay
  const shiftSummary = {}
  staff.forEach((s) => {
    const st = pendingMap[s.id] || ''
    if (st) shiftSummary[st] = (shiftSummary[st] || 0) + 1
  })
  const assignedCount = Object.values(shiftSummary).reduce((a, b) => a + b, 0)
  const weekLabel = `${fmtDay(weekDays[0])} – ${fmtDay(weekDays[6])}`

  return (
    <SubpageShell
      title="Jadwal Shift"
      subtitle={`${branchName.replace('Bagi Kopi ', '')} · ${weekLabel}`}
      eyebrow="People — Jadwal"
      footer={<StaffBottomNav />}
    >
      {/* Week navigator */}
      <div className="flex items-center gap-2 mb-5">
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

      {/* Day tabs */}
      <div className="mb-5 grid grid-cols-7 gap-1">
        {weekDays.map((day, idx) => {
          const isActive = day === activeDay
          const isToday  = day === today
          const d = new Date(day + 'T12:00:00')
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
              <span className="text-[10px] font-semibold leading-none">{DAY_LABELS[idx]}</span>
              <span className={`mt-1 text-[13px] font-black leading-none ${isActive ? '' : isToday ? '' : ''}`}>
                {d.getDate()}
              </span>
            </button>
          )
        })}
      </div>

      {/* Stats */}
      <SectionPanel eyebrow="Ringkasan" title={`Jadwal ${fmtDay(activeDay)}`}>
        <div className="grid gap-3 grid-cols-3">
          <InlineStat label="Total Staff" value={staff.length} tone="primary" />
          <InlineStat label="Terjadwal" value={assignedCount} tone={assignedCount === staff.length ? 'emerald' : 'warn'} />
          <InlineStat label="Belum" value={staff.length - assignedCount} tone={staff.length - assignedCount > 0 ? 'warn' : 'emerald'} />
        </div>
        {Object.keys(shiftSummary).length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(shiftSummary).map(([st, cnt]) => (
              <span key={st} className={`rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold ${shiftColor(st)}`}>
                {st} ({cnt})
              </span>
            ))}
          </div>
        )}
      </SectionPanel>

      {/* Staff list */}
      <div className="mt-5">
        <SectionPanel eyebrow="Staff" title="Atur Shift">
          {loadingStaff || loadingSchedule ? (
            <p className="text-sm text-slate-400">Memuat...</p>
          ) : staff.length === 0 ? (
            <EmptyPanel title="Tidak ada staff aktif" description="Belum ada staff aktif di cabang ini." />
          ) : (
            <div className="space-y-2">
              {staff.map((s) => {
                const currentShift = pendingMap[s.id] || ''
                const savedShift = scheduleMap[`${s.id}:${activeDay}`]?.shift_type || ''
                const changed = currentShift !== savedShift
                return (
                  <div key={s.id} className="flex items-center gap-3 rounded-[18px] bg-slate-50 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{s.full_name}</p>
                      <p className="text-[10px] text-slate-400 capitalize">{s.role.replace(/_/g, ' ')}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {changed && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" title="Belum disimpan" />}
                      <select
                        className="input py-1.5 text-xs w-36"
                        value={currentShift}
                        onChange={(e) => handleShiftChange(s.id, e.target.value)}
                      >
                        <option value="">— Pilih —</option>
                        {shifts.map((sh) => (
                          <option key={sh.shift} value={sh.shift}>
                            {sh.shift}{sh.hour ? ` (${sh.hour})` : ''}
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

      {/* Save button */}
      {staff.length > 0 && (
        <div className="mt-5">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !isDirty}
            className={`w-full rounded-2xl py-3.5 text-sm font-bold transition-colors ${
              isDirty
                ? 'bg-primary-600 text-white hover:bg-primary-700 active:scale-[0.98]'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            {saving ? 'Menyimpan...' : isDirty ? `Simpan Jadwal ${fmtDay(activeDay)}` : 'Jadwal Tersimpan'}
          </button>
        </div>
      )}
    </SubpageShell>
  )
}
