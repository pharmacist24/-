import { useEffect, useState } from 'react'
import { Badge, Button, Group, Paper, SimpleGrid, Stack, Text } from '@mantine/core'
import { IconAlertTriangle, IconBulb, IconCheck, IconPlus } from '@tabler/icons-react'
import type { Condition, ConditionOption, Patient } from '@shared/types'
import { ageFromBirthDate, findAllergyMatches } from '@shared/text'
import { api } from '../lib/api'
import { useApp } from '../lib/app-context'

/**
 * Small panel under the diagnosis: for each diagnosis found in the condition library, its treatment
 * options. "Add" puts the medicines (and advice / lab tests if empty) into the prescription.
 * It only suggests — nothing is added without a click.
 */
export default function TreatmentPanel({
  diagnoses,
  patient,
  onAdd
}: {
  diagnoses: string[]
  patient: Patient | null
  onAdd: (o: ConditionOption) => void
}) {
  const { t, lang } = useApp()
  const [conditions, setConditions] = useState<Condition[]>([])
  const [added, setAdded] = useState<Set<number>>(new Set())
  const key = diagnoses.join('|')

  useEffect(() => {
    let alive = true
    if (!diagnoses.length) {
      setConditions([])
      return
    }
    api.conditions
      .byNames(diagnoses)
      .then((c) => alive && setConditions(c))
      .catch(() => alive && setConditions([]))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  if (!conditions.length) return null

  const age = patient ? ageFromBirthDate(patient.birthDate) : null
  const isChild = age ? age.years < 12 : null
  const allergies = patient?.allergies ?? ''

  const ordered = (opts: ConditionOption[]) =>
    isChild === null ? opts : [...opts].sort((a, b) => Number(b.forChildren === isChild) - Number(a.forChildren === isChild))

  return (
    <Paper withBorder radius="md" p="sm" mt="sm" bg="var(--mantine-color-teal-0)" id="treatment-panel">
      <Group gap={6} mb={6}>
        <IconBulb size={18} color="var(--mantine-color-teal-7)" />
        <Text fw={700} fz="sm">
          {t('dx.suggestions')}
        </Text>
        <Text fz="xs" c="dimmed">
          {t('dx.disclaimer')}
        </Text>
      </Group>
      <Stack gap="xs">
        {conditions.map((c) => (
          <div key={c.id}>
            <Text fz="xs" fw={700} c="teal.9" mb={4}>
              {lang === 'ar' ? c.nameAr || c.nameEn : c.nameEn || c.nameAr} <span dir="ltr">({c.icd10})</span>
            </Text>
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing={8} verticalSpacing={8}>
              {ordered(c.options).map((o) => {
                const conflicts = [...new Set(o.items.flatMap((i) => findAllergyMatches(i.drugName, allergies).map(() => i.drugName)))]
                const doseMismatch = isChild !== null && o.forChildren !== isChild
                const done = o.id !== undefined && added.has(o.id)
                return (
                  <Paper key={o.id} withBorder radius="md" p={8} bg="white" data-option={o.labelEn} data-condition={c.key}>
                    <Group justify="space-between" wrap="nowrap" gap={6} align="flex-start">
                      <div style={{ minWidth: 0 }}>
                        <Group gap={4}>
                          <Text fz="sm" fw={600}>
                            {lang === 'ar' ? o.labelAr || o.labelEn : o.labelEn || o.labelAr}
                          </Text>
                          {doseMismatch && (
                            <Badge size="xs" variant="light" color="orange" tt="none">
                              {o.forChildren ? t('dx.childDose') : t('dx.adultDose')}
                            </Badge>
                          )}
                        </Group>
                        <Text fz="xs" c="dimmed" dir="ltr" ta="left" lineClamp={2}>
                          {o.items.map((i) => [i.drugName, i.strength].filter(Boolean).join(' ')).join(' + ')}
                        </Text>
                        {conflicts.length > 0 && (
                          <Badge size="sm" color="red" variant="light" tt="none" mt={4} leftSection={<IconAlertTriangle size={12} />} data-option-allergy>
                            {t('dx.allergy', { list: conflicts.join(', ') })}
                          </Badge>
                        )}
                      </div>
                      <Button
                        size="compact-sm"
                        variant={done ? 'light' : 'filled'}
                        color={conflicts.length ? 'red' : 'teal'}
                        leftSection={done ? <IconCheck size={14} /> : <IconPlus size={14} />}
                        onClick={() => {
                          onAdd(o)
                          if (o.id !== undefined) setAdded((s) => new Set(s).add(o.id!))
                        }}
                        data-add-option
                        tabIndex={-1}
                        style={{ flexShrink: 0 }}
                      >
                        {done ? t('dx.added') : t('dx.add')}
                      </Button>
                    </Group>
                  </Paper>
                )
              })}
            </SimpleGrid>
          </div>
        ))}
      </Stack>
    </Paper>
  )
}
