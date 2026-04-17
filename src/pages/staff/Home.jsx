import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { StaffBottomNav } from '../../components/BottomNav'
import {
  ActionCard,
  AppIcon,
  HeroCard,
  InlineStat,
  SectionPanel,
  SubpageShell,
  ToneBadge,
} from '../../components/ui/AppKit'
import { fmtRp, todayWIB, yesterdayWIB, sisaWaktuLaporan } from '../../lib/utils'
import Alert from '../../components/Alert'

export default function StaffHome() {
  const { profile, signOut } = useAuth()
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)

  const today = todayWIB()
  const yesterday = yesterdayWIB()

  useEffect(() => {
    if (!profile?.branch_id) {
      setLoading(false)
      return
    }
    fetchStatus()
  }, [profile])

  const fetchStatus = async () => {
    const branchId = profile.branch_id

    const [ceklisPagi, ceklisMalam, laporan, opexToday] = await Promise.all([
      supabase.from('daily_checklists')
        .select('id, is_late, submitted_at')
        .eq('branch_id', branchId).eq('tanggal', today).eq('shift', 'pagi')
        .maybeSingle(),

      supabase.from('daily_checklists')
        .select('id, is_late')
        .eq('branch_id', branchId).eq('tanggal', today).eq('shift', 'malam')
        .maybeSingle(),

      supabase.from('daily_reports')
        .select('id, submitted_at, is_late')
        .eq('branch_id', branchId).eq('tanggal', yesterday)
        .maybeSingle(),

      supabase.from('operational_expenses')
        .select('total')
        .eq('branch_id', branchId).eq('tanggal', today),
    ])

    const totalOpex = (opexToday.data || []).reduce((sum, row) => sum + Number(row.total), 0)

    setStatus({
      ceklisPagi: ceklisPagi.data,
      ceklisMalam: ceklisMalam.data,
      laporan: laporan.data,
      totalOpex,
    })
    setLoading(false)
  }

  const isStoreLevel = ['staff', 'asst_head_store', 'head_store'].includes(profile?.role)
  const shortName = profile?.full_name?.split(' ')[0] || '-'
  const branchName = profile?.branch?.name || 'Bagi Kopi'
  const greetingLabel = getGreetingLabel()

  const statCards = [
    {
      label: 'Ceklis Pagi',
      value: status?.ceklisPagi ? (status.ceklisPagi.is_late ? 'Late' : 'Done') : 'Miss',
      tone: status?.ceklisPagi ? (status.ceklisPagi.is_late ? 'amber' : 'emerald') : 'rose',
    },
    {
      label: 'Ceklis Malam',
      value: status?.ceklisMalam ? 'Done' : 'Open',
      tone: status?.ceklisMalam ? 'emerald' : 'slate',
    },
    {
      label: 'Laporan H-1',
      value: status?.laporan ? 'Done' : 'Pending',
      tone: status?.laporan ? 'emerald' : 'amber',
    },
    {
      label: 'Opex Hari Ini',
      value: fmtRp(status?.totalOpex || 0),
      tone: status?.totalOpex > 0 ? 'primary' : 'slate',
    },
  ]

  return (
    <SubpageShell
      title="Store Operations"
      subtitle={branchName}
      eyebrow={greetingLabel}
      showBack={false}
      action={
        <button
          onClick={signOut}
          className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-[0_18px_45px_-34px_rgba(15,23,42,0.35)] transition-colors hover:border-primary-200 hover:text-primary-700"
          aria-label="Keluar"
        >
          <AppIcon name="logout" size={18} />
        </button>
      }
      footer={<StaffBottomNav />}
    >
      <HeroCard
        eyebrow={profile?.branch?.store_id || 'Store Ops'}
        title={`Halo, ${shortName}. Jaga ritme operasional toko hari ini.`}
        description="Semua alur penting seperti ceklis, laporan, dan OPEX aku rapikan di halaman ini supaya lebih cepat dipindai dan langsung terasa prioritasnya."
        meta={
          <>
            <ToneBadge tone="info">
              <AppIcon name="calendar" size={14} />
              {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </ToneBadge>
            <ToneBadge tone={status?.laporan ? 'ok' : 'warn'}>
              <AppIcon name="chart" size={14} />
              {status?.laporan ? 'Laporan H-1 aman' : `Sisa ${sisaWaktuLaporan(yesterday)}`}
            </ToneBadge>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {(loading ? [
            { label: 'Ceklis Pagi', value: '...', tone: 'slate' },
            { label: 'Ceklis Malam', value: '...', tone: 'slate' },
            { label: 'Laporan H-1', value: '...', tone: 'slate' },
            { label: 'Opex Hari Ini', value: '...', tone: 'slate' },
          ] : statCards).map((item) => (
            <InlineStat key={item.label} label={item.label} value={item.value} tone={item.tone} />
          ))}
        </div>
      </HeroCard>

      {!loading && !profile?.branch_id && (
        <Alert variant="error" className="mt-6">
          Akun ini belum dikonfigurasi ke cabang manapun. Hubungi ops manager untuk mengatur akses toko kamu.
        </Alert>
      )}

      {!loading && status && !status.laporan && (
        <div className="mt-6 rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3.5 text-sm leading-5.5 text-amber-800 shadow-[0_16px_48px_-36px_rgba(217,119,6,0.55)] sm:rounded-[24px] sm:px-5 sm:py-4 sm:leading-6">
          Laporan harian <strong>{new Date(yesterday).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</strong> belum disubmit.
          Sisa waktu: <strong>{sisaWaktuLaporan(yesterday)}</strong>.
        </div>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <SectionPanel
          eyebrow="Workflow"
          title="Menu Utama"
          description="Akses cepat ke alur yang paling sering kamu kerjakan di toko."
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {isStoreLevel && (
              <ActionCard
                to="/staff/ceklis"
                icon="checklist"
                title="Ceklis Harian"
                description="Isi checklist pagi dan malam beserta foto area."
                accent="emerald"
              />
            )}
            <ActionCard
              to="/staff/laporan"
              icon="chart"
              title="Laporan Harian"
              description="Input net sales, kunjungan, dan status setoran harian."
              accent="primary"
            />
            <ActionCard
              to="/staff/opex"
              icon="opex"
              title="Beban Operasional"
              description="Catat pengeluaran toko beserta bukti nota."
              accent="violet"
            />
            {!isStoreLevel && (
              <ActionCard
                to="/dm"
                icon="home"
                title="Dashboard Manajer"
                description="Pantau semua toko, visit, approval, dan kontrol biaya."
                accent="amber"
              />
            )}
          </div>
        </SectionPanel>

        <SectionPanel
          eyebrow="Snapshot"
          title="Ringkasan Operasional"
          description="Status cepat untuk melihat hal yang paling perlu dikerjakan."
        >
          <div className="space-y-3">
            <StatusSnapshot
              label="Ceklis Pagi"
              value={status?.ceklisPagi ? 'Sudah masuk' : 'Belum masuk'}
              detail={status?.ceklisPagi
                ? (status.ceklisPagi.is_late
                  ? 'Tercatat terlambat dari deadline'
                  : new Date(status.ceklisPagi.submitted_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB')
                : 'Perlu follow up'}
              tone={status?.ceklisPagi ? (status.ceklisPagi.is_late ? 'warn' : 'ok') : 'danger'}
            />
            <StatusSnapshot
              label="Ceklis Malam"
              value={status?.ceklisMalam ? 'Sudah diisi' : 'Masih terbuka'}
              detail={status?.ceklisMalam ? 'Checklist penutupan aman' : 'Belum ada input malam'}
              tone={status?.ceklisMalam ? 'ok' : 'info'}
            />
            <StatusSnapshot
              label="Laporan H-1"
              value={status?.laporan ? 'Sudah submit' : 'Belum submit'}
              detail={status?.laporan ? 'Laporan operasional sudah tercatat' : `Deadline jam 14.00 WIB, sisa ${sisaWaktuLaporan(yesterday)}`}
              tone={status?.laporan ? 'ok' : 'warn'}
            />
            <StatusSnapshot
              label="Opex Hari Ini"
              value={fmtRp(status?.totalOpex || 0)}
              detail={status?.totalOpex > 0 ? 'Pengeluaran hari ini sudah tercatat' : 'Belum ada pengeluaran tercatat'}
              tone={status?.totalOpex > 0 ? 'info' : 'slate'}
            />
          </div>
        </SectionPanel>
      </div>
    </SubpageShell>
  )
}

function StatusSnapshot({ label, value, detail, tone }) {
  const toneClass = {
    danger: 'bg-rose-50 text-rose-700',
    warn: 'bg-amber-50 text-amber-700',
    ok: 'bg-emerald-50 text-emerald-700',
    info: 'bg-primary-50 text-primary-700',
    slate: 'bg-slate-100 text-slate-600',
  }

  return (
    <div className="rounded-[20px] border border-white/80 bg-slate-50/85 px-3.5 py-3.5 sm:rounded-[22px] sm:px-4 sm:py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</div>
          <div className="mt-1.5 text-[15px] font-semibold text-slate-950 sm:text-base">{value}</div>
          <div className="mt-1 text-sm leading-5.5 text-slate-500 sm:leading-6">{detail}</div>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold sm:px-3 sm:py-1.5 sm:text-[11px] ${toneClass[tone] || toneClass.slate}`}>
          {tone === 'danger' ? 'Perlu cek' : tone === 'warn' ? 'Tertahan' : tone === 'ok' ? 'Aman' : 'Info'}
        </span>
      </div>
    </div>
  )
}

function getGreetingLabel() {
  const hour = new Date(new Date().getTime() + 7 * 3600 * 1000).getUTCHours()
  if (hour < 11) return 'Selamat pagi'
  if (hour < 15) return 'Selamat siang'
  if (hour < 18) return 'Selamat sore'
  return 'Selamat malam'
}
