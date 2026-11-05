// src/lib/images.js
// Resize a photo in the browser and re-encode it as JPEG before upload.
// Re-encoding also turns iPhone HEIC photos into JPEG, which Claude and the
// storage buckets accept.

export async function resizeToJpeg(file, maxSide = 1200, quality = 0.82) {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error(`Couldn't open ${file.name || 'that photo'}`))
      el.src = url
    })
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * scale)
    canvas.height = Math.round(img.naturalHeight * scale)
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
    return await new Promise((resolve, reject) =>
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not prepare the photo'))), 'image/jpeg', quality))
  } finally {
    URL.revokeObjectURL(url)
  }
}
