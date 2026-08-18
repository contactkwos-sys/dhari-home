const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
const TARGET_MAX_BYTES = 2.5 * 1024 * 1024

/**
 * Resize/compress an image in the browser before upload.
 * Max edge ~1600px, JPEG quality starting at ~0.8. Falls back to original
 * if the browser cannot decode the file (e.g. some HEIC cases) and it fits.
 */
export async function compressImageFile(
  file: File,
  options?: { maxDimension?: number; quality?: number },
): Promise<File> {
  const maxDimension = options?.maxDimension ?? 1600
  const startQuality = options?.quality ?? 0.8

  const bitmap = await decodeToBitmap(file)
  if (!bitmap) {
    if (file.size > MAX_UPLOAD_BYTES) throw new PhotoTooLargeError()
    return file
  }

  const { width, height } = bitmap
  const scale = Math.min(1, maxDimension / Math.max(width, height))
  const targetW = Math.max(1, Math.round(width * scale))
  const targetH = Math.max(1, Math.round(height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = targetW
  canvas.height = targetH
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    if (file.size > MAX_UPLOAD_BYTES) throw new PhotoTooLargeError()
    return file
  }

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, targetW, targetH)
  ctx.drawImage(bitmap, 0, 0, targetW, targetH)
  bitmap.close()

  let quality = startQuality
  let blob = await canvasToJpeg(canvas, quality)
  while (blob && blob.size > TARGET_MAX_BYTES && quality > 0.45) {
    quality = Math.max(0.45, quality - 0.15)
    blob = await canvasToJpeg(canvas, quality)
  }

  if (!blob) {
    if (file.size > MAX_UPLOAD_BYTES) throw new PhotoTooLargeError()
    return file
  }

  if (blob.size > MAX_UPLOAD_BYTES) throw new PhotoTooLargeError()

  // Keep original only if it is already smaller and within the limit
  if (blob.size >= file.size && file.size <= MAX_UPLOAD_BYTES) {
    return file
  }

  const base = file.name.replace(/\.[^.]+$/, '') || 'photo'
  return new File([blob], `${base}.jpg`, {
    type: 'image/jpeg',
    lastModified: Date.now(),
  })
}

async function decodeToBitmap(file: File): Promise<ImageBitmap | null> {
  try {
    return await createImageBitmap(file, {
      imageOrientation: 'from-image',
    } as ImageBitmapOptions)
  } catch {
    /* try HTMLImageElement fallback below */
  }

  try {
    const url = URL.createObjectURL(file)
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('decode failed'))
      el.src = url
    })
    const bitmap = await createImageBitmap(img)
    URL.revokeObjectURL(url)
    return bitmap
  } catch {
    return null
  }
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/jpeg', quality)
  })
}

export class PhotoTooLargeError extends Error {
  constructor(message = 'Photo too large, try again') {
    super(message)
    this.name = 'PhotoTooLargeError'
  }
}

export function isPhotoUploadError(error: unknown): boolean {
  if (error instanceof PhotoTooLargeError) return true
  const msg = errorMessageLoose(error).toLowerCase()
  return (
    msg.includes('entitytoolarge') ||
    msg.includes('payload too large') ||
    msg.includes('maximum allowed size') ||
    msg.includes('file size') ||
    msg.includes('too large') ||
    msg.includes('413')
  )
}

export function photoUploadErrorMessage(error: unknown): string {
  if (isPhotoUploadError(error)) return 'Photo too large, try again'
  const msg = errorMessageLoose(error)
  return msg
    ? `Photo upload failed — ${msg}. You can retry later via Change photo.`
    : 'Photo upload failed — you can save without a photo and retry later via Change photo'
}

function errorMessageLoose(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    const m = (error as { message?: unknown }).message
    if (typeof m === 'string') return m
  }
  if (typeof error === 'string') return error
  return ''
}
