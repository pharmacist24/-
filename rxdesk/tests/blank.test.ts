import { describe, expect, it } from 'vitest'
import { isBlankBitmap } from '../src/main/blank'

const image = (w: number, h: number, fill: [number, number, number]) => {
  const buf = new Uint8Array(w * h * 4)
  for (let i = 0; i < w * h; i++) buf.set([fill[0], fill[1], fill[2], 255], i * 4)
  return buf
}

describe('white-window detection', () => {
  it('a plain white or plain background image is blank', () => {
    expect(isBlankBitmap(image(1366, 768, [255, 255, 255]))).toBe(true)
    expect(isBlankBitmap(image(800, 600, [249, 246, 244]))).toBe(true)
  })
  it('a screen with a sidebar and text is not blank', () => {
    const img = image(1366, 768, [249, 246, 244])
    for (let y = 0; y < 768; y++) for (let x = 1134; x < 1366; x++) img.set([255, 255, 255, 255], (y * 1366 + x) * 4) // sidebar
    for (let y = 30; y < 60; y++) for (let x = 900; x < 1100; x++) img.set([20, 20, 20, 255], (y * 1366 + x) * 4) // title
    expect(isBlankBitmap(img)).toBe(false)
  })
  it('a few stray pixels (cursor) still count as blank', () => {
    const img = image(1000, 700, [255, 255, 255])
    for (let x = 0; x < 20; x++) img.set([0, 0, 0, 255], x * 4)
    expect(isBlankBitmap(img)).toBe(true)
  })
})
