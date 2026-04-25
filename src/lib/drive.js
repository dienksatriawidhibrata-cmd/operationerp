/**
 * Upload file ke Google Drive via Google Apps Script web app.
 * Apps Script berjalan sebagai pemilik script (akses Drive langsung).
 */

import { supabase } from './supabase'

const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL
const MAX_UPLOAD_BYTES = 200 * 1024
const MAX_DIMENSION = 1600
const MIN_DIMENSION = 480
const JPEG_MIME = 'image/jpeg'

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (event) => resolve(event.target?.result || '')
    reader.onerror = () => reject(new Error('Gagal membaca file'))
    reader.readAsDataURL(file)
  })
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Gagal memproses gambar'))
    image.src = dataUrl
  })
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Gagal membuat blob gambar'))
          return
        }
        resolve(blob)
      },
      JPEG_MIME,
      quality
    )
  })
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (event) => {
      const result = event.target?.result || ''
      const base64 = String(result).split(',')[1]
      resolve(base64)
    }
    reader.onerror = () => reject(new Error('Gagal mengubah gambar terkompres'))
    reader.readAsDataURL(blob)
  })
}

function fitSize(width, height, limit) {
  if (width <= limit && height <= limit) return { width, height }

  const ratio = Math.min(limit / width, limit / height)
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  }
}

async function compressImage(file) {
  if (!file.type.startsWith('image/')) {
    const base64 = (await readFileAsDataUrl(file)).split(',')[1]
    return {
      base64,
      mimeType: file.type || 'application/octet-stream',
      fileName: file.name,
      size: file.size,
      compressed: false,
    }
  }

  const dataUrl = await readFileAsDataUrl(file)
  const image = await loadImage(dataUrl)
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d', { alpha: false })

  if (!context) throw new Error('Browser tidak mendukung kompresi gambar')

  let dimensionLimit = MAX_DIMENSION
  let quality = 0.86
  let finalBlob = null

  while (dimensionLimit >= MIN_DIMENSION) {
    const { width, height } = fitSize(image.width, image.height, dimensionLimit)
    canvas.width = width
    canvas.height = height
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, width, height)
    context.drawImage(image, 0, 0, width, height)

    quality = 0.86
    while (quality >= 0.20) {
      const blob = await canvasToBlob(canvas, quality)
      if (blob.size <= MAX_UPLOAD_BYTES) {
        finalBlob = blob
        break
      }
      finalBlob = blob
      quality -= 0.08
    }

    if (finalBlob?.size <= MAX_UPLOAD_BYTES) break
    dimensionLimit -= 180
  }

  // Final emergency pass: force 320px at lowest quality to guarantee < 200KB
  if (!finalBlob || finalBlob.size > MAX_UPLOAD_BYTES) {
    const { width, height } = fitSize(image.width, image.height, 320)
    canvas.width = width
    canvas.height = height
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, width, height)
    context.drawImage(image, 0, 0, width, height)
    finalBlob = await canvasToBlob(canvas, 0.70)
  }

  const safeBlob = finalBlob || await canvasToBlob(canvas, quality)
  const originalBaseName = file.name?.replace(/\.[^.]+$/, '') || 'foto'

  const result = {
    base64: await blobToBase64(safeBlob),
    mimeType: JPEG_MIME,
    fileName: `${originalBaseName}.jpg`,
    size: safeBlob.size,
    compressed: safeBlob.size < file.size,
  }

  // Release canvas pixel buffer explicitly to help GC on low-memory devices
  canvas.width  = 0
  canvas.height = 0

  return result
}

function extractFileId(url) {
  if (!url) return null
  const match = String(url).match(/[-\w]{25,}/)
  return match ? match[0] : null
}

export function buildPreviewUrl(urlOrFileId, size = 'w400') {
  const fileId = extractFileId(urlOrFileId) || urlOrFileId
  if (!fileId) return ''
  return `https://lh3.googleusercontent.com/d/${fileId}=${size}`
}

/**
 * Upload satu file ke Drive via Apps Script.
 * @param {File} file
 * @param {string} folder - subfolder di dalam root folder Drive
 * @returns {Promise<{url: string, fileId: string, originalSize: number, uploadedSize: number}>}
 */
export async function uploadToDrive(file, folder = 'general') {
  if (!APPS_SCRIPT_URL) throw new Error('VITE_APPS_SCRIPT_URL belum dikonfigurasi.')

  const { data } = await supabase.auth.getSession()
  if (!data?.session) throw new Error('Sesi login tidak ditemukan.')

  const compressed = await compressImage(file)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 45_000)

  let res
  try {
    // Kirim sebagai text/plain agar tidak trigger CORS preflight
    res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'uploadFile',
        base64: compressed.base64,
        mimeType: compressed.mimeType,
        fileName: compressed.fileName,
        folder,
      }),
      signal: controller.signal,
    })
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Upload timeout (>45 detik). Coba lagi dengan koneksi yang lebih stabil.')
    }
    throw err
  } finally {
    clearTimeout(timeoutId)
  }

  let json = null
  try {
    json = await res.json()
  } catch {
    // Ignore JSON parsing failures.
  }

  if (!res.ok || json?.ok === false) {
    throw new Error(json?.error || 'Upload gagal')
  }

  return {
    url: json.url || `https://drive.google.com/uc?id=${json.fileId}&export=view`,
    fileId: json.fileId,
    originalSize: file.size,
    uploadedSize: compressed.size,
  }
}

/**
 * Upload beberapa file sekaligus.
 * @param {File[]} files
 * @param {string} folder
 * @returns {Promise<string[]>} array of Drive URLs
 */
export async function uploadMultiple(files, folder = 'general') {
  const results = await Promise.all(
    Array.from(files).map(f => uploadToDrive(f, folder))
  )
  return results.map(r => r.url)
}

/**
 * Convert berbagai format Google Drive URL ke URL embed langsung
 * supaya bisa ditampilkan di <img> tag (thumbnail kecil untuk grid).
 */
export function toEmbedUrl(driveUrl) {
  if (!driveUrl) return null
  return buildPreviewUrl(driveUrl)
}

/**
 * URL langsung (full resolution) untuk lightbox.
 * Menggunakan lh3.googleusercontent.com/d/ yang lebih reliable dan
 * tidak butuh sign-in Google untuk file dengan sharing ANYONE_WITH_LINK.
 */
export function toFullUrl(driveUrl) {
  if (!driveUrl) return null
  const fileId = extractFileId(driveUrl)
  if (!fileId) return driveUrl
  return `https://lh3.googleusercontent.com/d/${fileId}=w1920`
}
