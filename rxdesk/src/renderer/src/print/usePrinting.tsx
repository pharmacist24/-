import { useCallback, useState } from 'react'
import type { Layout, PrintData } from '@shared/layout/types'
import { printDataFromPrescription } from '@shared/layout/engine'
import { api } from '../lib/api'
import { useApp } from '../lib/app-context'
import { notifyError, notifyOk } from '../lib/notify'
import { buildDocument, type BuiltDocument } from './build'
import PreviewModal from './PreviewModal'

interface Job {
  layout: Layout
  data: PrintData
  title: string
  fileName: string
}

/**
 * Print / preview / PDF for saved prescriptions (and for test pages).
 * Usage: const printing = usePrinting(); ... printing.printSaved(id); ... {printing.element}
 */
export function usePrinting() {
  const { t, settings, profile } = useApp()
  const [job, setJob] = useState<Job | null>(null)
  const [doc, setDoc] = useState<BuiltDocument | null>(null)
  const [opened, setOpened] = useState(false)

  const jobForSaved = useCallback(
    async (id: number, layoutId?: number): Promise<Job | null> => {
      const rx = await api.rx.get(id)
      if (!rx) return null
      const layouts = await api.layouts.list()
      const rec = layouts.find((l) => l.id === layoutId) ?? layouts.find((l) => l.isDefault) ?? layouts[0]
      const fileName = `Rx-${rx.id}-${rx.patient.name}-${rx.date}`
      return { layout: rec.layout, data: printDataFromPrescription(rx, profile, settings.printLanguage), title: `#${rx.id} · ${rx.patient.name}`, fileName }
    },
    [profile, settings.printLanguage]
  )

  const sendToPrinter = useCallback(
    async (j: Job) => {
      try {
        // Real printing uses the printer calibration offset; preview and PDF do not.
        const built = await buildDocument(j.layout, j.data, { applyOffset: true, title: j.fileName })
        await api.print.print(built.html, {
          silent: settings.silentPrint,
          deviceName: settings.defaultPrinter || undefined,
          copies: settings.copies,
          widthMm: built.widthMm,
          heightMm: built.heightMm
        })
        if (settings.silentPrint) notifyOk(t('rx.printed'))
      } catch (e) {
        notifyError(e, t)
      }
    },
    [settings, t]
  )

  const savePdf = useCallback(
    async (j: Job) => {
      try {
        const built = await buildDocument(j.layout, j.data, { title: j.fileName })
        const path = await api.print.pdf(built.html, { silent: true, widthMm: built.widthMm, heightMm: built.heightMm }, j.fileName)
        if (path) notifyOk(t('rx.pdfSaved'))
      } catch (e) {
        notifyError(e, t)
      }
    },
    [t]
  )

  const preview = useCallback(
    async (j: Job) => {
      setJob(j)
      setDoc(null)
      setOpened(true)
      try {
        setDoc(await buildDocument(j.layout, j.data, { title: j.fileName }))
      } catch (e) {
        setOpened(false)
        notifyError(e, t)
      }
    },
    [t]
  )

  const withSaved = (fn: (j: Job) => Promise<void>) => async (id: number, layoutId?: number) => {
    try {
      const j = await jobForSaved(id, layoutId)
      if (j) await fn(j)
    } catch (e) {
      notifyError(e, t)
    }
  }

  return {
    previewSaved: withSaved(preview),
    printSaved: withSaved(sendToPrinter),
    pdfSaved: withSaved(savePdf),
    /** Preview arbitrary data with a layout (used by the designer's test page). */
    previewData: (layout: Layout, data: PrintData, title: string) => preview({ layout, data, title, fileName: title }),
    printData: (layout: Layout, data: PrintData, title: string) => sendToPrinter({ layout, data, title, fileName: title }),
    element: (
      <PreviewModal
        opened={opened}
        doc={doc}
        title={job?.title ?? ''}
        onClose={() => setOpened(false)}
        onPrint={async () => {
          if (job) await sendToPrinter(job)
          setOpened(false)
        }}
        onPdf={async () => {
          if (job) await savePdf(job)
        }}
      />
    )
  }
}
