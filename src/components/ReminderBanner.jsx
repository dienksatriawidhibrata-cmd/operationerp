import { Link } from 'react-router-dom'
import { nowTimeWIB } from '../lib/utils'
import { AppIcon } from './ui/AppKit'

function wibMinutes() {
  const [h, m] = nowTimeWIB().split(':').map(Number)
  return h * 60 + m
}

export default function ReminderBanner({ status, loading, isHeadStore }) {
  if (loading || !status) return null

  const now = wibMinutes()
  const overdue = []

  if (now >= 8 * 60 && !status.ceklisOpening)
    overdue.push({ label: 'Ceklis Opening', to: '/staff/ceklis' })
  if (now >= 8 * 60 && !status.prepPagi)
    overdue.push({ label: 'Preparation Pagi', to: '/staff/preparation' })
  if (now >= 15 * 60 + 30 && !status.ceklisMiddle)
    overdue.push({ label: 'Ceklis Middle', to: '/staff/ceklis' })
  if (now >= 14 * 60 && !status.prepMiddle)
    overdue.push({ label: 'Preparation Middle', to: '/staff/preparation' })
  if (isHeadStore && now >= 14 * 60 && !status.laporan)
    overdue.push({ label: 'Laporan Harian (kemarin)', to: '/staff/laporan' })
  if (isHeadStore && now >= 14 * 60 && !status.setoran)
    overdue.push({ label: 'Setoran (kemarin)', to: '/staff/laporan' })
  if (now >= 19 * 60 + 30 && !status.ceklisMalam)
    overdue.push({ label: 'Ceklis Malam', to: '/staff/ceklis' })
  if (now >= 4 * 60 && !status.ceklisClosing)
    overdue.push({ label: 'Ceklis Closing', to: '/staff/ceklis' })

  if (overdue.length === 0) return null

  return (
    <div className="mb-4 rounded-[1.75rem] border border-rose-200 bg-rose-50 px-4 py-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-100">
          <AppIcon name="bell" size={14} className="text-rose-600" />
        </div>
        <p className="text-sm font-bold text-rose-800">
          {overdue.length} item belum masuk — deadline sudah lewat
        </p>
      </div>
      <div className="space-y-2">
        {overdue.map((item) => (
          <Link
            key={item.label}
            to={item.to}
            className="flex items-center justify-between rounded-[1rem] bg-white px-4 py-2.5 text-sm font-semibold text-rose-700 shadow-sm ring-1 ring-rose-100 active:scale-[0.98]"
          >
            <span>{item.label}</span>
            <AppIcon name="chevronRight" size={14} className="text-rose-400" />
          </Link>
        ))}
      </div>
    </div>
  )
}
