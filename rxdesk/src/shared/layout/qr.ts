import QRCode from 'qrcode'

/** Builds an SVG QR code synchronously (no canvas, works in print and tests). */
export function qrSvg(text: string, color = '#000000'): string {
  const qr = QRCode.create(text || ' ', { errorCorrectionLevel: 'M' })
  const size = qr.modules.size
  const data = qr.modules.data
  const margin = 1
  let path = ''
  for (let y = 0; y < size; y++) {
    // Merge horizontal runs of dark modules to keep the SVG small.
    let x = 0
    while (x < size) {
      if (!data[y * size + x]) {
        x++
        continue
      }
      let run = 1
      while (x + run < size && data[y * size + x + run]) run++
      path += `M${x + margin},${y + margin}h${run}v1h-${run}z`
      x += run
    }
  }
  const total = size + margin * 2
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="100%" height="100%" shape-rendering="crispEdges" preserveAspectRatio="xMidYMid meet"><path fill="${color}" d="${path}"/></svg>`
}
