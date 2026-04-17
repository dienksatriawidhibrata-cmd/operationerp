import { useEffect, useState } from 'react'
import { toEmbedUrl, toFullUrl } from '../lib/drive'

/**
 * Tampilkan array foto inline dengan lightbox.
 * Klik thumbnail untuk membuka viewer fullscreen di dalam apps.
 * Support navigasi prev/next antar foto.
 */
export default function PhotoViewer({ urls = [], emptyText = 'Tidak ada foto' }) {
  const [lightboxIdx, setLightboxIdx] = useState(null)
  const [broken, setBroken] = useState({})
  const [imgLoading, setImgLoading] = useState(false)

  const isOpen = lightboxIdx !== null
  const total = urls?.length ?? 0

  const open = (idx) => {
    setImgLoading(true)
    setLightboxIdx(idx)
  }
  const close = () => setLightboxIdx(null)
  const prev = (event) => {
    event.stopPropagation()
    setImgLoading(true)
    setLightboxIdx((current) => (current - 1 + total) % total)
  }
  const next = (event) => {
    event.stopPropagation()
    setImgLoading(true)
    setLightboxIdx((current) => (current + 1) % total)
  }

  useEffect(() => {
    if (!isOpen) return undefined

    const handler = (event) => {
      if (event.key === 'ArrowLeft') setLightboxIdx((current) => (current - 1 + total) % total)
      if (event.key === 'ArrowRight') setLightboxIdx((current) => (current + 1) % total)
      if (event.key === 'Escape') close()
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, total])

  if (!urls || urls.length === 0) {
    return <p className="text-xs italic text-gray-400">{emptyText}</p>
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
            className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl border border-primary-200 bg-gray-100 transition-colors hover:border-primary-400 sm:h-20 sm:w-20"
          >
            {broken[idx] ? (
              <div className="flex h-full w-full items-center justify-center px-1 text-[10px] leading-tight text-gray-400">
                Foto {idx + 1}
              </div>
            ) : (
              <img
                src={toEmbedUrl(url)}
                alt={`Foto ${idx + 1}`}
                className="h-full w-full object-cover"
                onError={() => setBroken((current) => ({ ...current, [idx]: true }))}
              />
            )}
          </button>
        ))}
      </div>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/95"
          onClick={close}
        >
          {/* Header */}
          <div className="flex flex-none items-center justify-between bg-gradient-to-b from-black/60 to-transparent px-4 py-3">
            <span className="text-sm font-medium text-white/70">
              {lightboxIdx + 1} / {total}
            </span>
            <button
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-xl text-white transition-colors hover:bg-white/25"
              onClick={close}
            >
              ×
            </button>
          </div>

          {/* Image area — flex-1 so it fills remaining space between header and dots */}
          <div className="relative min-h-0 flex-1 flex items-center justify-center px-12 py-4 sm:px-14" onClick={close}>
            {imgLoading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
              </div>
            )}
            <img
              key={currentUrl}
              src={toFullUrl(currentUrl)}
              alt={`Foto ${lightboxIdx + 1}`}
              className={`max-h-full max-w-full rounded-xl object-contain transition-opacity duration-200 ${imgLoading ? 'opacity-0' : 'opacity-100'}`}
              onLoad={() => setImgLoading(false)}
              onError={() => setImgLoading(false)}
              onClick={(event) => event.stopPropagation()}
            />
          </div>

          {/* Dots */}
          {total > 1 && (
            <div className="flex flex-none justify-center gap-1.5 pb-4 pt-1">
              {urls.map((_, idx) => (
                <button
                  key={idx}
                  className={`h-2 w-2 rounded-full transition-colors ${idx === lightboxIdx ? 'bg-white' : 'bg-white/40'}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    setImgLoading(true)
                    setLightboxIdx(idx)
                  }}
                />
              ))}
            </div>
          )}

          {/* Prev / next arrows */}
          {total > 1 && (
            <>
              <button
                className="absolute left-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-lg text-white transition-colors hover:bg-white/25"
                onClick={prev}
              >
                &lt;
              </button>
              <button
                className="absolute right-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-lg text-white transition-colors hover:bg-white/25"
                onClick={next}
              >
                &gt;
              </button>
            </>
          )}
        </div>
      )}
    </>
  )
}
