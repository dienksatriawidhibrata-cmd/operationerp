import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { todayWIB } from '../../lib/utils'
import { SmartBottomNav } from '../../components/BottomNav'
import {
  EmptyPanel,
  SectionPanel,
  SubpageShell,
  ToneBadge,
} from '../../components/ui/AppKit'

// ── Accordion ─────────────────────────────────────────────

function AccordionRow({ label, icon, statusBadge, isOpen, onToggle, loading, children }) {
  return (
    <div className="overflow-hidden rounded-[22px] border border-white/85 bg-white shadow-[0_8px_24px_-16px_rgba(15,23,42,0.2)]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-slate-50/60"
      >
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-base">{icon}</span>
        <span className="flex-1 text-sm font-semibold text-slate-900">{label}</span>
        {statusBadge}
        <span className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {isOpen && (
        <div className="border-t border-slate-100 px-4 py-4">
          {loading ? (
            <div className="flex justify-center py-6">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
            </div>
          ) : children}
        </div>
      )}
    </div>
  )
}

// ── Visit history helpers ─────────────────────────────────

function computeDaysAgo(dateStr) {
  if (!dateStr) return null
  const today = new Date(todayWIB() + 'T00:00:00Z')
  const visit = new Date(dateStr + 'T00:00:00Z')
  return Math.floor((today - visit) / (1000 * 60 * 60 * 24))
}

function daysLabel(days) {
  if (days === null) return 'Belum pernah'
  if (days === 0) return 'Hari ini'
  if (days === 1) return '1 hari lalu'
  return `${days} hari lalu`
}

function daysToTone(days) {
  if (days === null) return 'slate'
  if (days === 0) return 'ok'
  if (days <= 7) return 'info'
  if (days <= 14) return 'warn'
  return 'danger'
}

// ── Riwayat content ───────────────────────────────────────

function RiwayatContent({ branches, history }) {
  if (!branches.length) {
    return <EmptyPanel title="Tidak ada toko" description="Tidak ada toko dalam scope kamu." />
  }

  return (
    <div className="space-y-2">
      {branches.map((branch) => {
        const last = history[branch.id]
        const days = computeDaysAgo(last?.tanggal)
        const tone = daysToTone(days)

        return (
          <div key={branch.id} className="flex items-center gap-3 rounded-[18px] bg-slate-50 px-3 py-2.5">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-slate-800">
                {branch.name.replace('Bagi Kopi ', '')}
              </span>
              <span className="text-[11px] text-slate-400">{branch.store_id}</span>
            </span>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
              <ToneBadge tone={tone}>{daysLabel(days)}</ToneBadge>
              {last?.tanggal && (
                <span className="text-[10px] text-slate-400">
                  {new Date(last.tanggal + 'T00:00:00Z').toLocaleDateString('id-ID', {
                    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
                  })}
                </span>
              )}
              {last?.grade && (
                <ToneBadge tone={tone === 'ok' || tone === 'info' ? 'ok' : tone === 'warn' ? 'warn' : 'danger'}>
                  {last.grade}
                </ToneBadge>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────

export default function VisitHub() {
  const { profile } = useAuth()
  const isAM = profile?.role === 'area_manager'

  const [branches, setBranches] = useState([])
  const [riwayatOpen, setRiwayatOpen] = useState(false)
  const [riwayatLoaded, setRiwayatLoaded] = useState(false)
  const [riwayatLoading, setRiwayatLoading] = useState(false)
  const [history, setHistory] = useState({}) // branchId → { tanggal, grade }

  // ── Fetch branches ────────────────────────────────────────

  useEffect(() => {
    if (!profile?.id) return
    const fetchBranches = async () => {
      let q = supabase.from('branches').select('id,name,store_id,district,area').eq('is_active', true)
      if (profile.role === 'district_manager') q = q.in('district', profile.managed_districts || [])
      else if (profile.role === 'area_manager') q = q.in('area', profile.managed_areas || [])
      const { data } = await q.order('name')
      setBranches(data || [])
    }
    fetchBranches()
  }, [profile?.id, profile?.role])

  // ── Lazy-load riwayat ─────────────────────────────────────

  const loadRiwayat = useCallback(async () => {
    if (riwayatLoaded || riwayatLoading || !branches.length || !profile?.id) return
    setRiwayatLoading(true)

    const ids = branches.map((b) => b.id)
    const { data } = await supabase
      .from('daily_visits')
      .select('branch_id,tanggal,total_score,grade')
      .eq('auditor_id', profile.id)
      .in('branch_id', ids)
      .order('tanggal', { ascending: false })

    const map = {}
    ;(data || []).forEach((v) => {
      if (!map[v.branch_id]) map[v.branch_id] = v
    })

    setHistory(map)
    setRiwayatLoaded(true)
    setRiwayatLoading(false)
  }, [branches, profile?.id, riwayatLoaded, riwayatLoading])

  const toggleRiwayat = () => {
    const next = !riwayatOpen
    setRiwayatOpen(next)
    if (next) loadRiwayat()
  }

  // ── Derived stats ─────────────────────────────────────────

  const visitedCount = Object.keys(history).length
  const neverCount = branches.length - visitedCount

  // ── Render ────────────────────────────────────────────────

  return (
    <SubpageShell
      title="Visit"
      subtitle="Audit dan pantau kunjungan toko"
      eyebrow="Store Visit"
      footer={<SmartBottomNav />}
    >
      <SectionPanel eyebrow="Pilihan" title="Menu Visit">
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            to="/dm/visit"
            className="flex items-center gap-3 rounded-[22px] border border-primary-100 bg-primary-50 px-5 py-4 transition-colors hover:bg-primary-100"
          >
            <span className="text-2xl">📋</span>
            <div>
              <div className="text-sm font-semibold text-slate-900">Lakukan Audit Visit</div>
              <div className="text-xs text-primary-600">Audit toko hari ini</div>
            </div>
          </Link>

          {isAM && (
            <Link
              to="/ops/visits"
              className="flex items-center gap-3 rounded-[22px] border border-blue-100 bg-blue-50 px-5 py-4 transition-colors hover:bg-blue-100"
            >
              <span className="text-2xl">🗺️</span>
              <div>
                <div className="text-sm font-semibold text-slate-900">Laporan Visit DM</div>
                <div className="text-xs text-blue-600">Pantau kunjungan DM bawahan</div>
              </div>
            </Link>
          )}
        </div>
      </SectionPanel>

      <div className="mt-4 space-y-3">
        <AccordionRow
          label="Riwayat Kunjunganku"
          icon="🗓️"
          statusBadge={
            riwayatLoaded ? (
              <ToneBadge tone={neverCount > 0 ? 'warn' : 'ok'}>
                {visitedCount}/{branches.length} toko
              </ToneBadge>
            ) : null
          }
          isOpen={riwayatOpen}
          onToggle={toggleRiwayat}
          loading={riwayatLoading}
        >
          <RiwayatContent branches={branches} history={history} />
        </AccordionRow>
      </div>
    </SubpageShell>
  )
}
