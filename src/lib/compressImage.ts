/**
 * Resize/compress an image in the browser before upload.
 * Max edge ~1600px, JPEG quality ~0.8. Falls back to original if
 * the browser cannot decode the file (e.g. some HEIC cases).
 */
export async function compressImageFile(
  file: File,
  options?: { maxDimension?: number; quality?: number },
): Promise<File> {
  const maxDimension = options?.maxDimension ?? 1600
  const quality = options?.quality ?? 0.8

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    if (file.size > 10 * 1024 * 1024) {
      throw new PhotoTooLargeError()
    }
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
    return file
  }

  ctx.drawImage(bitmap, 0, 0, targetW, targetH)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/jpeg', quality)
  })

  if (!blob) {
    if (file.size > 10 * 1024 * 1024) throw new PhotoTooLargeError()
    return file
  }

  // Prefer compressed when smaller; otherwise keep original if it fits
  if (blob.size >= file.size && file.size <= 10 * 1024 * 1024) {
    return file
  }

  if (blob.size > 10 * 1024 * 1024) {
    throw new PhotoTooLargeError()
  }

  const base = file.name.replace(/\.[^.]+$/, '') || 'photo'
  return new File([blob], `${base}.jpg`, {
    type: 'image/jpeg',
    lastModified: Date.now(),
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
  return msg || 'Photo upload failed — you can save without a photo and retry later'
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
