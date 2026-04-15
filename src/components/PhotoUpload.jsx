import { useRef, useState } from 'react'
import { uploadToDrive } from '../lib/drive'

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
  const inputRef = useRef(null)

  const handleFiles = async (files) => {
    if (!files || files.length === 0) return
    if (value.length + files.length > max) {
      setError(`Maksimal ${max} foto`)
      return
    }
    setUploading(true)
    setError(null)
    try {
      const uploads = await Promise.all(
        Array.from(files).map(f => uploadToDrive(f, folder))
      )
      const newUrls = uploads.map(u => u.url)
      onChange?.([...value, ...newUrls])
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
              <img
                src={toDriveEmbed(url)}
                alt={`foto ${idx + 1}`}
                className="w-full h-full object-cover"
                onError={e => { e.target.src = '' }}
              />
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removePhoto(idx)}
                  className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                >
                  ×
                </button>
              )}
            </div>
          ))}
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

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        capture="environment"
        className="hidden"
        onChange={e => handleFiles(e.target.files)}
      />
    </div>
  )
}

function toDriveEmbed(url) {
  if (!url) return ''
  const match = url.match(/[-\w]{25,}/)
  if (!match) return url
  return `https://drive.google.com/uc?id=${match[0]}&export=view`
}
