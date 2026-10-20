import { memo, useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import type { ElementType, Layout, LayoutElement, PrintData } from '@shared/layout/types'
import { PX_PER_MM, renderElement } from '@shared/layout/engine'
import { resizeRect, snapMove, type Guide, type Handle } from '@shared/layout/snap'
import classes from './designer.module.css'

export const RULER = 24

interface Props {
  layout: Layout
  data: PrintData
  zoom: number
  selectedId: string | null
  onSelect: (id: string | null) => void
  onBegin: () => void
  onPreview: (l: Layout) => void
  onCommit: () => void
  onDropNew: (type: ElementType, xMm: number, yMm: number) => void
  onZoom: (z: number) => void
}

/** Renders the element exactly like the printout (same engine output). */
const ElementVisual = memo(function ElementVisual({ el, data }: { el: LayoutElement; data: PrintData }) {
  const html = renderElement(el, data, { page: 1, pages: 1, medIndexes: data.rx.items.map((_, i) => i), designer: true })
  return <div style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: html }} />
})

const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

function Ruler({ lengthMm, scale, orientation, highlight }: { lengthMm: number; scale: number; orientation: 'h' | 'v'; highlight?: [number, number] }) {
  const ticks: JSX.Element[] = []
  const labelEvery = scale < 2.5 ? 20 : 10
  for (let mm = 0; mm <= Math.floor(lengthMm); mm++) {
    const major = mm % 10 === 0
    const mid = mm % 5 === 0
    if (!major && !mid && scale < 3) continue
    const len = major ? 10 : mid ? 6 : 3
    const p = mm * scale
    ticks.push(
      orientation === 'h' ? (
        <line key={mm} x1={p} x2={p} y1={RULER} y2={RULER - len} stroke="#7a8592" strokeWidth={major ? 1 : 0.7} />
      ) : (
        <line key={mm} y1={p} y2={p} x1={RULER} x2={RULER - len} stroke="#7a8592" strokeWidth={major ? 1 : 0.7} />
      )
    )
    if (mm % labelEvery === 0 && mm > 0) {
      ticks.push(
        orientation === 'h' ? (
          <text key={'t' + mm} x={p + 2} y={10} fontSize={9} fill="#5c6670">
            {mm}
          </text>
        ) : (
          <text key={'t' + mm} x={3} y={p - 2} fontSize={9} fill="#5c6670">
            {mm}
          </text>
        )
      )
    }
  }
  const size = lengthMm * scale
  return (
    <svg width={orientation === 'h' ? size : RULER} height={orientation === 'h' ? RULER : size} className={classes.ruler} style={{ fontFamily: 'Roboto, sans-serif' }}>
      {highlight &&
        (orientation === 'h' ? (
          <rect x={highlight[0] * scale} y={0} width={(highlight[1] - highlight[0]) * scale} height={RULER} fill="rgba(34,139,230,.18)" />
        ) : (
          <rect y={highlight[0] * scale} x={0} height={(highlight[1] - highlight[0]) * scale} width={RULER} fill="rgba(34,139,230,.18)" />
        ))}
      {ticks}
    </svg>
  )
}

export default function Canvas({ layout, data, zoom, selectedId, onSelect, onBegin, onPreview, onCommit, onDropNew, onZoom }: Props) {
  const s = zoom * PX_PER_MM // px per mm on screen
  const W = layout.paper.widthMm
  const H = layout.paper.heightMm
  const pageRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [guides, setGuides] = useState<Guide[]>([])
  const drag = useRef<{
    id: string
    handle: Handle | null
    startX: number
    startY: number
    start: LayoutElement
    base: Layout
    moved: boolean
  } | null>(null)

  // Global pointer listeners while dragging.
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = drag.current
      if (!d) return
      const dxPx = e.clientX - d.startX
      const dyPx = e.clientY - d.startY
      if (!d.moved && Math.abs(dxPx) < 2 && Math.abs(dyPx) < 2) return
      if (!d.moved) {
        d.moved = true
        onBegin()
      }
      const ctx = {
        pageW: W,
        pageH: H,
        margins: layout.marginsMm,
        others: d.base.elements.filter((x) => x.id !== d.id).map((x) => ({ x: x.x, y: x.y, w: x.w, h: x.h })),
        gridSize: layout.grid.sizeMm,
        snapToGrid: layout.grid.snap,
        threshold: 6 / s,
        disabled: e.altKey
      }
      const res = d.handle
        ? resizeRect(d.start, d.handle, dxPx / s, dyPx / s, ctx)
        : snapMove({ x: d.start.x + dxPx / s, y: d.start.y + dyPx / s, w: d.start.w, h: d.start.h }, ctx)
      setGuides(res.guides)
      onPreview({ ...d.base, elements: d.base.elements.map((x) => (x.id === d.id ? { ...x, ...res.rect } : x)) })
    }
    const up = () => {
      const d = drag.current
      drag.current = null
      setGuides([])
      if (d?.moved) onCommit()
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [W, H, s, layout, onBegin, onPreview, onCommit])

  // Ctrl + mouse wheel zooms.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      onZoom(Math.min(4, Math.max(0.3, zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1))))
    }
    el.addEventListener('wheel', wheel, { passive: false })
    return () => el.removeEventListener('wheel', wheel)
  }, [zoom, onZoom])

  const startDrag = (e: RPointerEvent, el: LayoutElement, handle: Handle | null) => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    // Leave any property box so arrow keys / Delete act on the element.
    ;(document.activeElement as HTMLElement | null)?.blur?.()
    onSelect(el.id)
    if (el.locked) return
    drag.current = { id: el.id, handle, startX: e.clientX, startY: e.clientY, start: el, base: layout, moved: false }
  }

  const sel = layout.elements.find((e) => e.id === selectedId) ?? null
  const hs = 9 / s // handle size in mm (constant on screen)
  const line = 1 / s

  return (
    <div ref={scrollRef} className={classes.scroll} dir="ltr" onPointerDown={() => {
        ;(document.activeElement as HTMLElement | null)?.blur?.()
        onSelect(null)
      }} id="designer-canvas">
      <div className={classes.stage} style={{ width: W * s + RULER + 64, height: H * s + RULER + 64 }}>
        <div className={classes.corner} style={{ left: 32, top: 32, width: RULER, height: RULER }}>
          mm
        </div>
        <div style={{ position: 'absolute', left: RULER + 32, top: 32 }}>
          <Ruler lengthMm={W} scale={s} orientation="h" highlight={sel ? [sel.x, sel.x + sel.w] : undefined} />
        </div>
        <div style={{ position: 'absolute', top: RULER + 32, left: 32 }}>
          <Ruler lengthMm={H} scale={s} orientation="v" highlight={sel ? [sel.y, sel.y + sel.h] : undefined} />
        </div>
        <div
          ref={pageRef}
          className={classes.pageHolder}
          style={{ left: RULER + 32, top: RULER + 32, width: W * s, height: H * s }}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes('application/x-rxdesk-element')) e.preventDefault()
          }}
          onDrop={(e) => {
            const type = e.dataTransfer.getData('application/x-rxdesk-element') as ElementType
            if (!type) return
            e.preventDefault()
            const r = pageRef.current!.getBoundingClientRect()
            onDropNew(type, (e.clientX - r.left) / s, (e.clientY - r.top) / s)
          }}
        >
          <div className="rx-page" dir={layout.direction} style={{ position: 'absolute', left: 0, top: 0, width: `${W}mm`, height: `${H}mm`, transform: `scale(${zoom})`, transformOrigin: '0 0' }}>
            {layout.background.dataUrl && <img className="rx-bg" src={layout.background.dataUrl} style={{ opacity: layout.background.opacity }} alt="" />}
            {layout.grid.show && (
              <div
                className={classes.grid}
                style={{
                  backgroundSize: `${layout.grid.sizeMm}mm ${layout.grid.sizeMm}mm, ${layout.grid.sizeMm}mm ${layout.grid.sizeMm}mm, 10mm 10mm, 10mm 10mm`
                }}
              />
            )}
            <div
              className={classes.margins}
              style={{
                left: `${layout.marginsMm.left}mm`,
                top: `${layout.marginsMm.top}mm`,
                right: `${layout.marginsMm.right}mm`,
                bottom: `${layout.marginsMm.bottom}mm`,
                borderWidth: `${line}mm`
              }}
            />
            {layout.elements.map((el) => (
              <ElementVisual key={el.id} el={el} data={data} />
            ))}
            {layout.elements.map((el) => (
              <div
                key={'hit-' + el.id}
                className={classes.hit}
                data-selected={el.id === selectedId || undefined}
                data-locked={el.locked || undefined}
                data-el-type={el.type}
                data-el-id={el.id}
                style={{ left: `${el.x}mm`, top: `${el.y}mm`, width: `${el.w}mm`, height: `${el.h}mm`, outlineWidth: `${line * (el.id === selectedId ? 2 : 1)}mm` }}
                onPointerDown={(e) => startDrag(e, el, null)}
              />
            ))}
            {sel &&
              !sel.locked &&
              HANDLES.map((h) => {
                const x = h.includes('w') ? sel.x : h.includes('e') ? sel.x + sel.w : sel.x + sel.w / 2
                const y = h.includes('n') ? sel.y : h.includes('s') ? sel.y + sel.h : sel.y + sel.h / 2
                return (
                  <div
                    key={h}
                    className={classes.handle}
                    data-handle={h}
                    style={{ left: `${x - hs / 2}mm`, top: `${y - hs / 2}mm`, width: `${hs}mm`, height: `${hs}mm`, borderWidth: `${line}mm`, cursor: `${h}-resize` }}
                    onPointerDown={(e) => startDrag(e, sel, h)}
                  />
                )
              })}
            {guides.map((g, i) => (
              <div
                key={i}
                className={classes.guide}
                style={g.orientation === 'v' ? { left: `${g.pos}mm`, top: 0, bottom: 0, width: `${line}mm` } : { top: `${g.pos}mm`, left: 0, right: 0, height: `${line}mm` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
