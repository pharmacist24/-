import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActionIcon, Badge, Button, Divider, Group, Menu, Modal, Radio, Select, Stack, Text, TextInput, Tooltip } from '@mantine/core'
import { modals } from '@mantine/modals'
import {
  IconArrowBackUp,
  IconArrowForwardUp,
  IconChevronDown,
  IconDeviceFloppy,
  IconDotsVertical,
  IconDownload,
  IconEye,
  IconFileImport,
  IconPlus,
  IconPrinter,
  IconStar,
  IconTrash,
  IconZoomIn,
  IconZoomOut
} from '@tabler/icons-react'
import type { LayoutRecord } from '@shared/types'
import type { ElementType, Layout, LayoutElement } from '@shared/layout/types'
import { blankLayout, createElement, sampleA4Layout, sampleA5Layout, uid } from '@shared/layout/defaults'
import { LAYOUT_CSS, PX_PER_MM, samplePrintData } from '@shared/layout/engine'
import { api } from '../lib/api'
import { useApp } from '../lib/app-context'
import { notifyError, notifyOk } from '../lib/notify'
import { usePrinting } from '../print/usePrinting'
import { useHistory } from '../designer/useHistory'
import Canvas, { RULER } from '../designer/Canvas'
import Palette from '../designer/Palette'
import ElementPanel from '../designer/ElementPanel'
import PagePanel from '../designer/PagePanel'
import classes from '../designer/designer.module.css'

type StartFrom = 'a5' | 'a4' | 'blankA5' | 'blankA4' | 'copy'

export default function DesignerScreen() {
  const { t, lang, profile, settings, setLeaveGuard } = useApp()
  const [records, setRecords] = useState<LayoutRecord[]>([])
  const [currentId, setCurrentId] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [saved, setSaved] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [newOpen, setNewOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [startFrom, setStartFrom] = useState<StartFrom>('a5')
  const [busy, setBusy] = useState(false)
  const h = useHistory<Layout>(blankLayout('A5'))
  const layout = h.present
  const canvasWrap = useRef<HTMLDivElement>(null)
  const printing = usePrinting()

  const data = useMemo(() => samplePrintData(profile, settings.printLanguage), [profile, settings.printLanguage])
  const dirty = currentId !== null && JSON.stringify({ name, layout }) !== saved

  useEffect(() => {
    setLeaveGuard(() => dirty)
  }, [dirty, setLeaveGuard])
  useEffect(() => () => setLeaveGuard(null), [setLeaveGuard])

  const fitZoom = useCallback((l: Layout) => {
    const el = canvasWrap.current
    if (!el) return
    const w = el.clientWidth - RULER - 80
    const hgt = el.clientHeight - RULER - 80
    const z = Math.min(w / (l.paper.widthMm * PX_PER_MM), hgt / (l.paper.heightMm * PX_PER_MM))
    setZoom(Math.max(0.3, Math.min(3, Math.round(z * 100) / 100)))
  }, [])

  const open = useCallback(
    (rec: LayoutRecord) => {
      setCurrentId(rec.id)
      setName(rec.name)
      h.reset(rec.layout)
      setSaved(JSON.stringify({ name: rec.name, layout: rec.layout }))
      setSelectedId(null)
      setTimeout(() => fitZoom(rec.layout), 0)
    },
    [h, fitZoom]
  )

  const reload = useCallback(
    async (selectId?: number) => {
      const list = await api.layouts.list()
      setRecords(list)
      const target = list.find((l) => l.id === selectId) ?? list.find((l) => l.isDefault) ?? list[0]
      if (target) open(target)
    },
    [open]
  )

  useEffect(() => {
    reload().catch((e) => notifyError(e, t))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const confirmDiscard = (then: () => void) => {
    if (!dirty) return then()
    modals.openConfirmModal({
      title: t('c.unsavedTitle'),
      children: <Text>{t('c.unsavedText')}</Text>,
      labels: { confirm: t('c.leave'), cancel: t('c.stay') },
      confirmProps: { color: 'red' },
      onConfirm: then
    })
  }

  const save = useCallback(async (): Promise<number | null> => {
    if (currentId === null) return null
    setBusy(true)
    try {
      const rec = await api.layouts.save({ id: currentId, name: name.trim() || 'Layout', layout })
      setSaved(JSON.stringify({ name: rec.name, layout }))
      setName(rec.name)
      setRecords(await api.layouts.list())
      notifyOk(t('d.saved'))
      return rec.id
    } catch (e) {
      notifyError(e, t)
      return null
    } finally {
      setBusy(false)
    }
  }, [currentId, name, layout, t])

  // ------------------------------------------------------------ element edits
  const updateEl = useCallback(
    (id: string, patch: Partial<LayoutElement>, mergeKey?: string) => {
      h.apply({ ...layout, elements: layout.elements.map((e) => (e.id === id ? { ...e, ...patch } : e)) }, mergeKey)
    },
    [h, layout]
  )

  const addElement = (type: ElementType, at?: { x: number; y: number }) => {
    const existing = type === 'medicines' ? layout.elements.find((e) => e.type === 'medicines') : null
    if (existing) {
      setSelectedId(existing.id)
      return
    }
    const el = createElement(type, {}, lang)
    const W = layout.paper.widthMm
    const H = layout.paper.heightMm
    const x = at ? at.x - el.w / 2 : (W - el.w) / 2
    const y = at ? at.y - el.h / 2 : (H - el.h) / 2
    el.x = Math.round(Math.max(0, Math.min(W - el.w, x)))
    el.y = Math.round(Math.max(0, Math.min(H - el.h, y)))
    h.apply({ ...layout, elements: [...layout.elements, el] })
    setSelectedId(el.id)
  }

  const removeSelected = () => {
    if (!selectedId) return
    h.apply({ ...layout, elements: layout.elements.filter((e) => e.id !== selectedId) })
    setSelectedId(null)
  }

  const duplicateSelected = () => {
    const el = layout.elements.find((e) => e.id === selectedId)
    if (!el || el.type === 'medicines') return
    const copy = { ...structuredClone(el), id: uid(), x: el.x + 3, y: el.y + 3, locked: false }
    h.apply({ ...layout, elements: [...layout.elements, copy] })
    setSelectedId(copy.id)
  }

  const reorder = (front: boolean) => {
    const el = layout.elements.find((e) => e.id === selectedId)
    if (!el) return
    const rest = layout.elements.filter((e) => e.id !== selectedId)
    h.apply({ ...layout, elements: front ? [...rest, el] : [el, ...rest] })
  }

  // ------------------------------------------------------------ keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const typing = target.closest('input, textarea, select, [contenteditable=true]')
      const inModal = !!target.closest('.mantine-Modal-content')
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void save()
        return
      }
      if (typing || inModal) return
      if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault()
        h.undo()
      } else if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        e.preventDefault()
        h.redo()
      } else if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        duplicateSelected()
      } else if (mod && (e.key === '+' || e.key === '=')) {
        e.preventDefault()
        setZoom((z) => Math.min(4, z * 1.15))
      } else if (mod && e.key === '-') {
        e.preventDefault()
        setZoom((z) => Math.max(0.3, z / 1.15))
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedId) {
          e.preventDefault()
          removeSelected()
        }
      } else if (e.key === 'Escape') {
        setSelectedId(null)
      } else if (e.key.startsWith('Arrow') && selectedId) {
        const el = layout.elements.find((x) => x.id === selectedId)
        if (!el || el.locked) return
        e.preventDefault()
        const step = e.shiftKey ? 0.1 : 1
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
        updateEl(el.id, { x: Math.round((el.x + dx) * 100) / 100, y: Math.round((el.y + dy) * 100) / 100 }, 'nudge.' + el.id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // ------------------------------------------------------------ layout management
  const createLayout = async () => {
    const base: Layout =
      startFrom === 'a5' ? sampleA5Layout() : startFrom === 'a4' ? sampleA4Layout() : startFrom === 'blankA5' ? blankLayout('A5') : startFrom === 'blankA4' ? blankLayout('A4') : structuredClone(layout)
    try {
      const rec = await api.layouts.save({ name: newName.trim() || t('d.newLayout'), layout: base })
      setNewOpen(false)
      await reload(rec.id)
    } catch (e) {
      notifyError(e, t)
    }
  }

  const deleteLayout = () => {
    if (currentId === null) return
    modals.openConfirmModal({
      title: t('d.deleteLayout'),
      children: <Text>{t('c.deleteConfirm', { name })}</Text>,
      labels: { confirm: t('c.delete'), cancel: t('c.cancel') },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await api.layouts.delete(currentId)
          setSaved(JSON.stringify({ name, layout }))
          await reload()
        } catch (e) {
          notifyError(e, t)
        }
      }
    })
  }

  const exportLayout = async () => {
    const id = dirty ? await save() : currentId
    if (!id) return
    try {
      const p = await api.layouts.exportToFile(id)
      if (p) notifyOk(t('d.exported'))
    } catch (e) {
      notifyError(e, t)
    }
  }

  const importLayout = () =>
    confirmDiscard(async () => {
      try {
        const rec = await api.layouts.importFromFile()
        if (rec) {
          notifyOk(t('d.imported'))
          await reload(rec.id)
        }
      } catch (e) {
        notifyError(e, t)
      }
    })

  const current = records.find((r) => r.id === currentId)
  const selected = layout.elements.find((e) => e.id === selectedId) ?? null

  return (
    <div className={classes.screen}>
      <style>{LAYOUT_CSS}</style>
      <div className={classes.toolbar}>
        <Select
          w={210}
          size="sm"
          value={currentId ? String(currentId) : null}
          data={records.map((r) => ({ value: String(r.id), label: r.name + (r.isDefault ? ' ★' : '') }))}
          onChange={(v) => {
            const rec = records.find((r) => String(r.id) === v)
            if (rec && rec.id !== currentId) confirmDiscard(() => open(rec))
          }}
          aria-label={t('d.layouts')}
          id="layout-select"
        />
        {dirty && (
          <Badge color="orange" variant="light">
            {t('d.unsaved')}
          </Badge>
        )}
        <Tooltip label={t('d.newLayout')}>
          <ActionIcon variant="default" size="lg" onClick={() => confirmDiscard(() => { setNewName(''); setNewOpen(true) })} id="new-layout">
            <IconPlus size={18} />
          </ActionIcon>
        </Tooltip>
        <Divider orientation="vertical" />
        <Tooltip label={t('c.undo') + ' (Ctrl+Z)'}>
          <ActionIcon variant="default" size="lg" disabled={!h.canUndo} onClick={h.undo} id="undo">
            <IconArrowBackUp size={18} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label={t('c.redo') + ' (Ctrl+Y)'}>
          <ActionIcon variant="default" size="lg" disabled={!h.canRedo} onClick={h.redo} id="redo">
            <IconArrowForwardUp size={18} />
          </ActionIcon>
        </Tooltip>
        <Divider orientation="vertical" />
        <Tooltip label={t('d.zoom')}>
          <ActionIcon variant="default" size="lg" onClick={() => setZoom((z) => Math.max(0.3, z / 1.15))}>
            <IconZoomOut size={18} />
          </ActionIcon>
        </Tooltip>
        <Text fz="sm" w={46} ta="center" dir="ltr">
          {Math.round(zoom * 100)}%
        </Text>
        <ActionIcon variant="default" size="lg" onClick={() => setZoom((z) => Math.min(4, z * 1.15))}>
          <IconZoomIn size={18} />
        </ActionIcon>
        <Button size="sm" variant="subtle" px={6} onClick={() => fitZoom(layout)}>
          {t('d.fitZoom')}
        </Button>
        <div style={{ flex: 1 }} />
        <Menu position="bottom-end">
          <Menu.Target>
            <Button size="sm" variant="default" leftSection={<IconEye size={16} />} rightSection={<IconChevronDown size={14} />} data-menu="test">
              {t('d.testPage')}
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item leftSection={<IconEye size={16} />} onClick={() => printing.previewData(layout, data, name)} id="preview-sample">
              {t('d.previewSample')}
            </Menu.Item>
            <Menu.Item leftSection={<IconEye size={16} />} onClick={() => printing.previewData(layout, samplePrintData(profile, settings.printLanguage, true), name)} id="preview-long">
              {t('d.previewSample')} (16 ×)
            </Menu.Item>
            <Menu.Item leftSection={<IconPrinter size={16} />} onClick={() => printing.printData(layout, data, name)}>
              {t('d.testPage')}
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
        <Menu position="bottom-end">
          <Menu.Target>
            <ActionIcon variant="default" size="lg" data-menu="layout">
              <IconDotsVertical size={18} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              leftSection={<IconStar size={16} />}
              disabled={!!current?.isDefault}
              onClick={async () => {
                if (currentId) {
                  await api.layouts.setDefault(currentId)
                  setRecords(await api.layouts.list())
                }
              }}
            >
              {t('c.setDefault')}
            </Menu.Item>
            <Menu.Item leftSection={<IconDownload size={16} />} onClick={exportLayout}>
              {t('c.export')}…
            </Menu.Item>
            <Menu.Item leftSection={<IconFileImport size={16} />} onClick={importLayout}>
              {t('c.import')}…
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item color="red" leftSection={<IconTrash size={16} />} onClick={deleteLayout} disabled={records.length <= 1}>
              {t('d.deleteLayout')}
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
        <Button size="sm" leftSection={<IconDeviceFloppy size={16} />} onClick={() => void save()} loading={busy} disabled={!dirty} id="save-layout">
          {t('c.save')}
        </Button>
      </div>
      <div className={classes.body}>
        <Palette onAdd={(type) => addElement(type)} />
        <div ref={canvasWrap} style={{ flex: 1, minWidth: 0, display: 'flex' }}>
          <Canvas
            layout={layout}
            data={data}
            zoom={zoom}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onBegin={h.begin}
            onPreview={h.preview}
            onCommit={h.commit}
            onDropNew={(type, x, y) => addElement(type, { x, y })}
            onZoom={setZoom}
          />
        </div>
        <div className={classes.props}>
          {selected ? (
            <ElementPanel
              key={selected.id}
              el={selected}
              onChange={(patch, key) => updateEl(selected.id, patch, key)}
              onDelete={removeSelected}
              onDuplicate={duplicateSelected}
              onFront={() => reorder(true)}
              onBack={() => reorder(false)}
            />
          ) : (
            <PagePanel name={name} onName={setName} layout={layout} onChange={(l, key) => h.apply(l, key)} />
          )}
          <Text fz={11} c="dimmed" px="md" pb="md">
            {t('d.shortcuts')}
          </Text>
        </div>
      </div>

      <Modal opened={newOpen} onClose={() => setNewOpen(false)} title={<Text fw={700}>{t('d.newLayout')}</Text>}>
        <Stack>
          <TextInput label={t('d.layoutName')} value={newName} onChange={(e) => setNewName(e.currentTarget.value)} data-autofocus id="new-layout-name" />
          <Radio.Group label={t('d.startFrom')} value={startFrom} onChange={(v) => setStartFrom(v as StartFrom)}>
            <Stack gap={8} mt={6}>
              <Radio value="a5" label={'A5 – ' + t('d.medList')} />
              <Radio value="a4" label={'A4 – ' + t('d.medTable')} />
              <Radio value="blankA5" label={'A5 – ' + t('d.blank')} />
              <Radio value="blankA4" label={'A4 – ' + t('d.blank')} />
              <Radio value="copy" label={t('d.copyCurrent')} />
            </Stack>
          </Radio.Group>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setNewOpen(false)}>
              {t('c.cancel')}
            </Button>
            <Button onClick={createLayout} id="create-layout">
              {t('c.add')}
            </Button>
          </Group>
        </Stack>
      </Modal>
      {printing.element}
    </div>
  )
}
