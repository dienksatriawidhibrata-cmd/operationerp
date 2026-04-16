import { useEffect, useRef, useState } from 'react'
import { toEmbedUrl, toFullUrl } from '../lib/drive'

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
  const [error, setError]         = useState(null)
  const [uploadSummary, setUploadSummary] = useState('')
  const [lightboxIdx, setLightboxIdx] = useState(null)
  const inputRef   = useRef(null)
  // Keep a ref to the latest value so async upload handlers don't use stale closure
  const valueRef   = useRef(value)
  useEffect(() => { valueRef.current = value }, [value])

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
      const uploads = await Promise.all(
        Array.from(files).map(f => uploadToDrive(f, folder))
      )
      const newUrls = uploads.map(u => u.url)
      const originalBytes = uploads.reduce((sum, item) => sum + Number(item.originalSize || 0), 0)
      const uploadedBytes = uploads.reduce((sum, item) => sum + Number(item.uploadedSize || 0), 0)
      // Use the ref to get the latest value, not the stale closure from when upload started
      onChange?.([...valueRef.current, ...newUrls])

      if (originalBytes > 0 && uploadedBytes > 0) {
        setUploadSummary(`Foto dikompres ${formatKb(originalBytes)} -> ${formatKb(uploadedBytes)}`)
      }
    } catch (e) {
      setError('Upload gagal: ' + e.message)
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const removePhoto = (idx) => {
    onChange?.(value.filter((_, i) => i !== idx))
  }

  return (
    <div className="space-y-2">
      {/* Thumbnail grid */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((url, idx) => (
            <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden border border-primary-200 group">
              <button
                type="button"
                onClick={() => setLightboxIdx(idx)}
                className="w-full h-full"
              >
                <img
                  src={toEmbedUrl(url)}
                  alt={`foto ${idx + 1}`}
                  className="w-full h-full object-cover"
                  onError={e => { e.target.style.display = 'none' }}
                />
              </button>
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removePhoto(idx) }}
                  className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity z-10"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Inline lightbox */}
      {lightboxIdx !== null && (
        <div
          className="fixed inset-0 bg-black/95 z-50 flex flex-col items-center justify-center"
          onClick={() => setLightboxIdx(null)}
        >
          <div className="absolute top-0 inset-x-0 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/60 to-transparent z-10">
            <span className="text-white/70 text-sm font-medium">{lightboxIdx + 1} / {value.length}</span>
            <button className="w-9 h-9 bg-white/15 rounded-full text-white text-xl flex items-center justify-center" onClick={() => setLightboxIdx(null)}>×</button>
          </div>
          <div className="relative w-full h-full flex items-center justify-center px-14 py-14" onClick={() => setLightboxIdx(null)}>
            <img
              key={value[lightboxIdx]}
              src={toFullUrl(value[lightboxIdx])}
              alt={`Foto ${lightboxIdx + 1}`}
              className="max-w-full max-h-full rounded-xl object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          {value.length > 1 && (
            <>
              <button className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/15 rounded-full text-white text-lg flex items-center justify-center z-10"
                onClick={(e) => { e.stopPropagation(); setLightboxIdx((i) => (i - 1 + value.length) % value.length) }}>‹</button>
              <button className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/15 rounded-full text-white text-lg flex items-center justify-center z-10"
                onClick={(e) => { e.stopPropagation(); setLightboxIdx((i) => (i + 1) % value.length) }}>›</button>
            </>
          )}
          <div className="absolute bottom-4 inset-x-0 flex justify-center gap-1.5">
            {value.map((_, i) => (
              <button key={i} className={`w-2 h-2 rounded-full ${i === lightboxIdx ? 'bg-white' : 'bg-white/40'}`}
                onClick={(e) => { e.stopPropagation(); setLightboxIdx(i) }} />
            ))}
          </div>
        </div>
      )}

      {/* Upload button */}
      {!disabled && value.length < max && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={`
            flex items-center justify-center gap-2 w-full py-3 rounded-xl border-2 border-dashed text-sm font-medium transition-colors
            ${uploading
              ? 'border-primary-300 bg-primary-50 text-primary-400 cursor-wait'
              : 'border-primary-300 bg-white text-primary-600 hover:bg-primary-50 active:scale-98'
            }
          `}
        >
          {uploading ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
              Mengupload...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
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
        onChange={e => handleFiles(e.target.files)}
      />
    </div>
  )
}

function formatKb(bytes) {
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}
