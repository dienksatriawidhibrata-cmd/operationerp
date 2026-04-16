import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { OpsBottomNav } from '../../components/BottomNav'
import {
  HeroCard, InlineStat, SectionPanel, SubpageShell, ToneBadge, EmptyPanel,
} from '../../components/ui/AppKit'
import { todayWIB } from '../../lib/utils'

export default function OpsHub() {
  const { profile } = useAuth()
  const today = todayWIB()

  const [stats, setStats] = useState({
    pendingSetoran: 0,
    ceklisToday: 0,
    activeOrders: 0,
    totalBranches: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchStats() }, [])

  const fetchStats = async () => {
    const [setoranRes, ceklisRes, ordersRes, branchRes] = await Promise.all([
      supabase.from('daily_deposits').select('id', { count: 'exact', head: true }).eq('status', 'submitted'),
      supabase.from('daily_checklists').select('id', { count: 'exact', head: true }).eq('tanggal', today),
      supabase.from('supply_orders').select('id', { count: 'exact', head: true }).not('status', 'in', '("completed","cancelled")'),
      supabase.from('branches').select('id', { count: 'exact', head: true }).eq('is_active', true),
    ])

    setStats({
      pendingSetoran: setoranRes.count ?? 0,
      ceklisToday:   ceklisRes.count ?? 0,
      activeOrders:  ordersRes.count ?? 0,
      totalBranches: branchRes.count ?? 0,
    })
    setLoading(false)
  }

  return (
    <SubpageShell
      title="Toko"
      subtitle="Ringkasan operasional hari ini"
      eyebrow="Ops Manager"
      footer={<OpsBottomNav />}
    >
      <HeroCard
        eyebrow="Selamat Datang"
        title={`Halo, ${profile?.full_name?.split(' ')[0] ?? 'Manager'}`}
        description="Dashboard operasional terpadu. Pantau setoran, ceklis, dan opex seluruh toko dari sini."
        meta={
          <>
            {stats.pendingSetoran > 0 && (
              <ToneBadge tone="warn">{stats.pendingSetoran} setoran pending</ToneBadge>
            )}
            <ToneBadge tone="info">{today}</ToneBadge>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-4">
          <InlineStat label="Toko Aktif"    value={loading ? '—' : stats.totalBranches}  tone="primary" />
          <InlineStat label="Ceklis Hari Ini" value={loading ? '—' : stats.ceklisToday}  tone={stats.ceklisToday > 0 ? 'ok' : 'slate'} />
          <InlineStat label="Setoran Pending" value={loading ? '—' : stats.pendingSetoran} tone={stats.pendingSetoran > 0 ? 'warn' : 'ok'} />
          <InlineStat label="Order SC Aktif" value={loading ? '—' : stats.activeOrders}  tone={stats.activeOrders > 0 ? 'info' : 'slate'} />
        </div>
      </HeroCard>

      <div className="mt-6 space-y-4">
        {/* Quick Actions */}
        <SectionPanel eyebrow="Menu Toko" title="Akses Cepat">
          <div className="grid gap-3 sm:grid-cols-3">
            <Link
              to="/dm/approval"
              className="flex items-center gap-3 rounded-[22px] bg-amber-50 border border-amber-100 px-5 py-4 hover:bg-amber-100 transition-colors"
            >
              <span className="text-2xl">💰</span>
              <div>
                <div className="text-sm font-semibold text-slate-900">Approval Setoran</div>
                <div className="text-xs text-amber-600">
                  {stats.pendingSetoran > 0 ? `${stats.pendingSetoran} perlu review` : 'Semua beres'}
                </div>
              </div>
            </Link>

            <Link
              to="/opex"
              className="flex items-center gap-3 rounded-[22px] bg-slate-100 px-5 py-4 hover:bg-slate-200 transition-colors"
            >
              <span className="text-2xl">📊</span>
              <div>
                <div className="text-sm font-semibold text-slate-900">Opex</div>
                <div className="text-xs text-slate-400">Beban operasional toko</div>
              </div>
            </Link>

            <Link
              to="/dm/visit"
              className="flex items-center gap-3 rounded-[22px] bg-slate-100 px-5 py-4 hover:bg-slate-200 transition-colors"
            >
              <span className="text-2xl">📋</span>
              <div>
                <div className="text-sm font-semibold text-slate-900">Ceklis & Audit</div>
                <div className="text-xs text-slate-400">
                  {stats.ceklisToday > 0 ? `${stats.ceklisToday} ceklis masuk` : 'Audit harian'}
                </div>
              </div>
            </Link>
          </div>
        </SectionPanel>

        {/* Full DM Dashboard shortcut */}
        <SectionPanel eyebrow="Dashboard Lanjut" title="Laporan Lengkap">
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              to="/dm"
              className="flex items-center gap-3 rounded-[22px] bg-primary-50 border border-primary-100 px-5 py-4 hover:bg-primary-100 transition-colors"
            >
              <span className="text-2xl">🏪</span>
              <div>
                <div className="text-sm font-semibold text-slate-900">DM Dashboard</div>
                <div className="text-xs text-primary-600">Ringkasan semua branch, setoran, opex</div>
              </div>
            </Link>
            <Link
              to="/finance"
              className="flex items-center gap-3 rounded-[22px] bg-slate-100 px-5 py-4 hover:bg-slate-200 transition-colors"
            >
              <span className="text-2xl">🧾</span>
              <div>
                <div className="text-sm font-semibold text-slate-900">Audit Finance</div>
                <div className="text-xs text-slate-400">Rekap setoran & audit keuangan</div>
              </div>
            </Link>
          </div>
        </SectionPanel>
      </div>
    </SubpageShell>
  )
}
