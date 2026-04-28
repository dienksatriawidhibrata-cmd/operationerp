import { useEffect, useRef, useState } from 'react'
import { toEmbedUrl, toFullUrl } from '../lib/drive'

/**
 * Tampilkan array foto inline dengan lightbox.
 * Klik thumbnail untuk membuka viewer fullscreen di dalam apps.
 * Support navigasi prev/next antar foto.
 *
 * Props:
 *   urls       – foto yang ditampilkan sebagai thumbnail
 *   allUrls    – (opsional) seluruh foto gabungan lintas-kategori untuk navigasi lightbox
 *   allOffset  – index awal `urls` di dalam `allUrls`
 */
export default function PhotoViewer({ urls = [], emptyText = 'Tidak ada foto', allUrls, allOffset = 0 }) {
  const navUrls = allUrls || urls
  const [lightboxIdx, setLightboxIdx] = useState(null)
  const [broken, setBroken] = useState({})
  const [imgLoading, setImgLoading] = useState(false)
  const touchStartRef = useRef(null)
  const touchDeltaRef = useRef(0)

  const isOpen = lightboxIdx !== null
  const total = navUrls?.length ?? 0
  const localActiveIdx = isOpen ? lightboxIdx - allOffset : -1

  const open = (localIdx) => {
    setImgLoading(true)
    setLightboxIdx(allOffset + localIdx)
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

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen])

  if (!urls || urls.length === 0) {
    return <p className="text-xs italic text-gray-400">{emptyText}</p>
  }

  const currentUrl = isOpen ? navUrls[lightboxIdx] : null

  const handlePointerDown = (event) => {
    if (total <= 1) return
    touchStartRef.current = event.clientX
    touchDeltaRef.current = 0
  }

  const handlePointerMove = (event) => {
    if (touchStartRef.current == null) return
    touchDeltaRef.current = event.clientX - touchStartRef.current
  }

  const handlePointerUp = (event) => {
    if (touchStartRef.current == null) return
    event.stopPropagation()

    const delta = touchDeltaRef.current
    touchStartRef.current = null
    touchDeltaRef.current = 0

    if (Math.abs(delta) < 48 || total <= 1) return

    setImgLoading(true)
    setLightboxIdx((current) => {
      if (delta < 0) return (current + 1) % total
      return (current - 1 + total) % total
    })
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
        {urls.map((url, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => open(idx)}
            className="aspect-square overflow-hidden rounded-xl border border-primary-200 bg-gray-100 transition-colors hover:border-primary-400"
          >
            {broken[idx] ? (
              <div className="flex h-full w-full items-center justify-center px-1 text-[10px] leading-tight text-gray-400">
                Foto {idx + 1}
              </div>
            ) : (
              <img
                src={toEmbedUrl(url)}
                alt={`Foto ${idx + 1}`}
                loading="lazy"
                className="h-full w-full object-cover"
                onError={() => setBroken((current) => ({ ...current, [idx]: true }))}
              />
            )}
          </button>
        ))}
      </div>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-black/95 overscroll-contain"
          onClick={close}
        >
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

          <div
            className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-4 py-4 sm:px-14"
            onClick={close}
          >
            {imgLoading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
              </div>
            )}
            <img
              key={currentUrl}
              src={toFullUrl(currentUrl)}
              alt={`Foto ${lightboxIdx + 1}`}
              className={`max-h-full max-w-full touch-pan-y rounded-xl object-contain transition-opacity duration-200 ${imgLoading ? 'opacity-0' : 'opacity-100'}`}
              onLoad={() => setImgLoading(false)}
              onError={() => setImgLoading(false)}
              onClick={(event) => event.stopPropagation()}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={() => {
                touchStartRef.current = null
                touchDeltaRef.current = 0
              }}
            />
          </div>

          {total > 1 && (
            <div className="flex flex-none justify-center gap-1.5 pb-4 pt-1">
              {navUrls.map((_, idx) => (
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

          {total > 1 && (
            <>
              <button
                className="absolute left-2 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-lg text-white transition-colors hover:bg-white/25 sm:flex"
                onClick={prev}
              >
                &lt;
              </button>
              <button
                className="absolute right-2 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-lg text-white transition-colors hover:bg-white/25 sm:flex"
                onClick={next}
              >
                &gt;
              </button>
            </>
          )}

          {urls.length > 1 && localActiveIdx >= 0 && (
            <div className="pb-4 text-center text-xs font-medium text-white/60 sm:hidden">
              Geser foto kiri atau kanan
            </div>
          )}
        </div>
      )}
    </>
  )
}
