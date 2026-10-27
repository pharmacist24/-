import { memo, useEffect, useRef, useState } from 'react'
import { ActionIcon, Alert, Autocomplete, Badge, Group, Text, TextInput, Tooltip } from '@mantine/core'
import { IconAlertTriangle, IconArrowDown, IconArrowUp, IconChevronDown, IconTrash } from '@tabler/icons-react'
import type { Drug, MedicineItem, RxFormSettings, RxMedField } from '@shared/types'
import { ALL_RX_MED_FIELDS, DRUG_FORMS, DURATION_SUGGESTIONS, EMPTY_ITEM, FREQUENCY_SUGGESTIONS, INSTRUCTION_SUGGESTIONS, ROUTES } from '@shared/defaults'
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
  /** Optional fields to show (Settings → Prescription screen). Drug name and dose are always shown. */
  fields?: RxMedField[]
  /** Saved dose phrases, offered as suggestions in the dose box. */
  phrases?: string[]
  /** Dose as dropdowns (amount / frequency / eye) instead of one typed line. */
  dose?: Pick<RxFormSettings, 'doseMode' | 'doseParts' | 'lists'>
}

export type DoseConfig = NonNullable<Props['dose']>

/** Which boxes a row shows. In dropdown mode the free-text frequency and route boxes are replaced by dropdowns. */
function layoutFor(fields: RxMedField[], dose?: DoseConfig) {
  const dropdowns = dose?.doseMode === 'dropdowns'
  const show = (f: RxMedField) => fields.includes(f) && !(dropdowns && (f === 'frequency' || f === 'route'))
  return {
    dropdowns,
    show,
    amountList: dropdowns && dose!.doseParts.amount,
    freqDropdown: dropdowns && dose!.doseParts.frequency,
    eyeDropdown: dropdowns && dose!.doseParts.eye
  }
}

const SIG_FIELDS: RxMedField[] = ['frequency', 'duration', 'route', 'instructions']

/**
 * Text for the dose box when a drug is picked: the library dose plus every library value
 * whose field is hidden, so the printout shows exactly what the doctor sees.
 */
export function doseLine(d: Pick<Drug, 'dose' | 'frequency' | 'duration' | 'instructions'>, visible: RxMedField[]): string {
  const hidden = (['frequency', 'duration', 'instructions'] as const).filter((f) => !visible.includes(f))
  return [d.dose, ...hidden.map((f) => d[f])].map((x) => (x ?? '').trim()).filter(Boolean).join(' · ')
}

/** Editable list of medicines. Always keeps one empty row at the end for fast typing. */
export default function MedicinesEditor({ items, onChange, allergies = '', onActiveRow, activeRow, fields = ALL_RX_MED_FIELDS, phrases = [], dose }: Props) {
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
    const lay = layoutFor(fields, dose)
    // Boxes that are on the screen get the library value; hidden duration/instructions (and frequency without
    // its dropdown) go into the dose line. Hidden form/strength are still kept (shown under the name).
    const visible = (k: RxMedField) => (k === 'frequency' ? lay.show(k) || lay.freqDropdown : lay.show(k))
    const sig = (k: 'frequency' | 'duration' | 'route' | 'instructions') => (visible(k) ? fill(k, d[k]) : it[k])
    update(index, {
      drugName: d.name,
      form: fill('form', d.form),
      strength: fill('strength', d.strength),
      dose: fill('dose', doseLine(d, ALL_RX_MED_FIELDS.filter(visible))),
      frequency: sig('frequency'),
      duration: sig('duration'),
      route: sig('route'),
      instructions: sig('instructions')
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
          fields={fields}
          phrases={phrases}
          dose={dose}
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
  fields: RxMedField[]
  phrases: string[]
  dose?: DoseConfig
}

const Row = memo(function Row({ index, item, isLast, canMoveDown, active, allergies, t, onUpdate, onPick, onMove, onRemove, onFocusRow, fields, phrases, dose }: RowProps) {
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
  const lay = layoutFor(fields, dose)
  const show = lay.show
  const line2Fields = SIG_FIELDS.filter(show)
  const sigVisible = line2Fields.length > 0 || lay.freqDropdown
  const line1Cols = lay.dropdowns
    ? ['2.4fr', show('form') && '1fr', show('strength') && '1fr', lay.amountList ? '1.5fr' : '2fr', lay.freqDropdown && '1.6fr', lay.eyeDropdown && '1.3fr'].filter(Boolean).join(' ')
    : ['2.4fr', show('form') && '1fr', show('strength') && '1fr', sigVisible ? '2fr' : '3.2fr'].filter(Boolean).join(' ')
  // Values that will print but whose box is hidden (e.g. "1 g · Tab").
  const hiddenExtra = [!show('strength') && item.strength, !show('form') && item.form].filter(Boolean).join(' · ')
  const prefixMatch = !!drugs[0] && drugs[0].name.toLowerCase().startsWith(item.drugName.trim().toLowerCase()) && item.drugName.trim().length > 0
  const common = (field: Field) => ({
    'data-row': index,
    'data-field': field,
    size: 'sm' as const,
    value: item[field] ?? '',
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

  /** A dropdown that opens with the whole list, filters while typing and still accepts any typed value. */
  const pickList = (field: Field, label: string, data: string[]) => (
    <Autocomplete
      {...common(field)}
      label={label}
      dir="auto"
      data={data}
      maxDropdownHeight={280}
      filter={({ options, search }) => {
        const q = search.trim()
        if (!q || data.includes(q)) return options
        return (options as { value: string }[]).filter((o) => o.value.includes(q)) as typeof options
      }}
      rightSection={<IconChevronDown size={14} />}
      rightSectionPointerEvents="none"
      onChange={(v) => onUpdate(index, { [field]: v })}
      comboboxProps={{ withinPortal: true }}
      data-dropdown={field}
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
        <div className={classes.line1} style={{ gridTemplateColumns: line1Cols }}>
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
            classNames={{ label: classes.label, input: classes.drugInput, description: classes.drugExtra }}
            inputWrapperOrder={['label', 'input', 'description']}
            description={hiddenExtra || undefined}
          />
          {show('form') && suggest('form', t('rx.form'), DRUG_FORMS, 'ltr')}
          {show('strength') && text('strength', t('rx.strength'), 'ltr')}
          {lay.dropdowns ? (
            <>
              {lay.amountList ? pickList('dose', t('rx.amount'), dose!.lists.amount) : suggest('dose', t('rx.dose'), phrases)}
              {lay.freqDropdown && pickList('frequency', t('rx.frequency'), dose!.lists.frequency)}
              {lay.eyeDropdown && pickList('site', t('rx.eye'), dose!.lists.eye)}
            </>
          ) : (
            suggest('dose', sigVisible ? t('rx.dose') : t('rx.doseLine'), phrases)
          )}
        </div>
        {line2Fields.length > 0 && (!isLast || item.drugName) ? (
          <div className={classes.line2} style={{ gridTemplateColumns: line2Fields.map((f) => (f === 'instructions' ? '2fr' : f === 'frequency' ? '1.6fr' : '1fr')).join(' ') }}>
            {show('frequency') && suggest('frequency', t('rx.frequency'), FREQUENCY_SUGGESTIONS)}
            {show('duration') && suggest('duration', t('rx.duration'), DURATION_SUGGESTIONS)}
            {show('route') && suggest('route', t('rx.route'), ROUTES, 'ltr')}
            {show('instructions') && suggest('instructions', t('rx.instructions'), INSTRUCTION_SUGGESTIONS)}
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
