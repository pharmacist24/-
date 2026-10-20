import { Button, Divider, Group, Image, NumberInput, SegmentedControl, Select, SimpleGrid, Slider, Stack, Switch, Text, TextInput } from '@mantine/core'
import { IconPhoto, IconTrash } from '@tabler/icons-react'
import { PAPER_SIZES, type Layout, type PaperPreset } from '@shared/layout/types'
import { scaleRect } from '@shared/layout/snap'
import { useT } from '../lib/app-context'
import { imageFileToDataUrl, pickFile } from '../lib/images'
import { notifyError } from '../lib/notify'

/** Settings of the whole page: name, paper, margins, calibration, background, grid. */
export default function PagePanel({
  name,
  onName,
  layout,
  onChange
}: {
  name: string
  onName: (n: string) => void
  layout: Layout
  onChange: (l: Layout, mergeKey?: string) => void
}) {
  const t = useT()

  const setPaper = (preset: PaperPreset, w?: number, h?: number) => {
    const size = preset === 'custom' ? { widthMm: w ?? layout.paper.widthMm, heightMm: h ?? layout.paper.heightMm } : PAPER_SIZES[preset]
    if (size.widthMm < 30 || size.heightMm < 30) return
    // Keep the design proportional on the new paper (fonts stay the same size).
    const sx = size.widthMm / layout.paper.widthMm
    const sy = size.heightMm / layout.paper.heightMm
    onChange(
      {
        ...layout,
        paper: { preset, ...size },
        elements: layout.elements.map((e) => ({ ...e, ...scaleRect(e, sx, sy) }))
      },
      preset === 'custom' ? 'paper' : undefined
    )
  }

  const margin = (k: keyof Layout['marginsMm'], label: string) => (
    <NumberInput size="xs" label={label} value={layout.marginsMm[k]} min={0} max={100} step={1} onChange={(v) => typeof v === 'number' && onChange({ ...layout, marginsMm: { ...layout.marginsMm, [k]: v } }, 'margin.' + k)} />
  )

  const uploadBg = async () => {
    const f = await pickFile('image/png,image/jpeg,image/webp,image/bmp')
    if (!f) return
    try {
      const dataUrl = await imageFileToDataUrl(f, 2400, { quality: 0.85 })
      onChange({ ...layout, background: { ...layout.background, dataUrl } })
    } catch (e) {
      notifyError(e, t)
    }
  }

  return (
    <Stack gap="sm" p="md" id="page-panel">
      <TextInput size="sm" label={t('d.layoutName')} value={name} onChange={(e) => onName(e.currentTarget.value)} id="layout-name" />
      <Text fz="xs" c="dimmed">
        {t('d.noSelection')}
      </Text>
      <Divider label={t('d.paper')} labelPosition="center" />
      <Select
        size="xs"
        label={t('paper.size')}
        value={layout.paper.preset}
        onChange={(v) => v && setPaper(v as PaperPreset)}
        data={(['A5', 'A4', 'Letter', 'custom'] as PaperPreset[]).map((p) => ({ value: p, label: t(`paper.${p}` as 'paper.A4') }))}
        id="paper-preset"
      />
      {layout.paper.preset === 'custom' && (
        <SimpleGrid cols={2} spacing="xs">
          <NumberInput size="xs" label={t('paper.width')} value={layout.paper.widthMm} min={30} max={1000} onChange={(v) => typeof v === 'number' && setPaper('custom', v, undefined)} />
          <NumberInput size="xs" label={t('paper.height')} value={layout.paper.heightMm} min={30} max={2000} onChange={(v) => typeof v === 'number' && setPaper('custom', undefined, v)} />
        </SimpleGrid>
      )}
      <div>
        <Text fz="xs" fw={500} mb={2}>
          {t('d.pageDirection')}
        </Text>
        <SegmentedControl
          size="xs"
          fullWidth
          value={layout.direction}
          onChange={(v) => onChange({ ...layout, direction: v as 'rtl' | 'ltr' })}
          data={[
            { value: 'rtl', label: t('d.dirRtl') },
            { value: 'ltr', label: t('d.dirLtr') }
          ]}
        />
      </div>
      <Text fz="xs" fw={600}>
        {t('d.margins')}
      </Text>
      <SimpleGrid cols={4} spacing={6}>
        {margin('top', t('d.top'))}
        {margin('bottom', t('d.bottom'))}
        {margin('right', t('d.right'))}
        {margin('left', t('d.left'))}
      </SimpleGrid>

      <Divider label={t('d.offset')} labelPosition="center" />
      <Text fz="xs" c="dimmed">
        {t('d.offsetHint')}
      </Text>
      <SimpleGrid cols={2} spacing="xs">
        <NumberInput size="xs" label="X (mm)" value={layout.offsetMm.x} min={-50} max={50} step={0.5} decimalScale={1} onChange={(v) => typeof v === 'number' && onChange({ ...layout, offsetMm: { ...layout.offsetMm, x: v } }, 'offx')} id="offset-x" />
        <NumberInput size="xs" label="Y (mm)" value={layout.offsetMm.y} min={-50} max={50} step={0.5} decimalScale={1} onChange={(v) => typeof v === 'number' && onChange({ ...layout, offsetMm: { ...layout.offsetMm, y: v } }, 'offy')} id="offset-y" />
      </SimpleGrid>

      <Divider label={t('d.background')} labelPosition="center" />
      <Text fz="xs" c="dimmed">
        {t('d.backgroundHint')}
      </Text>
      {layout.background.dataUrl && <Image src={layout.background.dataUrl} h={110} fit="contain" radius="sm" style={{ border: '1px solid #dee2e6' }} />}
      <Group gap="xs">
        <Button size="xs" variant="light" leftSection={<IconPhoto size={16} />} onClick={uploadBg} id="upload-bg">
          {t('d.uploadBackground')}
        </Button>
        {layout.background.dataUrl && (
          <Button size="xs" variant="subtle" color="red" leftSection={<IconTrash size={16} />} onClick={() => onChange({ ...layout, background: { ...layout.background, dataUrl: '' } })}>
            {t('d.removeBackground')}
          </Button>
        )}
      </Group>
      {layout.background.dataUrl && (
        <>
          <Switch size="sm" label={t('d.printBackground')} checked={layout.background.print} onChange={(e) => onChange({ ...layout, background: { ...layout.background, print: e.currentTarget.checked } })} id="print-bg" />
          <div>
            <Text fz="xs" fw={500}>
              {t('d.opacity')}
            </Text>
            <Slider size="sm" min={0.1} max={1} step={0.05} value={layout.background.opacity} onChange={(v) => onChange({ ...layout, background: { ...layout.background, opacity: v } }, 'opacity')} label={(v) => `${Math.round(v * 100)}%`} />
          </div>
        </>
      )}

      <Divider label={t('d.grid')} labelPosition="center" />
      <Group grow align="flex-end">
        <NumberInput size="xs" label={t('d.gridSize')} value={layout.grid.sizeMm} min={0.5} max={20} step={0.5} decimalScale={1} onChange={(v) => typeof v === 'number' && onChange({ ...layout, grid: { ...layout.grid, sizeMm: v } }, 'grid')} />
      </Group>
      <Switch size="sm" label={t('d.snap')} checked={layout.grid.snap} onChange={(e) => onChange({ ...layout, grid: { ...layout.grid, snap: e.currentTarget.checked } })} />
      <Switch size="sm" label={t('d.showGrid')} checked={layout.grid.show} onChange={(e) => onChange({ ...layout, grid: { ...layout.grid, show: e.currentTarget.checked } })} />
    </Stack>
  )
}
