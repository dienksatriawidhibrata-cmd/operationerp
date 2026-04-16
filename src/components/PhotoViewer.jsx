import { useEffect, useState } from 'react'
import { toEmbedUrl, toFullUrl } from '../lib/drive'

/**
 * Tampilkan array foto inline dengan lightbox.
 * Klik thumbnail untuk membuka viewer fullscreen di dalam apps.
 * Support navigasi prev/next antar foto.
 */
export default function PhotoViewer({ urls = [], emptyText = 'Tidak ada foto' }) {
  const [lightboxIdx, setLightboxIdx] = useState(null)
  const [broken, setBroken]           = useState({})
  const [imgLoading, setImgLoading]   = useState(false)

  const isOpen = lightboxIdx !== null
  const total  = urls?.length ?? 0

  const open  = (idx) => { setImgLoading(true); setLightboxIdx(idx) }
  const close = () => setLightboxIdx(null)
  const prev  = (e) => { e.stopPropagation(); setImgLoading(true); setLightboxIdx((i) => (i - 1 + total) % total) }
  const next  = (e) => { e.stopPropagation(); setImgLoading(true); setLightboxIdx((i) => (i + 1) % total) }

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return
    const handler = (e) => {
      if (e.key === 'ArrowLeft')  setLightboxIdx((i) => (i - 1 + total) % total)
      if (e.key === 'ArrowRight') setLightboxIdx((i) => (i + 1) % total)
      if (e.key === 'Escape')     close()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, total])

  if (!urls || urls.length === 0) {
    return <p className="text-xs text-gray-400 italic">{emptyText}</p>
  }

  const currentUrl = isOpen ? urls[lightboxIdx] : null

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {urls.map((url, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => open(idx)}
            className="w-20 h-20 rounded-xl overflow-hidden border border-primary-200 hover:border-primary-400 transition-colors flex-shrink-0 bg-gray-100"
          >
            {broken[idx] ? (
              <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-400 leading-tight px-1">
                Foto {idx + 1}
              </div>
            ) : (
              <img
                src={toEmbedUrl(url)}
                alt={`Foto ${idx + 1}`}
                className="w-full h-full object-cover"
                onError={() => setBroken(prev => ({ ...prev, [idx]: true }))}
              />
            )}
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/95 z-50 flex flex-col items-center justify-center"
          onClick={close}
        >
          {/* Header */}
          <div className="absolute top-0 inset-x-0 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/60 to-transparent z-10">
            <span className="text-white/70 text-sm font-medium">
              {lightboxIdx + 1} / {total}
            </span>
            <button
              className="w-9 h-9 bg-white/15 hover:bg-white/25 rounded-full text-white flex items-center justify-center text-xl transition-colors"
              onClick={close}
            >
              ×
            </button>
          </div>

          {/* Image */}
          <div className="relative w-full h-full flex items-center justify-center px-14 py-14" onClick={close}>
            {imgLoading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
              </div>
            )}
            <img
              key={currentUrl}
              src={toFullUrl(currentUrl)}
              alt={`Foto ${lightboxIdx + 1}`}
              className={`max-w-full max-h-full rounded-xl object-contain transition-opacity duration-200 ${imgLoading ? 'opacity-0' : 'opacity-100'}`}
              onLoad={() => setImgLoading(false)}
              onError={() => setImgLoading(false)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* Prev / Next */}
          {total > 1 && (
            <>
              <button
                className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/15 hover:bg-white/25 rounded-full text-white flex items-center justify-center text-lg transition-colors z-10"
                onClick={prev}
              >
                ‹
              </button>
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/15 hover:bg-white/25 rounded-full text-white flex items-center justify-center text-lg transition-colors z-10"
                onClick={next}
              >
                ›
              </button>
            </>
          )}

          {/* Dot indicators */}
          {total > 1 && (
            <div className="absolute bottom-4 inset-x-0 flex justify-center gap-1.5">
              {urls.map((_, idx) => (
                <button
                  key={idx}
                  className={`w-2 h-2 rounded-full transition-colors ${idx === lightboxIdx ? 'bg-white' : 'bg-white/40'}`}
                  onClick={(e) => { e.stopPropagation(); setImgLoading(true); setLightboxIdx(idx) }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}
