import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import {
  SubpageShell, SectionPanel, ToneBadge, EmptyPanel,
} from '../../components/ui/AppKit'
import { SmartBottomNav } from '../../components/BottomNav'
import { fmtDate } from '../../lib/utils'
import { POSITION_LABELS } from '../../lib/recruitment'

export default function HRKontrakPage() {
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('candidates')
        .select('id, full_name, phone, applied_position, branch_id, created_at, branches(name)')
        .eq('current_stage', 'kontrak_pending')
        .eq('status', 'active')
        .order('created_at', { ascending: true })
      setCandidates(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <SubpageShell title="Kontrak Pending" eyebrow="HR Legal" backTo="/hr">
      <div className="px-4 pt-4">
        <p className="text-xs text-slate-500 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
          Kandidat di bawah telah disetujui HR SPV dan menunggu kontrak dari Legal.
          Setelah submit kontrak, akun Supabase kandidat dibuat otomatis.
        </p>
      </div>

      <SectionPanel className="mx-4 mt-4 mb-24">
        {loading ? (
          <p className="text-xs text-slate-400 px-4 py-3">Memuat...</p>
        ) : candidates.length === 0 ? (
          <EmptyPanel message="Tidak ada kontrak pending" />
        ) : (
          <div className="divide-y divide-slate-100">
            {candidates.map(c => (
              <Link
                key={c.id}
                to={`/hr/candidates/${c.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-slate-50"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-800 truncate">{c.full_name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {c.branches?.name ?? '-'} · {POSITION_LABELS[c.applied_position] ?? c.applied_position}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">{c.phone}</div>
                </div>
                <div className="flex items-center gap-2 ml-3 shrink-0">
                  <ToneBadge tone="warn" label="Kontrak" />
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        )}
      </SectionPanel>

      <SmartBottomNav />
    </SubpageShell>
  )
}
