import { useState } from 'react'

/**
 * Tampilkan array foto dari Google Drive inline.
 * Foto bisa di-tap untuk fullscreen lightbox.
 */
export default function PhotoViewer({ urls = [], emptyText = 'Tidak ada foto' }) {
  const [lightbox, setLightbox] = useState(null)

  if (!urls || urls.length === 0) {
    return <p className="text-xs text-gray-400 italic">{emptyText}</p>
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {urls.map((url, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setLightbox(url)}
            className="w-20 h-20 rounded-xl overflow-hidden border border-primary-200 hover:border-primary-400 transition-colors flex-shrink-0 bg-gray-100"
          >
            <img
              src={embedUrl(url)}
              alt={`Foto ${idx + 1}`}
              className="w-full h-full object-cover"
              onError={e => {
                e.target.parentElement.innerHTML =
                  `<div class="w-full h-full flex items-center justify-center text-xs text-gray-400">Foto</div>`
              }}
            />
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <img
            src={embedUrl(lightbox)}
            alt="Preview"
            className="max-w-full max-h-full rounded-xl object-contain"
            onClick={e => e.stopPropagation()}
          />
          <button
            className="absolute top-4 right-4 w-9 h-9 bg-white/20 rounded-full text-white flex items-center justify-center text-lg"
            onClick={() => setLightbox(null)}
          >
            ×
          </button>
          <a
            href={lightbox}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-xs bg-white/20 px-4 py-2 rounded-full"
            onClick={e => e.stopPropagation()}
          >
            Buka di Drive ↗
          </a>
        </div>
      )}
    </>
  )
}

function embedUrl(url) {
  if (!url) return ''
  const match = url.match(/[-\w]{25,}/)
  if (!match) return url
  return `https://drive.google.com/uc?id=${match[0]}&export=view`
}
