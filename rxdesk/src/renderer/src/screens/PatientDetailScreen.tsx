import { useCallback, useEffect, useState } from 'react'
import { ActionIcon, Alert, Badge, Button, Grid, Group, Menu, Stack, Table, Text, Title, Tooltip } from '@mantine/core'
import { modals } from '@mantine/modals'
import { IconAlertTriangle, IconArrowBack, IconCopy, IconDots, IconEdit, IconEye, IconFilePlus, IconPrinter, IconTrash } from '@tabler/icons-react'
import type { Patient, PrescriptionListItem } from '@shared/types'
import { formatAge, formatDate, genderText } from '@shared/text'
import { api } from '../lib/api'
import { useApp } from '../lib/app-context'
import { notifyError, notifyOk } from '../lib/notify'
import PatientFormModal from '../components/PatientFormModal'
import { usePrinting } from '../print/usePrinting'

export default function PatientDetailScreen({ id }: { id: number }) {
  const { t, lang, navigate } = useApp()
  const [patient, setPatient] = useState<Patient | null>(null)
  const [history, setHistory] = useState<PrescriptionListItem[]>([])
  const [editing, setEditing] = useState(false)
  const printing = usePrinting()

  const load = useCallback(async () => {
    try {
      const [p, h] = await Promise.all([api.patients.get(id), api.rx.list({ patientId: id })])
      setPatient(p)
      setHistory(h)
    } catch (e) {
      notifyError(e, t)
    }
  }, [id, t])

  useEffect(() => {
    load()
  }, [load])

  if (!patient) return null

  const del = () =>
    modals.openConfirmModal({
      title: t('c.deleteConfirmTitle'),
      children: t('pt.deleteConfirm'),
      labels: { confirm: t('c.delete'), cancel: t('c.cancel') },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await api.patients.delete(patient.id)
          notifyOk(t('c.deleted'))
          navigate({ name: 'patients' })
        } catch (e) {
          notifyError(e, t)
        }
      }
    })

  const delRx = (rxId: number) =>
    modals.openConfirmModal({
      title: t('c.deleteConfirmTitle'),
      children: t('rx.deleteConfirm'),
      labels: { confirm: t('c.delete'), cancel: t('c.cancel') },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        await api.rx.delete(rxId)
        notifyOk(t('c.deleted'))
        load()
      }
    })

  const info: [string, string][] = [
    [t('pt.age'), formatAge(patient.birthDate, lang) + (patient.birthDate ? ` (${formatDate(patient.birthDate, lang)})` : '')],
    [t('pt.gender'), genderText(patient.gender, lang)],
    [t('pt.phone'), patient.phone],
    [t('pt.weight'), patient.weight],
    [t('pt.chronic'), patient.chronicDiseases],
    [t('pt.notes'), patient.notes]
  ]

  return (
    <div className="rx-page-wrap">
      <Group justify="space-between" mb="md">
        <Group gap="xs">
          <ActionIcon variant="subtle" size="lg" onClick={() => navigate({ name: 'patients' })} aria-label={t('c.back')}>
            <IconArrowBack size={22} style={{ transform: lang === 'ar' ? 'scaleX(-1)' : undefined }} />
          </ActionIcon>
          <Title order={2}>{patient.name}</Title>
        </Group>
        <Group>
          <Button variant="default" leftSection={<IconEdit size={18} />} onClick={() => setEditing(true)}>
            {t('c.edit')}
          </Button>
          <Button leftSection={<IconFilePlus size={20} />} onClick={() => navigate({ name: 'rx', patientId: patient.id })} id="patient-new-rx">
            {t('pt.newRx')}
          </Button>
          <Menu position="bottom-end">
            <Menu.Target>
              <ActionIcon variant="default" size="lg">
                <IconDots size={18} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item color="red" leftSection={<IconTrash size={16} />} onClick={del}>
                {t('c.delete')}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Group>

      <Grid gutter="lg">
        <Grid.Col span={{ base: 12, md: 4 }}>
          <div className="rx-card">
            <Text fw={700} mb="sm">
              {t('pt.details')}
            </Text>
            {patient.allergies && (
              <Alert color="red" variant="light" icon={<IconAlertTriangle />} mb="sm" title={t('pt.allergies')}>
                {patient.allergies}
              </Alert>
            )}
            <Stack gap={8}>
              {info
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k}>
                    <Text fz="sm" c="dimmed">
                      {k}
                    </Text>
                    <Text style={{ whiteSpace: 'pre-wrap', unicodeBidi: 'plaintext' }}>{v}</Text>
                  </div>
                ))}
            </Stack>
          </div>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 8 }}>
          <div className="rx-card" style={{ padding: 0, overflow: 'hidden' }}>
            <Text fw={700} p="md" pb={4}>
              {t('pt.history')} <Badge variant="light">{history.length}</Badge>
            </Text>
            {history.length === 0 ? (
              <Text c="dimmed" ta="center" py="xl">
                {t('pt.noHistory')}
              </Text>
            ) : (
              <Table verticalSpacing="sm" horizontalSpacing="md" highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{t('c.date')}</Table.Th>
                    <Table.Th>{t('rx.diagnosis')}</Table.Th>
                    <Table.Th>{t('pt.drugs')}</Table.Th>
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {history.map((h) => (
                    <Table.Tr key={h.id} className="rx-click-row" onClick={() => navigate({ name: 'rx', rxId: h.id })}>
                      <Table.Td style={{ whiteSpace: 'nowrap' }}>
                        {formatDate(h.date, lang)}
                        <Text fz="xs" c="dimmed">
                          #{h.id}
                        </Text>
                      </Table.Td>
                      <Table.Td style={{ unicodeBidi: 'plaintext' }}>{h.diagnosis}</Table.Td>
                      <Table.Td>
                        <Text className="ltr" fz="sm" lineClamp={2} ta="left">
                          {h.drugsSummary}
                        </Text>
                      </Table.Td>
                      <Table.Td onClick={(e) => e.stopPropagation()} style={{ whiteSpace: 'nowrap' }}>
                        <Group gap={4} wrap="nowrap">
                          <Tooltip label={t('pt.view')}>
                            <ActionIcon variant="subtle" size="lg" onClick={() => navigate({ name: 'rx', rxId: h.id })}>
                              <IconEye size={20} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label={t('pt.reprint')}>
                            <ActionIcon variant="subtle" size="lg" onClick={() => printing.previewSaved(h.id)} data-reprint={h.id}>
                              <IconPrinter size={20} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label={t('pt.repeat')}>
                            <ActionIcon variant="subtle" size="lg" onClick={() => navigate({ name: 'rx', repeatFrom: h.id })} data-repeat={h.id}>
                              <IconCopy size={20} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label={t('rx.delete')}>
                            <ActionIcon variant="subtle" color="red" size="lg" onClick={() => delRx(h.id)}>
                              <IconTrash size={18} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </div>
        </Grid.Col>
      </Grid>
      <PatientFormModal
        opened={editing}
        patient={patient}
        onClose={() => setEditing(false)}
        onSaved={(p) => {
          setPatient(p)
          setEditing(false)
        }}
      />
      {printing.element}
    </div>
  )
}
