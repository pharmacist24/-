import { useEffect, useRef, useState } from 'react'
import { ActionIcon, Badge, Button, Group, Table, Text, TextInput, Title, Tooltip } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { IconFilePlus, IconSearch, IconUserPlus } from '@tabler/icons-react'
import type { PatientListItem } from '@shared/types'
import { formatAge, formatDate, genderText } from '@shared/text'
import { api } from '../lib/api'
import { useApp } from '../lib/app-context'
import { notifyError } from '../lib/notify'
import PatientFormModal from '../components/PatientFormModal'

export default function PatientsScreen() {
  const { t, lang, navigate } = useApp()
  const [q, setQ] = useState('')
  const [dq] = useDebouncedValue(q, 120)
  const [rows, setRows] = useState<PatientListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    api.patients
      .search(dq, 200)
      .then((r) => alive && setRows(r))
      .catch((e) => notifyError(e, t))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [dq, t])

  return (
    <div className="rx-page-wrap">
      <Group justify="space-between" mb="md">
        <Title order={2}>{t('pt.title')}</Title>
        <Button leftSection={<IconUserPlus size={20} />} onClick={() => setAdding(true)} id="add-patient">
          {t('pt.add')}
        </Button>
      </Group>
      <TextInput
        ref={searchRef}
        autoFocus
        size="lg"
        leftSection={<IconSearch size={20} />}
        placeholder={t('pt.searchPlaceholder')}
        value={q}
        onChange={(e) => setQ(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && rows[0]) navigate({ name: 'patient', id: rows[0].id })
        }}
        mb="md"
        id="patient-search"
      />
      <div className="rx-card" style={{ padding: 0, overflow: 'hidden' }}>
        <Table verticalSpacing="sm" horizontalSpacing="md" highlightOnHover fz="md">
          <Table.Thead bg="gray.0">
            <Table.Tr>
              <Table.Th>{t('c.name')}</Table.Th>
              <Table.Th>{t('pt.age')}</Table.Th>
              <Table.Th>{t('pt.gender')}</Table.Th>
              <Table.Th>{t('pt.phone')}</Table.Th>
              <Table.Th>{t('pt.lastVisit')}</Table.Th>
              <Table.Th>{t('pt.rxCount')}</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((p) => (
              <Table.Tr key={p.id} className="rx-click-row" onClick={() => navigate({ name: 'patient', id: p.id })}>
                <Table.Td>
                  <Text fw={600}>{p.name}</Text>
                  {p.allergies && (
                    <Badge color="red" variant="light" size="sm" mt={2} tt="none">
                      {t('pt.allergies')}: {p.allergies}
                    </Badge>
                  )}
                </Table.Td>
                <Table.Td>{formatAge(p.birthDate, lang)}</Table.Td>
                <Table.Td>{genderText(p.gender, lang)}</Table.Td>
                <Table.Td className="ltr" style={{ textAlign: 'start' }}>
                  {p.phone}
                </Table.Td>
                <Table.Td>{formatDate(p.lastVisit, lang)}</Table.Td>
                <Table.Td>{p.prescriptionCount}</Table.Td>
                <Table.Td onClick={(e) => e.stopPropagation()}>
                  <Tooltip label={t('pt.newRx')}>
                    <ActionIcon variant="light" size="lg" onClick={() => navigate({ name: 'rx', patientId: p.id })}>
                      <IconFilePlus size={20} />
                    </ActionIcon>
                  </Tooltip>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        {!loading && rows.length === 0 && (
          <Text c="dimmed" ta="center" py="xl">
            {t('pt.none')}
          </Text>
        )}
      </div>
      <PatientFormModal
        opened={adding}
        initialName={/\d/.test(q) ? '' : q}
        onClose={() => setAdding(false)}
        onSaved={(p) => {
          setAdding(false)
          navigate({ name: 'patient', id: p.id })
        }}
      />
    </div>
  )
}
