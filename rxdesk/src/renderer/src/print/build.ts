import type { Layout, PrintData } from '@shared/layout/types'
import { paginate, PX_PER_MM, renderDocument } from '@shared/layout/engine'
import { EMBEDDED_FONTS } from '../lib/fonts'

export interface BuiltDocument {
  html: string
  pages: number
  widthMm: number
  heightMm: number
}

async function loadInFrame(html: string, widthMm: number): Promise<{ frame: HTMLIFrameElement; doc: Document }> {
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.cssText = `position:fixed;left:-20000px;top:0;width:${Math.ceil(widthMm * PX_PER_MM) + 40}px;height:2000px;border:0;visibility:hidden`
  const loaded = new Promise<void>((resolve) => frame.addEventListener('load', () => resolve(), { once: true }))
  frame.srcdoc = html
  document.body.appendChild(frame)
  await loaded
  const doc = frame.contentDocument!
  await doc.fonts.ready
  return { frame, doc }
}

/**
 * Builds the final printable HTML: measures each medicine at its real size with the
 * real fonts, splits them over as many pages as needed, then renders the pages.
 */
export async function buildDocument(layout: Layout, data: PrintData, opts: { applyOffset?: boolean; title?: string } = {}): Promise<BuiltDocument> {
  const base = { widthMm: layout.paper.widthMm, heightMm: layout.paper.heightMm }
  const med = layout.elements.find((e) => e.type === 'medicines')
  let medPages: number[][] | undefined
  if (med && data.rx.items.length > 1) {
    const { frame, doc } = await loadInFrame(renderDocument(layout, data, { mode: 'measure', fonts: EMBEDDED_FONTS }), layout.paper.widthMm)
    try {
      const block = doc.getElementById('rx-measure')!
      const items = Array.from(block.querySelectorAll<HTMLElement>('[data-med]'))
      const top = block.getBoundingClientRect().top
      const first = items[0]?.getBoundingClientRect().top ?? top
      const gap = med.medicines!.style === 'list' ? med.medicines!.rowGapMm * PX_PER_MM : 0
      medPages = paginate(
        {
          itemHeights: items.map((el) => el.getBoundingClientRect().height),
          headerHeight: first - top,
          gap
        },
        med.h * PX_PER_MM
      )
    } finally {
      frame.remove()
    }
  }
  const html = renderDocument(layout, data, { mode: 'final', medPages, fonts: EMBEDDED_FONTS, applyOffset: opts.applyOffset, title: opts.title })
  return { html, pages: medPages?.length ?? 1, ...base }
}
