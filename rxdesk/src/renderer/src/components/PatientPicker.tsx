import { useEffect, useRef, useState } from 'react'
import { Button, Combobox, Group, Text, TextInput, useCombobox } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { IconSearch, IconUserPlus } from '@tabler/icons-react'
import type { Patient, PatientListItem } from '@shared/types'
import { formatAge, genderText } from '@shared/text'
import { api } from '../lib/api'
import { useApp } from '../lib/app-context'
import PatientFormModal from './PatientFormModal'

/** Search box to pick a patient by name or phone, with a quick "new patient" button. */
export default function PatientPicker({ onSelect, autoFocus }: { onSelect: (p: Patient) => void; autoFocus?: boolean }) {
  const { t, lang } = useApp()
  const [q, setQ] = useState('')
  const [dq] = useDebouncedValue(q, 80)
  const [results, setResults] = useState<PatientListItem[]>([])
  const [adding, setAdding] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const combobox = useCombobox({ onDropdownClose: () => combobox.resetSelectedOption() })

  useEffect(() => {
    let alive = true
    api.patients.search(dq, 8).then((r) => {
      if (!alive) return
      setResults(r)
      if (dq.trim()) combobox.selectFirstOption()
    })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dq])

  const choose = (id: string) => {
    const p = results.find((r) => String(r.id) === id)
    if (p) onSelect(p)
    combobox.closeDropdown()
  }

  const isPhone = /^[\d\s+\-()٠-٩]+$/.test(q.trim())

  return (
    <>
      <Group align="flex-end" gap="sm" wrap="nowrap">
        <Combobox store={combobox} onOptionSubmit={choose} withinPortal>
          <Combobox.Target>
            <TextInput
              ref={inputRef}
              style={{ flex: 1 }}
              size="lg"
              autoFocus={autoFocus}
              label={t('rx.patient')}
              placeholder={t('rx.selectPatient')}
              leftSection={<IconSearch size={20} />}
              value={q}
              onChange={(e) => {
                setQ(e.currentTarget.value)
                combobox.openDropdown()
              }}
              onFocus={() => combobox.openDropdown()}
              onClick={() => combobox.openDropdown()}
              onBlur={() => combobox.closeDropdown()}
              onKeyDown={(e) => {
                // Enter with no match: open the quick "new patient" form with the typed name.
                if (e.key === 'Enter' && q.trim() && results.length === 0) {
                  e.preventDefault()
                  setAdding(true)
                }
              }}
              id="patient-picker"
            />
          </Combobox.Target>
          <Combobox.Dropdown>
            <Combobox.Options>
              {results.length === 0 ? (
                <Combobox.Empty>{q.trim() ? t('pt.none') : t('pt.recent')}</Combobox.Empty>
              ) : (
                <>
                  {!q.trim() && <Combobox.Header>{t('pt.recent')}</Combobox.Header>}
                  {results.map((p) => (
                    <Combobox.Option value={String(p.id)} key={p.id}>
                      <Group justify="space-between" wrap="nowrap">
                        <div>
                          <Text fw={600}>{p.name}</Text>
                          <Text fz="xs" c="dimmed">
                            {[formatAge(p.birthDate, lang), genderText(p.gender, lang)].filter(Boolean).join(' · ')}
                          </Text>
                        </div>
                        <Text fz="sm" c="dimmed" dir="ltr">
                          {p.phone}
                        </Text>
                      </Group>
                    </Combobox.Option>
                  ))}
                </>
              )}
            </Combobox.Options>
          </Combobox.Dropdown>
        </Combobox>
        <Button size="lg" variant="light" leftSection={<IconUserPlus size={20} />} onClick={() => setAdding(true)} id="quick-add-patient">
          {t('rx.quickAdd')}
        </Button>
      </Group>
      <PatientFormModal
        opened={adding}
        compact
        initialName={isPhone ? '' : q.trim()}
        onClose={() => setAdding(false)}
        onSaved={(p) => {
          setAdding(false)
          onSelect(p)
        }}
      />
    </>
  )
}
