import { useEffect, useMemo, useState } from 'react'
import { ActionIcon, Badge, Button, Chip, Divider, Group, Modal, Paper, Select, SimpleGrid, Stack, Switch, Table, Text, Textarea, TextInput, Tooltip } from '@mantine/core'
import { modals } from '@mantine/modals'
import { IconEyeOff, IconPlus, IconRestore, IconSearch, IconTrash } from '@tabler/icons-react'
import type { Condition, ConditionInput, ConditionOption } from '@shared/types'
import { normalizeForSearch } from '@shared/text'
import { api } from '../lib/api'
import { useApp } from '../lib/app-context'
import { notifyError, notifyOk } from '../lib/notify'
import MedicinesEditor, { emptyItem } from './MedicinesEditor'

const SPECS = ['general', 'pediatrics', 'dermatology', 'internal', 'other'] as const

const newOption = (): ConditionOption => ({ labelEn: '', labelAr: '', forChildren: false, items: [emptyItem()], advice: '', labs: '' })

/** Library → Diagnoses: the condition library behind the treatment suggestions. */
export default function ConditionsTab() {
  const { t } = useApp()
  const [list, setList] = useState<Condition[]>([])
  const [q, setQ] = useState('')
  const [spec, setSpec] = useState<string>('all')
  const [editing, setEditing] = useState<(ConditionInput & { builtin?: boolean }) | null>(null)
  const load = () => api.conditions.list().then(setList).catch((e) => notifyError(e, t))
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const shown = useMemo(() => {
    const n = normalizeForSearch(q)
    return list.filter(
      (c) => (spec === 'all' || c.specialty === spec) && (!n || normalizeForSearch([c.nameEn, c.nameAr, c.icd10, ...c.keywords].join(' ')).includes(n))
    )
  }, [list, q, spec])

  const save = async () => {
    if (!editing) return
    try {
      await api.conditions.save(editing)
      setEditing(null)
      notifyOk(t('c.saved'))
      load()
    } catch (e) {
      notifyError(e, t)
    }
  }

  const setOpt = (i: number, patch: Partial<ConditionOption>) =>
    setEditing((cur) => (cur ? { ...cur, options: cur.options.map((o, k) => (k === i ? { ...o, ...patch } : o)) } : cur))

  return (
    <div className="rx-card">
      <Text c="dimmed" fz="sm" mb="sm">
        {t('lib.conditionsHint')}
      </Text>
      <Group justify="space-between" mb="sm">
        <Group>
          <TextInput leftSection={<IconSearch size={18} />} placeholder={t('lib.searchConditions')} value={q} onChange={(e) => setQ(e.currentTarget.value)} w={300} id="condition-search" />
          <Chip.Group value={spec} onChange={(v) => setSpec(v as string)}>
            <Group gap={6}>
              {['all', ...SPECS.slice(0, 4)].map((s) => (
                <Chip key={s} value={s} size="sm">
                  {t(`spec.${s}` as 'spec.all')}
                </Chip>
              ))}
            </Group>
          </Chip.Group>
        </Group>
        <Group>
          <Button
            variant="subtle"
            leftSection={<IconRestore size={18} />}
            onClick={() =>
              modals.openConfirmModal({
                title: t('lib.restoreBuiltins'),
                children: <Text>{t('lib.restoreConfirm')}</Text>,
                labels: { confirm: t('c.confirm'), cancel: t('c.cancel') },
                onConfirm: async () => {
                  await api.conditions.resetBuiltins()
                  notifyOk(t('lib.restored'))
                  load()
                }
              })
            }
          >
            {t('lib.restoreBuiltins')}
          </Button>
          <Button leftSection={<IconPlus size={18} />} onClick={() => setEditing({ specialty: 'general', nameEn: '', nameAr: '', icd10: '', keywords: [], options: [newOption()] })} id="add-condition">
            {t('lib.addCondition')}
          </Button>
        </Group>
      </Group>
      <Table highlightOnHover verticalSpacing="xs">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t('lib.nameEn')}</Table.Th>
            <Table.Th>{t('lib.nameAr')}</Table.Th>
            <Table.Th>ICD-10</Table.Th>
            <Table.Th>{t('lib.specialty')}</Table.Th>
            <Table.Th>{t('lib.options')}</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {shown.map((c) => (
            <Table.Tr key={c.id} className="rx-click-row" onClick={() => setEditing(structuredClone(c))} style={{ opacity: c.hidden ? 0.45 : 1 }} data-condition-row={c.key}>
              <Table.Td dir="ltr" style={{ textAlign: 'start', fontWeight: 600 }}>
                {c.nameEn}
              </Table.Td>
              <Table.Td>{c.nameAr}</Table.Td>
              <Table.Td dir="ltr" style={{ textAlign: 'start' }}>
                {c.icd10}
              </Table.Td>
              <Table.Td>
                <Badge variant="light" tt="none">
                  {t(`spec.${c.specialty}` as 'spec.general')}
                </Badge>
              </Table.Td>
              <Table.Td>
                {t('lib.optionsCount', { n: c.options.length })} {c.hidden && <Badge color="gray" tt="none">{t('lib.hidden')}</Badge>}
              </Table.Td>
              <Table.Td onClick={(e) => e.stopPropagation()}>
                {!c.hidden && (
                  <Tooltip label={c.builtin ? t('lib.hide') : t('c.delete')}>
                    <ActionIcon
                      variant="subtle"
                      color={c.builtin ? 'gray' : 'red'}
                      onClick={async () => {
                        await api.conditions.delete(c.id)
                        load()
                      }}
                    >
                      {c.builtin ? <IconEyeOff size={16} /> : <IconTrash size={16} />}
                    </ActionIcon>
                  </Tooltip>
                )}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <Modal opened={!!editing} onClose={() => setEditing(null)} size={1150} title={<Text fw={700}>{editing?.id ? t('lib.editCondition') : t('lib.addCondition')}</Text>}>
        {editing && (
          <Stack>
            <SimpleGrid cols={4}>
              <TextInput label={t('lib.nameEn')} value={editing.nameEn} dir="ltr" onChange={(e) => setEditing({ ...editing, nameEn: e.currentTarget.value })} data-autofocus id="condition-name-en" />
              <TextInput label={t('lib.nameAr')} value={editing.nameAr} dir="rtl" onChange={(e) => setEditing({ ...editing, nameAr: e.currentTarget.value })} />
              <TextInput label={t('lib.icd')} value={editing.icd10} dir="ltr" onChange={(e) => setEditing({ ...editing, icd10: e.currentTarget.value })} />
              <Select
                label={t('lib.specialty')}
                value={editing.specialty}
                data={SPECS.map((s) => ({ value: s, label: t(`spec.${s}` as 'spec.general') }))}
                onChange={(v) => v && setEditing({ ...editing, specialty: v as ConditionInput['specialty'] })}
              />
            </SimpleGrid>
            <TextInput label={t('lib.keywords')} value={editing.keywords.join(', ')} onChange={(e) => setEditing({ ...editing, keywords: e.currentTarget.value.split(/[,،]/).map((x) => x.trimStart()) })} />
            <Divider label={t('lib.options')} labelPosition="center" />
            {editing.options.map((o, i) => (
              <Paper key={i} withBorder p="sm" radius="md" data-edit-option={i}>
                <Group align="flex-end" mb="xs">
                  <TextInput style={{ flex: 1 }} size="sm" label={t('lib.optionLabelEn')} value={o.labelEn} dir="ltr" onChange={(e) => setOpt(i, { labelEn: e.currentTarget.value })} />
                  <TextInput style={{ flex: 1 }} size="sm" label={t('lib.optionLabelAr')} value={o.labelAr} dir="rtl" onChange={(e) => setOpt(i, { labelAr: e.currentTarget.value })} />
                  <Switch label={t('lib.forChildren')} checked={o.forChildren} onChange={(e) => setOpt(i, { forChildren: e.currentTarget.checked })} mb={6} />
                  <Tooltip label={t('lib.removeOption')}>
                    <ActionIcon variant="subtle" color="red" mb={6} onClick={() => setEditing({ ...editing, options: editing.options.filter((_, k) => k !== i) })}>
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
                <MedicinesEditor items={o.items} onChange={(items) => setOpt(i, { items })} />
                <SimpleGrid cols={2} mt="xs">
                  <Textarea size="sm" label={t('rx.notes')} value={o.advice} dir="auto" minRows={1} onChange={(e) => setOpt(i, { advice: e.currentTarget.value })} />
                  <Textarea size="sm" label={t('rx.labTests')} value={o.labs} dir="auto" minRows={1} onChange={(e) => setOpt(i, { labs: e.currentTarget.value })} />
                </SimpleGrid>
              </Paper>
            ))}
            <Group justify="space-between">
              <Button variant="light" leftSection={<IconPlus size={16} />} onClick={() => setEditing({ ...editing, options: [...editing.options, newOption()] })}>
                {t('lib.addOption')}
              </Button>
              <Group>
                <Button variant="default" onClick={() => setEditing(null)}>
                  {t('c.cancel')}
                </Button>
                <Button onClick={save} disabled={!editing.nameEn.trim() && !editing.nameAr.trim()} id="condition-save">
                  {t('c.save')}
                </Button>
              </Group>
            </Group>
          </Stack>
        )}
      </Modal>
    </div>
  )
}
