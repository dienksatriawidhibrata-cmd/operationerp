import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchSopFiles } from '../lib/googleApis'
import { AppIcon } from './ui/AppKit'

export default function SopPreviewSection({ title = 'Panduan SOP', accent = 'blue' }) {
  const [sopCards, setSopCards] = useState([])

  useEffect(() => {
    fetchSopFiles().then((rows) => setSopCards(rows || [])).catch(() => setSopCards([]))
  }, [])

  if (!sopCards.length) return null

  const accentMap = {
    blue: 'text-blue-600 bg-blue-50 border-blue-100',
    indigo: 'text-indigo-600 bg-indigo-50 border-indigo-100',
    slate: 'text-slate-600 bg-slate-50 border-slate-200',
  }

  return (
    <div className="mb-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-extrabold text-gray-800">{title}</h2>
        <Link to="/sop" className="text-[10px] font-bold text-blue-600">Selengkapnya</Link>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {sopCards.slice(0, 4).map((sop) => (
          <Link
            key={sop.id}
            to="/sop"
            className="rounded-[1.5rem] border bg-white p-4 shadow-sm transition-transform active:scale-[0.98]"
          >
            <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl border ${accentMap[accent] || accentMap.blue}`}>
              <AppIcon name="checklist" size={18} />
            </div>
            <p className="text-[10px] font-bold leading-tight text-gray-800">{sop.name}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
