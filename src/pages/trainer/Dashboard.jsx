import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { SmartBottomNav } from '../../components/BottomNav'
import { AppIcon } from '../../components/ui/AppKit'
import { todayWIB } from '../../lib/utils'

const QUADRANT_COLORS = {
  'Consistent Star': 'emerald', 'Future Star': 'emerald', 'Rough Diamond': 'primary',
  'Current Star': 'primary',    'Key Player': 'primary',  'Inconsistent Player': 'orange',
  'High Professional': 'orange','Solid Professional': 'orange', 'Talent Risk': 'rose',
}

export default function TrainerDashboard() {
  const { profile, signOut } = useAuth()
  const today = todayWIB()

  const [stats, setStats] = useState({
    totalNew: 0, lulus: 0, training: 0, pertimbangkan: 0,
    totalExisting: 0, byQuadrant: {},
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchStats() }, [])

  const fetchStats = async () => {
    const [newRes, existingRes] = await Promise.all([
      supabase.from('trainer_new_staff').select('status'),
      supabase.from('trainer_existing_staff').select('quadrant'),
    ])

    const newRows = newRes.data || []
    const existRows = existingRes.data || []

    const byQuadrant = {}
    existRows.forEach(r => {
      if (r.quadrant) byQuadrant[r.quadrant] = (byQuadrant[r.quadrant] || 0) + 1
    })

    setStats({
      totalNew:      newRows.length,
      lulus:         newRows.filter(r => r.status === 'Lulus Siap Ke Store').length,
      training:      newRows.filter(r => r.status === 'Training').length,
      pertimbangkan: newRows.filter(r => r.status === 'Pertimbangkan').length,
      totalExisting: existRows.length,
      byQuadrant,
    })
    setLoading(false)
  }

  const topQuadrants = Object.entries(stats.byQuadrant)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)

  const shortName = profile?.full_name?.split(' ')[0] ?? 'Trainer'

  const quickActions = [
    { to: '/trainer/staff-baru', icon: 'users', label: 'Staff\nBaru' },
    { to: '/trainer/staff-lama', icon: 'matrix', label: 'Staff\nLama' },
    { to: '/trainer/oje', icon: 'star', label: 'OJE\nPenilaian' },
    { to: '/kpi', icon: 'chart', label: 'KPI\nToko' },
    { to: '/sop', icon: 'checklist', label: 'Panduan\nSOP' },
  ]

  return (
    <div className="min-h-screen bg-[#fdfeff] pb-28">
      {/* Header */}
      <div className="p-6 flex justify-between items-center bg-white border-b border-blue-50">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg">
            <AppIcon name="users" size={22} />
          </div>
          <div>
            <h1 className="text-[10px] text-indigo-600 font-bold uppercase tracking-widest">Training Lead</h1>
            <p className="font-extrabold text-gray-900 text-lg">{shortName}</p>
          </div>
        </div>
        <button onClick={signOut} className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 hover:bg-indigo-100 transition-colors">
          <AppIcon name="logout" size={18} />
        </button>
      </div>

      <div className="px-5 pt-6">
        {/* Training Overview */}
        <div className="bg-indigo-50 p-5 rounded-[2.5rem] border border-indigo-100 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xs font-black text-indigo-900 uppercase">Status Pelatihan</h2>
            <div className="flex items-center gap-1">
              <div className="w-6 h-6 rounded-full bg-indigo-200 flex items-center justify-center">
                <AppIcon name="users" size={12} />
              </div>
              <span className="text-[10px] text-indigo-600 font-bold">
                {loading ? '-' : stats.totalNew + stats.totalExisting} staff
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-white p-3 rounded-2xl text-center shadow-sm">
              <p className="text-[8px] font-bold text-gray-400 uppercase mb-1">Onboarding</p>
              <p className="text-2xl font-black text-indigo-700">{loading ? '-' : String(stats.training).padStart(2, '0')}</p>
              <p className="text-[7px] text-gray-500 leading-tight">Masih Training</p>
            </div>
            <div className="bg-white p-3 rounded-2xl text-center shadow-sm">
              <p className="text-[8px] font-bold text-gray-400 uppercase mb-1">Lulus</p>
              <p className="text-2xl font-black text-indigo-700">{loading ? '-' : String(stats.lulus).padStart(2, '0')}</p>
              <p className="text-[7px] text-gray-500 leading-tight">Siap Ke Store</p>
            </div>
            <div className="bg-white p-3 rounded-2xl text-center shadow-sm">
              <p className="text-[8px] font-bold text-gray-400 uppercase mb-1">Review</p>
              <p className="text-2xl font-black text-red-500">{loading ? '-' : String(stats.pertimbangkan).padStart(2, '0')}</p>
              <p className="text-[7px] text-gray-500 leading-tight">Pertimbangkan</p>
            </div>
          </div>

          <div className="bg-white/60 p-3 rounded-2xl flex items-center justify-between">
            <div>
              <p className="text-[9px] font-bold text-indigo-900">Total Assessees</p>
              <p className="text-xs text-indigo-700 font-medium">Staff Baru + Lama</p>
            </div>
            <span className="text-xl font-black text-indigo-900">
              {loading ? '-' : stats.totalNew + stats.totalExisting}
            </span>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {quickActions.map((action) => (
            <Link key={action.to} to={action.to} className="flex flex-col items-center gap-2">
              <div className="w-14 h-14 bg-white border border-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm active:scale-95 transition-transform">
                <AppIcon name={action.icon} size={22} />
              </div>
              <span className="text-[9px] font-bold text-center leading-tight text-gray-700">
                {action.label.split('\n').map((l, i) => <span key={i}>{l}{i === 0 ? <br /> : ''}</span>)}
              </span>
            </Link>
          ))}
        </div>

        {/* KPI Stats Cards */}
        <div className="flex gap-3 mb-6">
          <div className="flex-1 bg-white p-4 rounded-3xl border-b-4 border-blue-400 shadow-sm">
            <p className="text-[9px] text-gray-400 font-bold uppercase mb-1">Staff Lulus</p>
            <div className="flex items-end justify-between">
              <h4 className="text-2xl font-black text-indigo-900">{loading ? '-' : stats.lulus}</h4>
              <span className="text-[8px] text-green-500 font-bold mb-1">Bulan Ini</span>
            </div>
          </div>
          <div className="flex-1 bg-indigo-600 p-4 rounded-3xl text-white shadow-lg">
            <p className="text-[9px] text-indigo-100 font-bold uppercase mb-1">Staff Lama</p>
            <div className="flex items-end justify-between">
              <h4 className="text-2xl font-black">{loading ? '-' : stats.totalExisting}</h4>
              <AppIcon name="matrix" size={16} className="mb-1 opacity-80" />
            </div>
            <p className="text-[8px] mt-1 opacity-80">Sudah dinilai (9-box)</p>
          </div>
        </div>

        {/* Quadrant distribution (if data available) */}
        {topQuadrants.length > 0 && (
          <div className="mb-6">
            <h2 className="font-extrabold text-gray-800 text-sm mb-3">Distribusi 9-Box Staff Lama</h2>
            <div className="grid grid-cols-2 gap-3">
              {topQuadrants.map(([q, count]) => (
                <div key={q} className="bg-white p-3 rounded-2xl border border-indigo-50 flex items-center gap-3 shadow-sm">
                  <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 shrink-0">
                    <span className="text-sm font-black">{count}</span>
                  </div>
                  <p className="text-[10px] font-bold text-gray-700 leading-tight">{q}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notice Board */}
        <div className="bg-gradient-to-r from-indigo-700 to-blue-500 p-5 rounded-[2rem] text-white relative overflow-hidden shadow-lg">
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-white/20 text-[8px] font-bold px-2 py-0.5 rounded uppercase">Info</span>
            </div>
            <h3 className="font-bold text-sm mb-1">Akses Penilaian Staff</h3>
            <p className="text-[10px] opacity-90 leading-relaxed">
              Gunakan Staff Baru untuk onboarding, Staff Lama untuk 9-box assessment, dan OJE untuk penilaian lapangan harian.
            </p>
          </div>
          <AppIcon name="users" size={72} className="absolute -right-4 -bottom-4 opacity-10" />
        </div>
      </div>

      <SmartBottomNav />
    </div>
  )
}
