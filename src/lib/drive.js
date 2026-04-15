/**
 * Upload file ke Google Drive via Google Apps Script web app.
 * Apps Script menerima base64, simpan ke Drive, return URL.
 */

const SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL

/**
 * Upload satu file ke Drive.
 * @param {File} file - File object dari input atau camera
 * @param {string} folder - subfolder label (e.g. 'ceklis', 'setoran', 'visit')
 * @returns {Promise<{url: string, fileId: string}>}
 */
export async function uploadToDrive(file, folder = 'general') {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = async (e) => {
      try {
        const base64 = e.target.result.split(',')[1]
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        const fileName = `${folder}/${timestamp}_${file.name}`

        const res = await fetch(SCRIPT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' }, // Apps Script quirk
          body: JSON.stringify({
            fileName,
            mimeType: file.type,
            data: base64,
            folder,
          }),
        })

        const json = await res.json()

        if (!json.success) throw new Error(json.error || 'Upload gagal')

        resolve({ url: json.url, fileId: json.fileId })
      } catch (err) {
        reject(err)
      }
    }

    reader.onerror = () => reject(new Error('Gagal membaca file'))
    reader.readAsDataURL(file)
  })
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
 * supaya bisa ditampilkan di <img> tag.
 * Format yang didukung:
 *   https://drive.google.com/file/d/FILE_ID/view
 *   https://drive.google.com/open?id=FILE_ID
 *   https://drive.google.com/uc?id=FILE_ID
 */
export function toEmbedUrl(driveUrl) {
  if (!driveUrl) return null
  // Extract file ID (26 chars alphanumeric dengan - dan _)
  const match = driveUrl.match(/[-\w]{25,}/)
  if (!match) return driveUrl
  return `https://drive.google.com/uc?id=${match[0]}&export=view`
}
