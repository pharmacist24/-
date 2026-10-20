// Snapping math for the Print Format Designer (pure functions, all values in mm).

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface Guide {
  /** 'v' = vertical line at x = pos, 'h' = horizontal line at y = pos */
  orientation: 'v' | 'h'
  pos: number
}

export interface SnapContext {
  pageW: number
  pageH: number
  margins: { top: number; right: number; bottom: number; left: number }
  /** Other elements to align with */
  others: Rect[]
  gridSize: number
  snapToGrid: boolean
  /** Max distance (mm) for alignment snapping */
  threshold: number
  /** Disable all snapping (e.g. while Alt is held) */
  disabled?: boolean
}

export type Handle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

const round = (v: number, step: number) => Math.round(v / step) * step
const clean = (v: number) => Math.round(v * 100) / 100

function candidates(ctx: SnapContext, axis: 'x' | 'y'): number[] {
  const out: number[] = []
  if (axis === 'x') {
    out.push(0, ctx.pageW, ctx.pageW / 2, ctx.margins.left, ctx.pageW - ctx.margins.right)
    for (const o of ctx.others) out.push(o.x, o.x + o.w / 2, o.x + o.w)
  } else {
    out.push(0, ctx.pageH, ctx.pageH / 2, ctx.margins.top, ctx.pageH - ctx.margins.bottom)
    for (const o of ctx.others) out.push(o.y, o.y + o.h / 2, o.y + o.h)
  }
  return out
}

/** Best alignment for any of `lines`; returns the offset to apply and the guide position. */
function bestSnap(lines: number[], cands: number[], threshold: number): { offset: number; guide: number } | null {
  let best: { offset: number; guide: number } | null = null
  for (const l of lines) {
    for (const c of cands) {
      const d = c - l
      if (Math.abs(d) <= threshold && (!best || Math.abs(d) < Math.abs(best.offset))) best = { offset: d, guide: c }
    }
  }
  return best
}

/** Snap a rectangle being moved. Alignment guides win over the grid. */
export function snapMove(r: Rect, ctx: SnapContext): { rect: Rect; guides: Guide[] } {
  if (ctx.disabled) return { rect: { ...r, x: clean(r.x), y: clean(r.y) }, guides: [] }
  const guides: Guide[] = []
  let { x, y } = r
  const sx = bestSnap([r.x, r.x + r.w / 2, r.x + r.w], candidates(ctx, 'x'), ctx.threshold)
  if (sx) {
    x += sx.offset
    guides.push({ orientation: 'v', pos: sx.guide })
  } else if (ctx.snapToGrid) x = round(x, ctx.gridSize)
  const sy = bestSnap([r.y, r.y + r.h / 2, r.y + r.h], candidates(ctx, 'y'), ctx.threshold)
  if (sy) {
    y += sy.offset
    guides.push({ orientation: 'h', pos: sy.guide })
  } else if (ctx.snapToGrid) y = round(y, ctx.gridSize)
  return { rect: { ...r, x: clean(x), y: clean(y) }, guides }
}

/** Applies a resize drag (dx, dy in mm) for a handle, with snapping of the moving edges. */
export function resizeRect(start: Rect, handle: Handle, dx: number, dy: number, ctx: SnapContext, minSize = 2): { rect: Rect; guides: Guide[] } {
  let left = start.x
  let right = start.x + start.w
  let top = start.y
  let bottom = start.y + start.h
  if (handle.includes('w')) left += dx
  if (handle.includes('e')) right += dx
  if (handle.includes('n')) top += dy
  if (handle.includes('s')) bottom += dy
  const guides: Guide[] = []
  const snapEdge = (v: number, axis: 'x' | 'y'): number => {
    if (ctx.disabled) return v
    const s = bestSnap([v], candidates(ctx, axis), ctx.threshold)
    if (s) {
      guides.push({ orientation: axis === 'x' ? 'v' : 'h', pos: s.guide })
      return v + s.offset
    }
    return ctx.snapToGrid ? round(v, ctx.gridSize) : v
  }
  if (handle.includes('w')) left = Math.min(snapEdge(left, 'x'), right - minSize)
  if (handle.includes('e')) right = Math.max(snapEdge(right, 'x'), left + minSize)
  if (handle.includes('n')) top = Math.min(snapEdge(top, 'y'), bottom - minSize)
  if (handle.includes('s')) bottom = Math.max(snapEdge(bottom, 'y'), top + minSize)
  return { rect: { x: clean(left), y: clean(top), w: clean(right - left), h: clean(bottom - top) }, guides }
}

/** Scales element rectangles when the paper size changes. */
export function scaleRect(r: Rect, sx: number, sy: number): Rect {
  return { x: clean(r.x * sx), y: clean(r.y * sy), w: clean(r.w * sx), h: clean(r.h * sy) }
}
