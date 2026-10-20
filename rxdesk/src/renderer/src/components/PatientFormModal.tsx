import { useEffect, useRef, useState } from 'react'
import { Button, Group, Modal, NumberInput, SegmentedControl, SimpleGrid, Stack, Text, Textarea, TextInput } from '@mantine/core'
import type { Gender, Patient, PatientInput } from '@shared/types'
import { ageFromBirthDate, birthDateFromAge, formatAge, todayIso } from '@shared/text'
import { api } from '../lib/api'
import { useApp } from '../lib/app-context'
import { notifyError, notifyOk } from '../lib/notify'
import { enterAsTab } from '../lib/keyboard'

const EMPTY: PatientInput = {
  name: '',
  birthDate: '',
  birthDateEstimated: false,
  gender: '',
  phone: '',
  weight: '',
  allergies: '',
  chronicDiseases: '',
  notes: ''
}

export default function PatientFormModal({
  opened,
  patient,
  initialName,
  compact,
  onClose,
  onSaved
}: {
  opened: boolean
  patient?: Patient | null
  initialName?: string
  /** Quick-add from the prescription screen shows only the essential fields first. */
  compact?: boolean
  onClose: () => void
  onSaved: (p: Patient) => void
}) {
  const { t, lang } = useApp()
  const [v, setV] = useState<PatientInput>(EMPTY)
  const [ageInput, setAgeInput] = useState<string | number>('')
  const [busy, setBusy] = useState(false)
  const [nameError, setNameError] = useState('')
  const formRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!opened) return
    const base = patient ? { ...patient } : { ...EMPTY, name: initialName ?? '' }
    setV(base)
    const age = ageFromBirthDate(base.birthDate)
    setAgeInput(age ? age.years : '')
    setNameError('')
  }, [opened, patient, initialName])

  const set = <K extends keyof PatientInput>(k: K, val: PatientInput[K]) => setV((p) => ({ ...p, [k]: val }))

  const onAge = (val: string | number) => {
    setAgeInput(val)
    const n = Number(val)
    if (val === '' || !Number.isFinite(n)) set('birthDate', '')
    else setV((p) => ({ ...p, birthDate: birthDateFromAge(n), birthDateEstimated: true }))
  }

  const onDob = (val: string) => {
    setV((p) => ({ ...p, birthDate: val, birthDateEstimated: false }))
    const age = ageFromBirthDate(val)
    setAgeInput(age ? age.years : '')
  }

  const save = async () => {
    if (!v.name.trim()) {
      setNameError(t('c.required'))
      return
    }
    setBusy(true)
    try {
      const saved = await api.patients.save(v)
      notifyOk(patient ? t('pt.updated') : t('pt.created'))
      onSaved(saved)
    } catch (e) {
      notifyError(e, t)
    } finally {
      setBusy(false)
    }
  }

  const ageText = v.birthDate ? formatAge(v.birthDate, lang) : ''

  return (
    <Modal opened={opened} onClose={onClose} title={<Text fw={700} fz="lg">{patient ? t('pt.edit') : t('pt.add')}</Text>} size="xl">
      <Stack gap="sm" ref={formRef} onKeyDown={(e) => enterAsTab(e, save)} id="patient-form">
        <TextInput
          label={t('pt.name')}
          value={v.name}
          onChange={(e) => {
            set('name', e.currentTarget.value)
            setNameError('')
          }}
          error={nameError || undefined}
          data-autofocus
          withAsterisk
          id="pf-name"
        />
        <SimpleGrid cols={3} spacing="sm">
          <NumberInput label={t('pt.ageYears')} min={0} max={130} value={ageInput} onChange={onAge} allowDecimal={false} id="pf-age" />
          <TextInput
            type="date"
            label={t('pt.birthDate')}
            value={v.birthDate}
            max={todayIso()}
            onChange={(e) => onDob(e.currentTarget.value)}
            description={v.birthDate ? `${ageText}${v.birthDateEstimated ? ' · ' + t('pt.estimated') : ''}` : t('pt.ageOrDob')}
            id="pf-dob"
          />
          <div>
            <Text fw={500} fz="md" mb={4}>
              {t('pt.gender')}
            </Text>
            <SegmentedControl
              fullWidth
              value={v.gender || 'none'}
              onChange={(g) => set('gender', (g === 'none' ? '' : g) as Gender)}
              data={[
                { value: 'male', label: t('pt.male') },
                { value: 'female', label: t('pt.female') }
              ]}
            />
          </div>
        </SimpleGrid>
        <SimpleGrid cols={2} spacing="sm">
          <TextInput label={t('pt.phone')} value={v.phone} onChange={(e) => set('phone', e.currentTarget.value)} dir="ltr" id="pf-phone" />
          <TextInput label={t('pt.weight')} placeholder={t('pt.weightHint')} value={v.weight} onChange={(e) => set('weight', e.currentTarget.value)} />
        </SimpleGrid>
        {!compact && (
          <>
            <SimpleGrid cols={2} spacing="sm">
              <TextInput label={t('pt.allergies')} placeholder={t('pt.allergiesHint')} value={v.allergies} onChange={(e) => set('allergies', e.currentTarget.value)} id="pf-allergies" />
              <TextInput label={t('pt.chronic')} value={v.chronicDiseases} onChange={(e) => set('chronicDiseases', e.currentTarget.value)} />
            </SimpleGrid>
            <Textarea label={t('pt.notes')} value={v.notes} onChange={(e) => set('notes', e.currentTarget.value)} />
          </>
        )}
        {compact && (
          <TextInput label={t('pt.allergies')} placeholder={t('pt.allergiesHint')} value={v.allergies} onChange={(e) => set('allergies', e.currentTarget.value)} id="pf-allergies" />
        )}
        <Group justify="flex-end" mt="sm" data-enter-skip>
          <Button variant="default" onClick={onClose}>
            {t('c.cancel')}
          </Button>
          <Button onClick={save} loading={busy} id="pf-save">
            {t('c.save')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
