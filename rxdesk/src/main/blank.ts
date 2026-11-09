// No Electron imports: unit-tested in tests/blank.test.ts.

/**
 * True if a BGRA bitmap is (almost) one single colour, i.e. nothing was drawn. RxDesk's screens always have
 * text, borders and a sidebar, so a real screen is never this uniform.
 */
export function isBlankBitmap(bgra: Uint8Array, tolerance = 8, maxDifferent = 0.002): boolean {
  if (bgra.length < 4) return true
  const pixels = Math.floor(bgra.length / 4)
  // Reference colour: the centre pixel (a corner can hold a stray pixel, e.g. the mouse cursor).
  const c = Math.floor(pixels / 2) * 4
  const [b0, g0, r0] = [bgra[c], bgra[c + 1], bgra[c + 2]]
  const step = Math.max(1, Math.floor(pixels / 40000)) // sample at most ~40k pixels
  let checked = 0
  let different = 0
  for (let i = 0; i < pixels; i += step) {
    const o = i * 4
    checked++
    if (Math.abs(bgra[o] - b0) > tolerance || Math.abs(bgra[o + 1] - g0) > tolerance || Math.abs(bgra[o + 2] - r0) > tolerance) different++
  }
  return different / checked <= maxDifferent
}

