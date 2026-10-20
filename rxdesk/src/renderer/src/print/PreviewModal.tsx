import { useEffect, useRef, useState } from 'react'
import { Badge, Button, Group, Loader, Modal, Stack, Text } from '@mantine/core'
import { IconFileTypePdf, IconPrinter } from '@tabler/icons-react'
import { PX_PER_MM } from '@shared/layout/engine'
import { useT } from '../lib/app-context'
import type { BuiltDocument } from './build'

/** Shows the exact document that will be printed (same HTML), scaled to fit the window. */
export default function PreviewModal({
  doc,
  title,
  opened,
  onClose,
  onPrint,
  onPdf
}: {
  doc: BuiltDocument | null
  title: string
  opened: boolean
  onClose: () => void
  onPrint: () => Promise<void>
  onPdf: () => Promise<void>
}) {
  const t = useT()
  const wrap = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [busy, setBusy] = useState('')

  useEffect(() => {
    if (!doc || !opened) return
    const fit = () => {
      const w = wrap.current?.clientWidth ?? 800
      const pageW = doc.widthMm * PX_PER_MM + 40
      setScale(Math.min(1.25, (w - 24) / pageW))
    }
    fit()
    const id = setTimeout(fit, 50)
    window.addEventListener('resize', fit)
    return () => {
      clearTimeout(id)
      window.removeEventListener('resize', fit)
    }
  }, [doc, opened])

  const pageH = doc ? doc.heightMm * PX_PER_MM : 0
  const frameW = doc ? doc.widthMm * PX_PER_MM + 40 : 0
  const frameH = doc ? doc.pages * (pageH + 6 * PX_PER_MM) + 12 * PX_PER_MM : 0

  const run = async (k: string, fn: () => Promise<void>) => {
    setBusy(k)
    try {
      await fn()
    } finally {
      setBusy('')
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="min(1100px, 92vw)"
      title={
        <Group gap="sm">
          <Text fw={700}>{t('pv.title')}</Text>
          <Text c="dimmed">{title}</Text>
          {doc && <Badge variant="light">{t('pv.pages', { n: doc.pages })}</Badge>}
        </Group>
      }
      styles={{ body: { padding: 0 } }}
    >
      <Stack gap={0}>
        <div ref={wrap} style={{ background: '#d5dae1', height: '72vh', overflow: 'auto' }} id="preview-scroll">
          {!doc ? (
            <Group justify="center" p="xl">
              <Loader />
            </Group>
          ) : (
            <div style={{ width: frameW * scale, height: frameH * scale, margin: '0 auto' }}>
              <iframe
                title="preview"
                srcDoc={doc.html}
                style={{ width: frameW, height: frameH, border: 0, transform: `scale(${scale})`, transformOrigin: '0 0', display: 'block' }}
                id="preview-frame"
              />
            </div>
          )}
        </div>
        <Group justify="flex-end" p="md">
          <Button variant="default" onClick={onClose}>
            {t('c.close')}
          </Button>
          <Button variant="light" leftSection={<IconFileTypePdf size={18} />} disabled={!doc} loading={busy === 'pdf'} onClick={() => run('pdf', onPdf)} id="preview-pdf">
            {t('c.pdf')}
          </Button>
          <Button leftSection={<IconPrinter size={18} />} disabled={!doc} loading={busy === 'print'} onClick={() => run('print', onPrint)} data-autofocus id="preview-print">
            {t('c.print')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
