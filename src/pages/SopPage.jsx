import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { fetchSopDocumentContent, fetchSopDocuments } from '../lib/googleApis'
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

function blockTitle(style) {
  if (style === 'HEADING_1') return 'text-2xl font-black text-slate-950'
  if (style === 'HEADING_2') return 'text-xl font-bold text-slate-900'
  if (style === 'HEADING_3') return 'text-lg font-bold text-slate-900'
  return 'text-base font-semibold text-slate-900'
}

function renderBlock(block, index) {
  if (block.type === 'heading') {
    return (
      <h2 key={index} className={blockTitle(block.style)}>
        {block.text}
      </h2>
    )
  }

  if (block.type === 'list_item') {
    return (
      <div key={index} className="flex items-start gap-3 text-sm leading-6 text-slate-600">
        <span className="mt-2 h-1.5 w-1.5 rounded-full bg-blue-500" />
        <span>{block.text}</span>
      </div>
    )
  }

  if (block.type === 'table') {
    return (
      <div key={index} className="overflow-x-auto rounded-[1.5rem] border border-slate-200 bg-white">
        <table className="min-w-full border-collapse text-left text-sm">
          <tbody>
            {block.rows.map((row, rowIndex) => (
              <tr key={rowIndex} className={rowIndex === 0 ? 'bg-slate-100' : 'bg-white'}>
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className={`border border-slate-200 px-4 py-3 align-top ${
                      rowIndex === 0 ? 'font-semibold text-slate-900' : 'text-slate-600'
                    }`}
                  >
                    {cell || '-'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <p key={index} className="text-sm leading-7 text-slate-600">
      {block.text}
    </p>
  )
}

function normalizeDocLabel(name) {
  return String(name || '').replace(/\.(docx?|pdf|pptx?)$/i, '').trim()
}

const GDOC_MIME = 'application/vnd.google-apps.document'

function isGoogleDoc(doc) {
  return !doc?.mimeType || doc.mimeType === GDOC_MIME
}

function getDocPreviewUrl(docId, mimeType) {
  if (!mimeType || mimeType === GDOC_MIME) {
    return `https://docs.google.com/document/d/${docId}/preview`
  }
  return `https://drive.google.com/file/d/${docId}/preview`
}

function formatDocDate(value) {
  return value ? new Date(value).toLocaleDateString('id-ID') : 'Google Docs'
}

function getDocumentCategory(doc) {
  const label = normalizeDocLabel(doc?.name).toLowerCase()
  if (label.includes('buku besar') || label.includes('produk') || label.includes('recipe')) {
    return 'produk'
  }

  return 'umum'
}

// category prop: 'umum' | 'produk' — jika diisi, halaman dikunci ke kategori itu
export default function SopPage({ category: lockedCategory = null }) {
  const { profile } = useAuth()
  const [documents, setDocuments] = useState([])
  const activeCategory = lockedCategory || 'umum'
  const [activeDocumentId, setActiveDocumentId] = useState('')
  const [activeDocument, setActiveDocument] = useState(null)
  const [activeTabId, setActiveTabId] = useState('')
  const [loadingDocs, setLoadingDocs] = useState(true)
  const [loadingContent, setLoadingContent] = useState(false)
  const [error, setError] = useState('')

  const loadDocuments = () => {
    setLoadingDocs(true)
    setError('')
    fetchSopDocuments()
      .then((rows) => {
        const docs = rows || []
        setDocuments(docs)
        const firstDoc = docs.find((doc) => getDocumentCategory(doc) === activeCategory) || null
        setActiveDocumentId(firstDoc?.id || '')
      })
      .catch((err) => {
        setDocuments([])
        setError(err.message || 'Gagal memuat daftar SOP.')
      })
      .finally(() => setLoadingDocs(false))
  }

  useEffect(() => {
    let cancelled = false

    setLoadingDocs(true)
    fetchSopDocuments()
      .then((rows) => {
        if (cancelled) return
        const docs = rows || []
        setDocuments(docs)
        const firstDoc = docs.find((doc) => getDocumentCategory(doc) === activeCategory) || docs[0] || null
        setActiveDocumentId(firstDoc?.id || '')
      })
      .catch((err) => {
        if (cancelled) return
        setDocuments([])
        setError(err.message || 'Gagal memuat daftar SOP.')
      })
      .finally(() => {
        if (!cancelled) setLoadingDocs(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!activeDocumentId) {
      setActiveDocument(null)
      setActiveTabId('')
      return
    }

    const meta = documents.find((d) => d.id === activeDocumentId)
    if (activeCategory === 'produk' || !isGoogleDoc(meta)) {
      setActiveDocument(null)
      setLoadingContent(false)
      return
    }

    let cancelled = false
    setLoadingContent(true)
    setError('')

    fetchSopDocumentContent(activeDocumentId)
      .then((payload) => {
        if (cancelled) return
        setActiveDocument(payload)
        setActiveTabId(payload?.tabs?.[0]?.id || '')
      })
      .catch((err) => {
        if (cancelled) return
        setActiveDocument(null)
        setActiveTabId('')
        setError(err.message || 'Gagal memuat isi SOP.')
      })
      .finally(() => {
        if (!cancelled) setLoadingContent(false)
      })

    return () => {
      cancelled = true
    }
  }, [activeDocumentId])

  const activeTab = useMemo(
    () => activeDocument?.tabs?.find((tab) => tab.id === activeTabId) || activeDocument?.tabs?.[0] || null,
    [activeDocument, activeTabId]
  )
  const activeDocMeta = useMemo(
    () => documents.find((item) => item.id === activeDocumentId) || null,
    [documents, activeDocumentId]
  )
  const filteredDocuments = useMemo(
    () => documents.filter((doc) => getDocumentCategory(doc) === activeCategory),
    [documents, activeCategory]
  )
  const hasDocumentTabs = useMemo(() => {
    const tabs = activeDocument?.tabs || []
    if (tabs.length > 1) return true
    return tabs.some((tab) => Number(tab?.depth || 0) > 0)
  }, [activeDocument])

  const useIframeView = useMemo(
    () => activeCategory === 'produk' || !isGoogleDoc(activeDocMeta),
    [activeCategory, activeDocMeta]
  )

  useEffect(() => {
    if (!filteredDocuments.length) {
      setActiveDocumentId('')
      return
    }

    if (!filteredDocuments.some((doc) => doc.id === activeDocumentId)) {
      setActiveDocumentId(filteredDocuments[0].id)
    }
  }, [filteredDocuments, activeDocumentId])

  if (isFinanceRole(profile?.role)) return null

  const pageTitle = activeCategory === 'produk' ? 'SOP Buku Besar Produk' : 'SOP Umum'

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,_#eef4ff_0%,_#f8fafc_36%,_#f8fafc_100%)] pb-28 lg:h-screen lg:overflow-hidden lg:pb-0">
      <div className="border-b border-slate-100 bg-white/92 px-5 py-5 backdrop-blur">
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">SOP Center</div>
        <div className="mt-1 text-xl font-extrabold text-slate-900">{pageTitle}</div>
        <div className="mt-2 text-sm text-slate-500">
          {activeCategory === 'produk'
            ? 'Panduan resep, produk, dan standar sajian Bagi Kopi.'
            : 'Panduan prosedur operasional standar harian.'}
        </div>
      </div>

      <div className="px-5 py-5 lg:h-[calc(100vh-109px)] lg:overflow-hidden">
        {error && (
          <div className="mb-4 rounded-[1.5rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <div>{error}</div>
            <button
              type="button"
              onClick={loadDocuments}
              className="mt-2 rounded-xl bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-200"
            >
              Coba lagi
            </button>
          </div>
        )}

        <div className="space-y-4 lg:hidden">
          <div className="sticky top-3 z-20 -mx-1 rounded-[2.2rem] bg-[linear-gradient(180deg,rgba(238,244,255,0.96)_0%,rgba(248,250,252,0.92)_100%)] px-1 pb-2 pt-1 backdrop-blur">
            <div className="rounded-[2rem] border border-slate-100 bg-white p-4 shadow-sm">
            <div className="grid grid-cols-2 gap-2">
              <Link
                to="/sop"
                className={`rounded-[1.1rem] px-3 py-2 text-center text-xs font-bold transition ${
                  activeCategory === 'umum' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                SOP Umum
              </Link>
              <Link
                to="/sop/produk"
                className={`rounded-[1.1rem] px-3 py-2 text-center text-xs font-bold transition ${
                  activeCategory === 'produk' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600'
                }`}
              >
                SOP Produk
              </Link>
            </div>

            <select
              className="mt-3 w-full rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none"
              value={activeDocumentId}
              onChange={(e) => setActiveDocumentId(e.target.value)}
              disabled={loadingDocs || !filteredDocuments.length}
            >
              {!filteredDocuments.length && <option value="">Belum ada SOP di kategori ini</option>}
              {filteredDocuments.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {normalizeDocLabel(doc.name)}
                </option>
              ))}
            </select>

            {activeDocMeta?.modifiedTime && (
              <div className="mt-2 text-xs text-slate-400">
                Update terakhir {formatDocDate(activeDocMeta.modifiedTime)}
              </div>
            )}
          </div>
          </div>

          {hasDocumentTabs && (
            <div className="rounded-[2rem] border border-slate-100 bg-white p-4 shadow-sm">
              <div className="mb-3 text-sm font-bold text-slate-900">Document Tab</div>
              <select
                className="w-full rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none"
                value={activeTab?.id || ''}
                onChange={(e) => setActiveTabId(e.target.value)}
                disabled={loadingContent}
              >
                {activeDocument.tabs.map((tab) => (
                  <option key={tab.id} value={tab.id}>
                    {`${tab.depth > 0 ? `${'· '.repeat(tab.depth)}` : ''}${tab.title}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <div className="text-lg font-extrabold text-slate-900">
                {normalizeDocLabel(activeDocMeta?.name) || activeDocument?.title || 'Panduan SOP'}
              </div>
              <div className="mt-1 text-sm text-slate-500">
                {useIframeView ? 'Dokumen SOP' : hasDocumentTabs ? activeTab?.title || 'Pilih document tab' : 'Dokumen SOP'}
              </div>
            </div>

            {useIframeView ? (
              activeDocumentId ? (
                <iframe
                  src={getDocPreviewUrl(activeDocumentId, activeDocMeta?.mimeType)}
                  className="block h-[70vh] w-full border-0"
                  title={normalizeDocLabel(activeDocMeta?.name)}
                />
              ) : (
                <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-400">Pilih dokumen SOP untuk mulai membaca.</div>
              )
            ) : (
              <div className="bg-[radial-gradient(circle_at_top,_rgba(96,165,250,0.10),_transparent_32%),linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] px-4 py-4">
                {loadingContent ? (
                  <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-400">Memuat isi dokumen...</div>
                ) : activeTab ? (
                  <div className="rounded-[1.75rem] border border-slate-200 bg-white px-5 py-5 shadow-[0_28px_80px_-40px_rgba(15,23,42,0.2)]">
                    <div className="mb-6 border-b border-slate-100 pb-4">
                      <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-500">Live from Docs</div>
                      <div className="mt-2 text-xl font-black text-slate-950">
                        {hasDocumentTabs ? activeTab.title : activeDocument?.title}
                      </div>
                      {activeDocument?.summary && (
                        <div className="mt-2 text-sm leading-6 text-slate-500">{activeDocument.summary}</div>
                      )}
                    </div>
                    <div className="space-y-5">
                      {activeTab.blocks.map((block, index) => renderBlock(block, index))}
                    </div>
                  </div>
                ) : (
                  <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-400">Pilih dokumen SOP untuk mulai membaca.</div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="hidden h-full gap-4 lg:grid lg:grid-cols-[280px_260px_minmax(0,1fr)]">
          <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[2rem] border border-slate-100 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <AppIcon name="checklist" size={18} />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900">Dokumen SOP</div>
                <div className="text-xs text-slate-400">Scroll list ini terpisah dari isi dokumen.</div>
              </div>
            </div>

            <div className="mb-3 grid grid-cols-2 gap-2">
              <Link
                to="/sop"
                className={`rounded-[1.1rem] px-3 py-2 text-center text-xs font-bold transition ${
                  activeCategory === 'umum' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                SOP Umum
              </Link>
              <Link
                to="/sop/produk"
                className={`rounded-[1.1rem] px-3 py-2 text-center text-xs font-bold transition ${
                  activeCategory === 'produk' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600'
                }`}
              >
                SOP Produk
              </Link>
            </div>

            {loadingDocs ? (
              <div className="py-12 text-center text-sm text-slate-400">Memuat daftar dokumen...</div>
            ) : (
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                {filteredDocuments.map((doc) => (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => setActiveDocumentId(doc.id)}
                    className={`w-full rounded-[1.4rem] px-4 py-3 text-left transition ${
                      activeDocumentId === doc.id ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <div className="text-sm font-semibold">{normalizeDocLabel(doc.name)}</div>
                    <div className="mt-1 text-[11px] text-slate-400">
                      {formatDocDate(doc.modifiedTime)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[2rem] border border-slate-100 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-slate-900">Document Tabs</div>
                <div className="text-xs text-slate-400">
                  {hasDocumentTabs ? 'Section dokumen aktif' : 'Hanya tampil untuk SOP yang punya tabs'}
                </div>
              </div>
              <AppIcon name="matrix" size={16} className="text-slate-300" />
            </div>

            {useIframeView ? (
              <div className="py-12 text-center text-sm text-slate-400">Navigasi tersedia di dalam dokumen.</div>
            ) : loadingContent ? (
              <div className="py-12 text-center text-sm text-slate-400">Memuat tabs...</div>
            ) : hasDocumentTabs ? (
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                {activeDocument.tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTabId(tab.id)}
                    className={`w-full rounded-[1.35rem] px-4 py-3 text-left transition ${
                      activeTab?.id === tab.id ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                    style={{ paddingLeft: `${16 + tab.depth * 14}px` }}
                  >
                    <div className="text-sm font-semibold">{tab.title}</div>
                    <div className={`mt-1 text-[11px] ${activeTab?.id === tab.id ? 'text-slate-300' : 'text-slate-400'}`}>
                      {tab.blocks?.length || 0} blok konten
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-sm text-slate-400">Dokumen ini tidak memakai document tabs.</div>
            )}
          </div>

          <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-extrabold text-slate-900">
                    {normalizeDocLabel(activeDocMeta?.name) || activeDocument?.title || 'Panduan SOP'}
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    {useIframeView ? 'Dokumen SOP' : hasDocumentTabs ? activeTab?.title || 'Pilih document tab' : 'Dokumen SOP'}
                  </div>
                </div>
                {activeDocMeta?.webViewLink && (
                  <a
                    href={activeDocMeta.webViewLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    <AppIcon name="spark" size={14} />
                    Buka di Google Docs
                  </a>
                )}
              </div>
            </div>

            {useIframeView ? (
              activeDocumentId ? (
                <iframe
                  src={getDocPreviewUrl(activeDocumentId, activeDocMeta?.mimeType)}
                  className="block min-h-0 flex-1 w-full border-0"
                  title={normalizeDocLabel(activeDocMeta?.name)}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-400">Pilih dokumen SOP untuk mulai membaca.</div>
              )
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(96,165,250,0.10),_transparent_32%),linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] px-5 py-5">
                {loadingContent ? (
                  <div className="flex h-full items-center justify-center text-sm text-slate-400">Memuat isi dokumen...</div>
                ) : activeTab ? (
                  <div className="mx-auto max-w-4xl rounded-[2rem] border border-slate-200 bg-white px-6 py-6 shadow-[0_28px_80px_-40px_rgba(15,23,42,0.2)]">
                    <div className="mb-6 border-b border-slate-100 pb-4">
                      <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-500">Live from Docs</div>
                      <div className="mt-2 text-2xl font-black text-slate-950">
                        {hasDocumentTabs ? activeTab.title : activeDocument?.title}
                      </div>
                      {activeDocument?.summary && (
                        <div className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{activeDocument.summary}</div>
                      )}
                    </div>
                    <div className="space-y-5">
                      {activeTab.blocks.map((block, index) => renderBlock(block, index))}
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-slate-400">Pilih dokumen SOP untuk mulai membaca.</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {getFooter(profile?.role)}
    </div>
  )
}
