import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { fetchSopFiles } from '../lib/googleApis'
import { DMBottomNav, OpsBottomNav, SCBottomNav, SmartBottomNav, StaffBottomNav } from '../components/BottomNav'
import { isFinanceRole, isManagerRole, isOpsLikeRole, isStoreRole, isSupplyChainRole } from '../lib/access'
import { AppIcon } from '../components/ui/AppKit'

function getFooter(role) {
  if (isOpsLikeRole(role)) return <OpsBottomNav />
  if (isManagerRole(role)) return <DMBottomNav />
  if (isSupplyChainRole(role)) return <SCBottomNav />
  if (isStoreRole(role)) return <StaffBottomNav />
  return <SmartBottomNav />
}

export default function SopPage() {
  const { profile } = useAuth()
  const [sops, setSops] = useState([])
  const [activeSop, setActiveSop] = useState(null)

  useEffect(() => {
    fetchSopFiles().then((rows) => {
      setSops(rows || [])
      setActiveSop((rows || [])[0] || null)
    }).catch(() => {
      setSops([])
      setActiveSop(null)
    })
  }, [])

  if (isFinanceRole(profile?.role)) return null

  return (
    <div className="min-h-screen bg-slate-50 pb-28">
      <div className="border-b border-slate-100 bg-white px-5 py-5">
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">SOP Center</div>
        <div className="mt-1 text-xl font-extrabold text-slate-900">Panduan Operasional</div>
        <div className="mt-2 text-sm text-slate-500">Buka semua dokumen SOP dalam satu halaman khusus.</div>
      </div>

      <div className="grid gap-4 px-5 py-5 lg:grid-cols-[320px_1fr]">
        <div className="space-y-3">
          {sops.map((sop) => (
            <button
              key={sop.id}
              type="button"
              onClick={() => setActiveSop(sop)}
              className={`w-full rounded-[1.5rem] border px-4 py-4 text-left shadow-sm transition-colors ${
                activeSop?.id === sop.id ? 'border-blue-200 bg-blue-50' : 'border-slate-100 bg-white hover:bg-slate-50'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm">
                  <AppIcon name="checklist" size={18} />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900">{sop.name}</div>
                  <div className="mt-1 text-[11px] text-slate-400">
                    {sop.modifiedTime ? new Date(sop.modifiedTime).toLocaleDateString('id-ID') : 'Dokumen SOP'}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-sm">
          {activeSop ? (
            <>
              <div className="border-b border-slate-100 px-5 py-4">
                <div className="text-sm font-semibold text-slate-900">{activeSop.name}</div>
              </div>
              <iframe
                src={activeSop.previewUrl}
                title={activeSop.name}
                className="h-[72vh] w-full border-0"
                sandbox="allow-scripts allow-same-origin"
              />
            </>
          ) : (
            <div className="flex h-[72vh] items-center justify-center text-sm text-slate-400">Belum ada dokumen SOP.</div>
          )}
        </div>
      </div>

      {getFooter(profile?.role)}
    </div>
  )
}
