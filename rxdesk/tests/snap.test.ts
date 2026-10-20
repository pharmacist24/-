import { describe, expect, it } from 'vitest'
import { resizeRect, scaleRect, snapMove, type SnapContext } from '../src/shared/layout/snap'

const ctx: SnapContext = {
  pageW: 148,
  pageH: 210,
  margins: { top: 8, right: 8, bottom: 8, left: 8 },
  others: [{ x: 50, y: 50, w: 40, h: 10 }],
  gridSize: 2,
  snapToGrid: true,
  threshold: 1.5
}

describe('designer snapping', () => {
  it('snaps to another element edge and reports a guide', () => {
    const r = snapMove({ x: 50.9, y: 100.3, w: 20, h: 5 }, ctx)
    expect(r.rect.x).toBe(50)
    expect(r.guides).toContainEqual({ orientation: 'v', pos: 50 })
    expect(r.rect.y).toBe(100) // grid on the y axis
  })

  it('snaps element centre to the page centre', () => {
    const r = snapMove({ x: 63.5, y: 120, w: 20, h: 6 }, ctx) // centre 73.5 ~ 74
    expect(r.rect.x + 10).toBe(74)
    expect(r.guides.some((g) => g.orientation === 'v' && g.pos === 74)).toBe(true)
  })

  it('falls back to the grid, and can be disabled', () => {
    expect(snapMove({ x: 31.1, y: 141.2, w: 5, h: 5 }, ctx).rect).toMatchObject({ x: 32, y: 142 })
    expect(snapMove({ x: 31.1, y: 141.2, w: 5, h: 5 }, { ...ctx, disabled: true }).rect).toMatchObject({ x: 31.1, y: 141.2 })
  })

  it('resizes from any handle with a minimum size', () => {
    const start = { x: 20, y: 20, w: 30, h: 10 }
    expect(resizeRect(start, 'se', 10, 6, { ...ctx, snapToGrid: false, others: [] }).rect).toEqual({ x: 20, y: 20, w: 40, h: 16 })
    expect(resizeRect(start, 'nw', -4, -4, { ...ctx, snapToGrid: false, others: [] }).rect).toEqual({ x: 16, y: 16, w: 34, h: 14 })
    expect(resizeRect(start, 'w', 100, 0, { ...ctx, snapToGrid: false, others: [] }).rect.w).toBe(2)
  })

  it('scales rectangles for a new paper size', () => {
    expect(scaleRect({ x: 10, y: 20, w: 30, h: 40 }, 2, 0.5)).toEqual({ x: 20, y: 10, w: 60, h: 20 })
  })
})
