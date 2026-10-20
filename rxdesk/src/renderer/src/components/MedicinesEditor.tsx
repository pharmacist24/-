import { memo, useEffect, useRef, useState } from 'react'
import { ActionIcon, Alert, Autocomplete, Badge, Group, Text, TextInput, Tooltip } from '@mantine/core'
import { IconAlertTriangle, IconArrowDown, IconArrowUp, IconTrash } from '@tabler/icons-react'
import type { Drug, MedicineItem } from '@shared/types'
import { DRUG_FORMS, DURATION_SUGGESTIONS, EMPTY_ITEM, FREQUENCY_SUGGESTIONS, INSTRUCTION_SUGGESTIONS, ROUTES } from '@shared/defaults'
import { findAllergyMatches } from '@shared/text'
import { api } from '../lib/api'
import { useT } from '../lib/app-context'
import { enterAsTab, focusNext } from '../lib/keyboard'
import classes from './MedicinesEditor.module.css'

export function emptyItem(): MedicineItem {
  return { ...EMPTY_ITEM }
}

type Field = keyof MedicineItem

interface Props {
  items: MedicineItem[]
  onChange: (items: MedicineItem[]) => void
  allergies?: string
  /** Index of the row that dose phrases are inserted into. */
  onActiveRow?: (index: number) => void
  activeRow?: number
}

/** Editable list of medicines. Always keeps one empty row at the end for fast typing. */
export default function MedicinesEditor({ items, onChange, allergies = '', onActiveRow, activeRow }: Props) {
  const t = useT()
  const wrapRef = useRef<HTMLDivElement>(null)
  const pendingFocus = useRef<{ row: number; field: Field } | null>(null)
  // Latest list, so several updates in the same tick (pick option + change) build on each other.
  const latest = useRef(items)
  latest.current = items
  const emit = (next: MedicineItem[]) => {
    latest.current = next
    onChange(next)
  }

  // Keep exactly one blank row at the end.
  useEffect(() => {
    const last = items[items.length - 1]
    if (!last || last.drugName.trim() !== '') emit([...items, emptyItem()])
  }, [items, onChange])

  useEffect(() => {
    const f = pendingFocus.current
    if (!f) return
    const el = wrapRef.current?.querySelector<HTMLInputElement>(`[data-row="${f.row}"][data-field="${f.field}"]`)
    if (el) {
      el.focus()
      el.select()
      pendingFocus.current = null
    }
  })

  const update = (index: number, patch: Partial<MedicineItem>) => {
    emit(latest.current.map((it, i) => (i === index ? { ...it, ...patch } : it)))
  }

  const pickDrug = (index: number, d: Drug) => {
    const it = latest.current[index]
    const fill = (k: Field, v: string) => (it[k] && k !== 'drugName' ? it[k] : v)
    update(index, {
      drugName: d.name,
      form: fill('form', d.form),
      strength: fill('strength', d.strength),
      dose: fill('dose', d.dose),
      frequency: fill('frequency', d.frequency),
      duration: fill('duration', d.duration),
      route: fill('route', d.route),
      instructions: fill('instructions', d.instructions)
    })
    pendingFocus.current = { row: index, field: 'dose' }
  }

  const move = (index: number, dir: -1 | 1) => {
    const j = index + dir
    if (j < 0 || j >= items.length - 1) return
    const next = [...latest.current]
    ;[next[index], next[j]] = [next[j], next[index]]
    emit(next)
  }

  const remove = (index: number) => emit(latest.current.filter((_, i) => i !== index))

  return (
    <div
      ref={wrapRef}
      onKeyDown={(e) => {
        const target = e.target as HTMLElement
        const last = items.length - 1
        if (
          e.key === 'Enter' &&
          !e.defaultPrevented &&
          target.dataset.field === 'drugName' &&
          Number(target.dataset.row) === last &&
          !items[last]?.drugName.trim()
        ) {
          // Enter on the empty "add medicine" row leaves the list.
          e.preventDefault()
          focusNext(target, document.body)
          return
        }
        enterAsTab(e, () => {
          pendingFocus.current = { row: last, field: 'drugName' }
          onChange([...items])
        })
      }}
      id="medicines-editor"
    >
      {items.map((it, i) => (
        <Row
          key={i}
          index={i}
          item={it}
          isLast={i === items.length - 1}
          canMoveDown={i < items.length - 2}
          active={activeRow === i}
          allergies={allergies}
          t={t}
          onUpdate={update}
          onPick={pickDrug}
          onMove={move}
          onRemove={remove}
          onFocusRow={(idx) => onActiveRow?.(idx)}
        />
      ))}
    </div>
  )
}

interface RowProps {
  index: number
  item: MedicineItem
  isLast: boolean
  canMoveDown: boolean
  active: boolean
  allergies: string
  t: ReturnType<typeof useT>
  onUpdate: (i: number, p: Partial<MedicineItem>) => void
  onPick: (i: number, d: Drug) => void
  onMove: (i: number, d: -1 | 1) => void
  onRemove: (i: number) => void
  onFocusRow: (i: number) => void
}

const Row = memo(function Row({ index, item, isLast, canMoveDown, active, allergies, t, onUpdate, onPick, onMove, onRemove, onFocusRow }: RowProps) {
  const [drugs, setDrugs] = useState<Drug[]>([])
  const query = useRef('')

  const searchDrugs = (v: string) => {
    query.current = v
    if (!v.trim()) {
      setDrugs([])
      return
    }
    api.drugs
      .search(v)
      .then((r) => {
        if (query.current === v) setDrugs(r)
      })
      .catch(() => setDrugs([]))
  }

  const matches = item.drugName ? findAllergyMatches(item.drugName, allergies) : []
  const prefixMatch = !!drugs[0] && drugs[0].name.toLowerCase().startsWith(item.drugName.trim().toLowerCase()) && item.drugName.trim().length > 0
  const common = (field: Field) => ({
    'data-row': index,
    'data-field': field,
    size: 'sm' as const,
    value: item[field],
    onFocus: () => onFocusRow(index),
    classNames: { label: classes.label }
  })
  const text = (field: Field, label: string, dir: 'ltr' | 'auto' = 'auto') => (
    <TextInput {...common(field)} label={label} dir={dir} onChange={(e) => onUpdate(index, { [field]: e.currentTarget.value })} />
  )
  const suggest = (field: Field, label: string, data: string[], dir: 'ltr' | 'auto' = 'auto') => (
    <Autocomplete
      {...common(field)}
      label={label}
      dir={dir}
      data={data}
      limit={8}
      onChange={(v) => onUpdate(index, { [field]: v })}
      comboboxProps={{ withinPortal: true }}
    />
  )

  return (
    <div className={classes.row} data-active={active || undefined} data-blank={isLast || undefined} data-med-row={index}>
      <div className={classes.num}>
        <Badge size="lg" circle variant={isLast ? 'outline' : 'filled'} color={matches.length ? 'red' : 'teal'}>
          {index + 1}
        </Badge>
      </div>
      <div className={classes.fields}>
        <div className={classes.line1}>
          <Autocomplete
            {...common('drugName')}
            label={t('rx.drug')}
            dir="ltr"
            placeholder={isLast ? t('rx.addRow') + '…' : undefined}
            data={drugs.map((d) => d.name)}
            filter={({ options }) => options}
            selectFirstOptionOnChange={prefixMatch}
            renderOption={({ option }) => {
              const d = drugs.find((x) => x.name === option.value)
              return (
                <div dir="ltr" style={{ width: '100%' }}>
                  <Text fz="sm" fw={600} span>
                    {option.value}
                  </Text>{' '}
                  <Text fz="xs" c="dimmed" span>
                    {[d?.form, d?.strength].filter(Boolean).join(' · ')}
                  </Text>
                </div>
              )
            }}
            onChange={(v) => {
              onUpdate(index, { drugName: v })
              searchDrugs(v)
            }}
            onOptionSubmit={(v) => {
              const d = drugs.find((x) => x.name === v)
              if (d) onPick(index, d)
            }}
            comboboxProps={{ withinPortal: true }}
            classNames={{ label: classes.label, input: classes.drugInput }}
          />
          {suggest('form', t('rx.form'), DRUG_FORMS, 'ltr')}
          {text('strength', t('rx.strength'), 'ltr')}
          {text('dose', t('rx.dose'))}
        </div>
        {!isLast || item.drugName ? (
          <div className={classes.line2}>
            {suggest('frequency', t('rx.frequency'), FREQUENCY_SUGGESTIONS)}
            {suggest('duration', t('rx.duration'), DURATION_SUGGESTIONS)}
            {suggest('route', t('rx.route'), ROUTES, 'ltr')}
            {suggest('instructions', t('rx.instructions'), INSTRUCTION_SUGGESTIONS)}
          </div>
        ) : null}
        {matches.length > 0 && (
          <Alert color="red" variant="light" p="xs" mt={6} icon={<IconAlertTriangle size={18} />} data-allergy-warning>
            {t('rx.allergyWarning', { list: matches.join(', ') })}
          </Alert>
        )}
      </div>
      <Group gap={2} className={classes.actions} wrap="nowrap" data-enter-skip>
        {!isLast && (
          <>
            <Tooltip label={t('rx.moveUp')}>
              <ActionIcon variant="subtle" color="gray" tabIndex={-1} disabled={index === 0} onClick={() => onMove(index, -1)}>
                <IconArrowUp size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t('rx.moveDown')}>
              <ActionIcon variant="subtle" color="gray" tabIndex={-1} disabled={!canMoveDown} onClick={() => onMove(index, 1)}>
                <IconArrowDown size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t('rx.removeRow')}>
              <ActionIcon variant="subtle" color="red" tabIndex={-1} onClick={() => onRemove(index)} data-remove-row={index}>
                <IconTrash size={16} />
              </ActionIcon>
            </Tooltip>
          </>
        )}
      </Group>
    </div>
  )
})
