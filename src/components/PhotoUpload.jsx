import { useEffect, useRef, useState } from 'react'
import { toEmbedUrl, toFullUrl, uploadToDrive } from '../lib/drive'

/**
 * Komponen upload foto ke Google Drive via Apps Script.
 * Mengembalikan array URL (bisa multiple).
 *
 * Props:
 *   folder  - subfolder di Drive (e.g. 'ceklis', 'setoran', 'visit')
 *   value   - string[] existing URLs
 *   onChange - fn(urls: string[])
 *   max     - max jumlah foto (default: 5)
 *   label   - teks tombol upload
 */
export default function PhotoUpload({
  folder = 'general',
  value = [],
  onChange,
  max = 5,
  label = 'Upload Foto',
  disabled = false,
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const [uploadSummary, setUploadSummary] = useState('')
  const [lightboxIdx, setLightboxIdx] = useState(null)
  const inputRef = useRef(null)
  const valueRef = useRef(value)

  useEffect(() => {
    valueRef.current = value
  }, [value])

  const handleFiles = async (files) => {
    if (!files || files.length === 0) return
    if (value.length + files.length > max) {
      setError(`Maksimal ${max} foto`)
      return
    }

    setUploading(true)
    setError(null)
    setUploadSummary('')

    try {
      const uploads = await Promise.all(Array.from(files).map((file) => uploadToDrive(file, folder)))
      const newUrls = uploads.map((item) => item.url)
      const originalBytes = uploads.reduce((sum, item) => sum + Number(item.originalSize || 0), 0)
      const uploadedBytes = uploads.reduce((sum, item) => sum + Number(item.uploadedSize || 0), 0)

      onChange?.([...valueRef.current, ...newUrls])

      if (originalBytes > 0 && uploadedBytes > 0) {
        setUploadSummary(`Foto dikompres ${formatKb(originalBytes)} -> ${formatKb(uploadedBytes)}`)
      }
    } catch (uploadErr) {
      setError(`Upload gagal: ${uploadErr.message}`)
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const removePhoto = (idx) => {
    onChange?.(value.filter((_, index) => index !== idx))
  }

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((url, idx) => (
            <div
              key={idx}
              className="group relative h-16 w-16 overflow-hidden rounded-xl border border-primary-200 bg-white sm:h-20 sm:w-20"
            >
              <button type="button" onClick={() => setLightboxIdx(idx)} className="h-full w-full">
                <img
                  src={toEmbedUrl(url)}
                  alt={`foto ${idx + 1}`}
                  className="h-full w-full object-cover"
                  onError={(event) => {
                    event.target.style.display = 'none'
                  }}
                />
              </button>
              {!disabled && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    removePhoto(idx)
                  }}
                  className="absolute right-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"
                >
                  x
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {lightboxIdx !== null && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95"
          onClick={() => setLightboxIdx(null)}
        >
          <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent px-4 py-3">
            <span className="text-sm font-medium text-white/70">
              {lightboxIdx + 1} / {value.length}
            </span>
            <button
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-xl text-white"
              onClick={() => setLightboxIdx(null)}
            >
              x
            </button>
          </div>

          <div
            className="relative flex h-full w-full items-center justify-center px-12 py-14 sm:px-14"
            onClick={() => setLightboxIdx(null)}
          >
            <img
              key={value[lightboxIdx]}
              src={toFullUrl(value[lightboxIdx])}
              alt={`Foto ${lightboxIdx + 1}`}
              className="max-h-full max-w-full rounded-xl object-contain"
              onClick={(event) => event.stopPropagation()}
            />
          </div>

          {value.length > 1 && (
            <>
              <button
                className="absolute left-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-lg text-white"
                onClick={(event) => {
                  event.stopPropagation()
                  setLightboxIdx((current) => (current - 1 + value.length) % value.length)
                }}
              >
                &lt;
              </button>
              <button
                className="absolute right-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-lg text-white"
                onClick={(event) => {
                  event.stopPropagation()
                  setLightboxIdx((current) => (current + 1) % value.length)
                }}
              >
                &gt;
              </button>
            </>
          )}

          <div className="absolute inset-x-0 bottom-4 flex justify-center gap-1.5">
            {value.map((_, idx) => (
              <button
                key={idx}
                className={`h-2 w-2 rounded-full ${idx === lightboxIdx ? 'bg-white' : 'bg-white/40'}`}
                onClick={(event) => {
                  event.stopPropagation()
                  setLightboxIdx(idx)
                }}
              />
            ))}
          </div>
        </div>
      )}

      {!disabled && value.length < max && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={`
            flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed py-2.5 text-sm font-medium transition-colors
            ${uploading
              ? 'cursor-wait border-primary-300 bg-primary-50 text-primary-400'
              : 'border-primary-300 bg-white text-primary-600 hover:bg-primary-50 active:scale-98'
            }
          `}
        >
          {uploading ? (
            <>
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Mengupload...
            </>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              {label}
            </>
          )}
        </button>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
      {!error && uploadSummary && <p className="text-xs text-green-600">{uploadSummary}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => handleFiles(event.target.files)}
      />
    </div>
  )
}

function formatKb(bytes) {
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}
