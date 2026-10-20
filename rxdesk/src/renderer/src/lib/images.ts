/**
 * Reads an image file and returns a data URL, scaled down so the database stays small.
 * PNG is kept for logos (transparency); photos/scans become JPEG.
 */
export async function imageFileToDataUrl(
  file: File,
  maxPx: number,
  opts: { keepPng?: boolean; quality?: number } = {}
): Promise<string> {
  const original = await new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = () => reject(new Error('Not an image'))
    i.src = original
  })
  const scale = Math.min(1, maxPx / Math.max(img.naturalWidth, img.naturalHeight))
  const w = Math.max(1, Math.round(img.naturalWidth * scale))
  const h = Math.max(1, Math.round(img.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  const png = opts.keepPng && /png|svg|webp|gif/.test(file.type)
  if (!png) {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
  }
  ctx.drawImage(img, 0, 0, w, h)
  return png ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', opts.quality ?? 0.88)
}

export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.onchange = () => resolve(input.files?.[0] ?? null)
    input.click()
  })
}
