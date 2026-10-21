import { useEffect, useRef, useState } from 'react'
import { Group, TagsInput, Text } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import type { Condition } from '@shared/types'
import { api } from '../lib/api'
import { useApp } from '../lib/app-context'

/** Diagnoses are stored in the existing text column, joined with " + ". */
export const DX_SEPARATOR = ' + '

export function splitDiagnoses(text: string): string[] {
  return (text || '')
    .split(/\s\+\s|\n/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * Several diagnoses as chips. Suggestions come from the condition library (English/Arabic name, ICD code)
 * and from diagnoses the doctor typed before. Free text is allowed.
 */
export default function DiagnosisInput({ value, onChange, child }: { value: string; onChange: (v: string) => void; child?: boolean | null }) {
  const { t, lang } = useApp()
  const [search, setSearch] = useState('')
  const [dq] = useDebouncedValue(search, 120)
  const [conditions, setConditions] = useState<Condition[]>([])
  const [previous, setPrevious] = useState<string[]>([])
  const latest = useRef('')

  useEffect(() => {
    latest.current = dq
    if (!dq.trim()) {
      setConditions([])
      setPrevious([])
      return
    }
    Promise.all([api.conditions.search(dq), api.rx.diagnoses(dq)])
      .then(([c, p]) => {
        if (latest.current !== dq) return
        // Child-specific diagnoses after adult ones for adults, first for children.
        const kid = (x: Condition) => (x.specialty === 'pediatrics' ? 1 : 0)
        setConditions(child == null ? c : [...c].sort((a, b) => (child ? kid(b) - kid(a) : kid(a) - kid(b))))
        // Previous diagnoses may hold several joined ones: offer each part.
        setPrevious([...new Set(p.flatMap(splitDiagnoses))])
      })
      .catch(() => undefined)
  }, [dq, child])

  const tags = splitDiagnoses(value)
  const byValue = new Map(conditions.map((c) => [c.nameEn || c.nameAr, c]))
  const data = [...new Set([...conditions.map((c) => c.nameEn || c.nameAr), ...previous])].filter((d) => !tags.includes(d))

  const add = (d: string) => {
    onChange([...tags, d].join(DX_SEPARATOR))
    setSearch('')
  }

  return (
    <div
      onKeyDownCapture={(e) => {
        // Enter adds the best suggestion (unless the doctor highlighted another one with the arrows).
        if (e.key !== 'Enter' || !search.trim() || !data.length) return
        if (document.querySelector('[data-combobox-option][data-combobox-selected]')) return
        e.preventDefault()
        e.stopPropagation()
        add(data[0])
      }}
    >
    <TagsInput
      label={t('dx.label')}
      placeholder={tags.length ? undefined : t('dx.placeholder')}
      value={tags}
      onChange={(v) => onChange(v.join(DX_SEPARATOR))}
      searchValue={search}
      onSearchChange={setSearch}
      data={data}
      filter={({ options }) => options}
      splitChars={[',', '،', '+']}
      acceptValueOnBlur
      clearable
      maxDropdownHeight={320}
      comboboxProps={{ withinPortal: true }}
      renderOption={({ option }) => {
        const c = byValue.get(option.value)
        if (!c) {
          return (
            <Group justify="space-between" w="100%" wrap="nowrap">
              <Text fz="sm">{option.value}</Text>
              <Text fz="xs" c="dimmed">
                {t('dx.previous')}
              </Text>
            </Group>
          )
        }
        return (
          <Group justify="space-between" w="100%" wrap="nowrap">
            <div>
              <Text fz="sm" fw={600} dir="ltr">
                {c.nameEn}
              </Text>
              <Text fz="xs" c="dimmed">
                {c.nameAr}
              </Text>
            </div>
            <Text fz="xs" c="dimmed" dir="ltr" style={{ whiteSpace: 'nowrap' }}>
              {c.icd10} · {t(`spec.${c.specialty}` as 'spec.general')}
            </Text>
          </Group>
        )
      }}
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      id="rx-diagnosis"
    />
    </div>
  )
}
