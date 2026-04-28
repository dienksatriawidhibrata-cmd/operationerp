import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { SmartBottomNav } from '../../components/BottomNav'
import {
  AppIcon,
  EmptyPanel,
  HeroCard,
  InlineStat,
  SectionPanel,
  ToneBadge,
} from '../../components/ui/AppKit'
import { POSITION_LABELS } from '../../lib/recruitment'

export default function HRKontrakPage() {
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('candidates')
        .select('id, full_name, phone, email, applied_position, branch_id, created_at, branches(name)')
        .eq('current_stage', 'kontrak_pending')
        .eq('status', 'active')
        .order('created_at', { ascending: true })

      setCandidates(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const withEmail = candidates.filter((candidate) => candidate.email).length
  const missingEmail = candidates.length - withEmail

  return (
    <div className="min-h-screen bg-[#f8fbff] pb-28">
      <div className="sticky top-0 z-50 flex items-center justify-between border-b border-rose-50 bg-white/85 px-5 py-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link
            to="/hr"
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 transition-colors hover:bg-rose-100"
          >
            <AppIcon name="chevronLeft" size={18} />
          </Link>
          <div>
            <h1 className="text-[10px] font-black uppercase tracking-[0.18em] text-rose-600">HR Legal</h1>
            <p className="text-lg font-extrabold text-gray-900">Kontrak Pending</p>
          </div>
        </div>
      </div>

      <div className="px-5 pt-5">
        <HeroCard
          eyebrow="Contract Queue"
          title="Finalisasi kandidat sebelum akun dibuat"
          description="Tahap ini sekarang diposisikan seperti queue final: cek kandidat, lengkapi email jika perlu, lalu buka detail kandidat untuk aktivasi akun dan perpindahan ke OJT."
          meta={(
            <>
              <ToneBadge tone={candidates.length > 0 ? 'warn' : 'ok'}>{candidates.length} kandidat pending</ToneBadge>
              <ToneBadge tone={missingEmail > 0 ? 'warn' : 'ok'}>{missingEmail} email belum ada</ToneBadge>
            </>
          )}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <InlineStat label="Kontrak Pending" value={candidates.length} tone={candidates.length > 0 ? 'amber' : 'emerald'} />
            <InlineStat label="Email Sudah Ada" value={withEmail} tone="primary" />
            <InlineStat label="Perlu Cek Email" value={missingEmail} tone={missingEmail > 0 ? 'rose' : 'emerald'} />
          </div>
        </HeroCard>

        <SectionPanel
          className="mt-6 mb-2"
          eyebrow="Legal Queue"
          title="Daftar Kandidat Menunggu Kontrak"
          description="Buka detail kandidat untuk submit kontrak, membuat akun Supabase Auth, dan otomatis memindahkan kandidat ke tahap OJT."
          actions={<ToneBadge tone={candidates.length > 0 ? 'warn' : 'ok'}>{candidates.length} kandidat</ToneBadge>}
        >
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
            </div>
          ) : candidates.length === 0 ? (
            <EmptyPanel
              title="Tidak ada kontrak pending"
              description="Semua kandidat yang lolos approval sudah diproses atau belum ada yang masuk ke tahap kontrak."
            />
          ) : (
            <div className="space-y-3">
              {candidates.map((candidate) => (
                <Link
                  key={candidate.id}
                  to={`/hr/candidates/${candidate.id}`}
                  className="flex items-center gap-3 rounded-[22px] bg-slate-50/85 px-4 py-4 transition-colors hover:bg-slate-100"
                >
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                    candidate.email ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                  }`}>
                    <AppIcon name="approval" size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-slate-900">{candidate.full_name}</div>
                    <div className="mt-1 truncate text-xs text-slate-500">
                      {candidate.branches?.name || '-'} · {POSITION_LABELS[candidate.applied_position] || candidate.applied_position}
                    </div>
                    <div className="mt-1 truncate text-[11px] text-slate-400">
                      {candidate.phone} · {candidate.email || 'Email akan diisi saat aktivasi'}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <ToneBadge tone={candidate.email ? 'ok' : 'warn'}>
                      {candidate.email ? 'Siap Aktivasi' : 'Butuh Email'}
                    </ToneBadge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </SectionPanel>
      </div>

      <SmartBottomNav />
    </div>
  )
}
