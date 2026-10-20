import {
  ActionIcon,
  Checkbox,
  ColorInput,
  Divider,
  Group,
  NumberInput,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  Tooltip
} from '@mantine/core'
import {
  IconArrowBarToDown,
  IconArrowBarToUp,
  IconBold,
  IconCopy,
  IconItalic,
  IconLock,
  IconLockOpen,
  IconTrash
} from '@tabler/icons-react'
import { ALL_MEDICINE_COLUMNS, FONT_FAMILIES, type LayoutElement, type MedicineColumn, type MedicinesOptions, type TextStyle } from '@shared/layout/types'
import type { StringKey } from '../i18n'
import { useT } from '../lib/app-context'

const SWATCHES = ['#111111', '#333333', '#666666', '#0b3d6b', '#1864ab', '#14532d', '#2b8a3e', '#c92a2a', '#862e9c', '#e67700']

const NO_TEXT: LayoutElement['type'][] = ['line', 'rect', 'logo']
const NO_LABEL: LayoutElement['type'][] = ['line', 'rect', 'logo', 'qr', 'medicines', 'text']

export default function ElementPanel({
  el,
  onChange,
  onDelete,
  onDuplicate,
  onFront,
  onBack
}: {
  el: LayoutElement
  onChange: (patch: Partial<LayoutElement>, mergeKey?: string) => void
  onDelete: () => void
  onDuplicate: () => void
  onFront: () => void
  onBack: () => void
}) {
  const t = useT()
  const st = (patch: Partial<TextStyle>, key?: string) => onChange({ style: { ...el.style, ...patch } }, key ? `${el.id}.style.${key}` : undefined)
  const med = (patch: Partial<MedicinesOptions>, key?: string) => onChange({ medicines: { ...el.medicines!, ...patch } }, key ? `${el.id}.med.${key}` : undefined)
  const num = (k: 'x' | 'y' | 'w' | 'h') => (
    <NumberInput
      size="xs"
      label={t(`d.${k}` as StringKey)}
      value={el[k]}
      step={0.5}
      decimalScale={2}
      min={k === 'w' || k === 'h' ? 0.5 : -50}
      onChange={(v) => typeof v === 'number' && onChange({ [k]: v }, `${el.id}.${k}`)}
      rightSection={<Text fz={10} c="dimmed">mm</Text>}
      disabled={el.locked}
    />
  )

  return (
    <Stack gap="sm" p="md" id="element-panel">
      <Group justify="space-between" wrap="nowrap">
        <Text fw={700}>{t(`el.${el.type}` as StringKey)}</Text>
        <Group gap={2} wrap="nowrap">
          <Tooltip label={t('c.duplicate') + ' (Ctrl+D)'}>
            <ActionIcon variant="subtle" onClick={onDuplicate}>
              <IconCopy size={17} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={t('d.bringFront')}>
            <ActionIcon variant="subtle" onClick={onFront}>
              <IconArrowBarToUp size={17} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={t('d.sendBack')}>
            <ActionIcon variant="subtle" onClick={onBack}>
              <IconArrowBarToDown size={17} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={t('d.lock')}>
            <ActionIcon variant={el.locked ? 'filled' : 'subtle'} onClick={() => onChange({ locked: !el.locked })}>
              {el.locked ? <IconLock size={17} /> : <IconLockOpen size={17} />}
            </ActionIcon>
          </Tooltip>
          <Tooltip label={t('d.deleteElement') + ' (Delete)'}>
            <ActionIcon variant="subtle" color="red" onClick={onDelete} id="delete-element">
              <IconTrash size={17} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      <Text fz="xs" fw={600} c="dimmed">
        {t('d.position')}
      </Text>
      <SimpleGrid cols={2} spacing="xs" verticalSpacing="xs">
        {num('x')}
        {num('y')}
        {num('w')}
        {num('h')}
      </SimpleGrid>

      {el.type !== 'medicines' && (
        <Select
          size="xs"
          label={t('d.pagesScope')}
          value={el.pages}
          onChange={(v) => v && onChange({ pages: v as LayoutElement['pages'] })}
          data={[
            { value: 'all', label: t('d.pagesAll') },
            { value: 'first', label: t('d.pagesFirst') },
            { value: 'last', label: t('d.pagesLast') }
          ]}
        />
      )}

      {!NO_LABEL.includes(el.type) && (
        <>
          <Divider />
          <Switch size="sm" label={t('d.showLabel')} checked={el.label.show} onChange={(e) => onChange({ label: { ...el.label, show: e.currentTarget.checked } })} />
          {el.label.show && (
            <TextInput size="xs" label={t('d.labelText')} value={el.label.text} dir="auto" onChange={(e) => onChange({ label: { ...el.label, text: e.currentTarget.value } }, `${el.id}.label`)} id="label-text" />
          )}
        </>
      )}

      {el.type === 'text' && (
        <Textarea size="xs" label={t('d.text')} description={t('d.textHint')} value={el.text ?? ''} dir="auto" minRows={2} onChange={(e) => onChange({ text: e.currentTarget.value }, `${el.id}.text`)} />
      )}

      {!NO_TEXT.includes(el.type) && (
        <>
          <Divider />
          <Group grow gap="xs" align="flex-end">
            <Select size="xs" label={t('d.font')} value={el.style.fontFamily} data={FONT_FAMILIES} onChange={(v) => v && st({ fontFamily: v as TextStyle['fontFamily'] })} style={{ flex: 2 }} />
            <NumberInput size="xs" label={t('d.fontSize')} value={el.style.fontSizePt} min={4} max={96} step={0.5} decimalScale={1} onChange={(v) => typeof v === 'number' && st({ fontSizePt: v }, 'size')} rightSection={<Text fz={10} c="dimmed">pt</Text>} id="font-size" />
          </Group>
          <Group gap="xs" align="flex-end" wrap="nowrap">
            <Tooltip label={t('d.bold')}>
              <ActionIcon size="lg" variant={el.style.bold ? 'filled' : 'default'} onClick={() => st({ bold: !el.style.bold })} id="toggle-bold">
                <IconBold size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t('d.italic')}>
              <ActionIcon size="lg" variant={el.style.italic ? 'filled' : 'default'} onClick={() => st({ italic: !el.style.italic })}>
                <IconItalic size={18} />
              </ActionIcon>
            </Tooltip>
            <ColorInput size="xs" style={{ flex: 1 }} label={t('d.color')} value={el.style.color} swatches={SWATCHES} format="hex" onChange={(v) => st({ color: v }, 'color')} />
          </Group>
          <div>
            <Text fz="xs" fw={500} mb={2}>
              {t('d.align')}
            </Text>
            <SegmentedControl
              size="xs"
              fullWidth
              value={el.style.align}
              onChange={(v) => st({ align: v as TextStyle['align'] })}
              data={[
                { value: 'start', label: t('d.alignStart') },
                { value: 'center', label: t('d.alignCenter') },
                { value: 'end', label: t('d.alignEnd') },
                { value: 'justify', label: t('d.alignJustify') }
              ]}
            />
          </div>
          <div>
            <Text fz="xs" fw={500} mb={2}>
              {t('d.direction')}
            </Text>
            <SegmentedControl
              size="xs"
              fullWidth
              value={el.style.direction}
              onChange={(v) => st({ direction: v as TextStyle['direction'] })}
              data={[
                { value: 'auto', label: t('d.dirAuto') },
                { value: 'rtl', label: 'RTL ←' },
                { value: 'ltr', label: 'LTR →' }
              ]}
            />
          </div>
          <NumberInput size="xs" label={t('d.lineHeight')} value={el.style.lineHeight} min={0.8} max={3} step={0.05} decimalScale={2} onChange={(v) => typeof v === 'number' && st({ lineHeight: v }, 'lh')} />
        </>
      )}

      {(el.type === 'line' || el.type === 'rect') && (
        <>
          <Divider />
          <NumberInput size="xs" label={t('d.stroke')} value={el.strokeWidthMm} min={0.05} max={10} step={0.1} decimalScale={2} onChange={(v) => typeof v === 'number' && onChange({ strokeWidthMm: v }, `${el.id}.sw`)} rightSection={<Text fz={10} c="dimmed">mm</Text>} />
          <ColorInput size="xs" label={t('d.strokeColor')} value={el.strokeColor} swatches={SWATCHES} format="hex" onChange={(v) => onChange({ strokeColor: v }, `${el.id}.sc`)} />
        </>
      )}
      {el.type === 'rect' && (
        <>
          <ColorInput size="xs" label={t('d.fill')} value={el.fillColor === 'transparent' ? '' : el.fillColor} placeholder="transparent" swatches={['#ffffff', '#f1f3f5', '#e6fcf5', '#e7f5ff', '#fff9db']} format="hex" onChange={(v) => onChange({ fillColor: v || 'transparent' }, `${el.id}.fill`)} />
          <NumberInput size="xs" label={t('d.radius')} value={el.radiusMm} min={0} max={50} step={0.5} onChange={(v) => typeof v === 'number' && onChange({ radiusMm: v }, `${el.id}.r`)} />
        </>
      )}
      {el.type === 'logo' && (
        <Select
          size="xs"
          label={t('d.fit')}
          value={el.fit ?? 'contain'}
          onChange={(v) => v && onChange({ fit: v as 'contain' | 'cover' })}
          data={[
            { value: 'contain', label: t('d.fitContain') },
            { value: 'cover', label: t('d.fitCover') }
          ]}
        />
      )}
      {el.type === 'medicines' && el.medicines && <MedicinesOptionsPanel m={el.medicines} onChange={med} />}
    </Stack>
  )
}

function MedicinesOptionsPanel({ m, onChange }: { m: MedicinesOptions; onChange: (p: Partial<MedicinesOptions>, key?: string) => void }) {
  const t = useT()
  const toggleCol = (c: MedicineColumn, on: boolean) => {
    const set = new Set(m.columns)
    if (on) set.add(c)
    else set.delete(c)
    onChange({ columns: ALL_MEDICINE_COLUMNS.filter((x) => set.has(x)) })
  }
  return (
    <>
      <Divider label={t('el.medicines')} labelPosition="center" />
      <div>
        <Text fz="xs" fw={500} mb={2}>
          {t('d.medStyle')}
        </Text>
        <SegmentedControl
          size="xs"
          fullWidth
          value={m.style}
          onChange={(v) => onChange({ style: v as 'list' | 'table' })}
          data={[
            { value: 'list', label: t('d.medList') },
            { value: 'table', label: t('d.medTable') }
          ]}
          id="med-style"
        />
      </div>
      <div>
        <Text fz="xs" fw={500} mb={4}>
          {t('d.medColumns')}
        </Text>
        <SimpleGrid cols={2} spacing={4} verticalSpacing={6}>
          {ALL_MEDICINE_COLUMNS.map((c) => (
            <Checkbox key={c} size="xs" label={t(`col.${c}` as StringKey)} checked={m.columns.includes(c)} disabled={c === 'drug'} onChange={(e) => toggleCol(c, e.currentTarget.checked)} />
          ))}
        </SimpleGrid>
      </div>
      <NumberInput size="xs" label={t('d.medGap')} value={m.rowGapMm} min={0} max={30} step={0.5} decimalScale={1} onChange={(v) => typeof v === 'number' && onChange({ rowGapMm: v }, 'gap')} rightSection={<Text fz={10} c="dimmed">mm</Text>} />
      <NumberInput size="xs" label={t('d.medDetailSize')} value={m.detailFontSizePt} min={4} max={72} step={0.5} onChange={(v) => typeof v === 'number' && onChange({ detailFontSizePt: v }, 'detail')} rightSection={<Text fz={10} c="dimmed">pt</Text>} />
      <Switch size="sm" label={t('d.medRx')} checked={m.showRxSymbol} onChange={(e) => onChange({ showRxSymbol: e.currentTarget.checked })} />
      <Switch size="sm" label={t('d.medDrugBold')} checked={m.drugBold} onChange={(e) => onChange({ drugBold: e.currentTarget.checked })} />
      {m.style === 'table' && (
        <>
          <Switch size="sm" label={t('d.medHeader')} checked={m.showHeader} onChange={(e) => onChange({ showHeader: e.currentTarget.checked })} />
          <Switch size="sm" label={t('d.medBorders')} checked={m.borders} onChange={(e) => onChange({ borders: e.currentTarget.checked })} />
          {m.showHeader &&
            m.columns.map((c) => (
              <TextInput
                key={c}
                size="xs"
                label={t('d.medHeaderLabel', { col: t(`col.${c}` as StringKey) })}
                placeholder={t(`col.${c}` as StringKey)}
                value={m.headerLabels[c] ?? ''}
                dir="auto"
                onChange={(e) => onChange({ headerLabels: { ...m.headerLabels, [c]: e.currentTarget.value } }, 'hl.' + c)}
              />
            ))}
        </>
      )}
    </>
  )
}
