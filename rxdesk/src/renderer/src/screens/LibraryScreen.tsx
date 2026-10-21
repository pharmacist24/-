import { useEffect, useMemo, useState } from 'react'
import {
  ActionIcon,
  Autocomplete,
  Badge,
  Button,
  Group,
  Modal,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Title
} from '@mantine/core'
import { modals } from '@mantine/modals'
import { IconStethoscope, IconArrowDown, IconArrowUp, IconEdit, IconPill, IconPlus, IconSearch, IconTemplate, IconTextCaption, IconTrash } from '@tabler/icons-react'
import type { DosePhrase, Drug, DrugInput, Favorite, FavoriteInput, MedicineItem } from '@shared/types'
import { DRUG_FORMS, DURATION_SUGGESTIONS, FREQUENCY_SUGGESTIONS, INSTRUCTION_SUGGESTIONS, ROUTES } from '@shared/defaults'
import { normalizeForSearch } from '@shared/text'
import { api } from '../lib/api'
import { useApp } from '../lib/app-context'
import { notifyError, notifyOk } from '../lib/notify'
import MedicinesEditor, { emptyItem } from '../components/MedicinesEditor'
import ConditionsTab from '../components/ConditionsTab'

export default function LibraryScreen() {
  const { t } = useApp()
  return (
    <div className="rx-page-wrap">
      <Title order={2} mb="md">
        {t('lib.title')}
      </Title>
      <Tabs defaultValue="drugs" variant="outline" keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="drugs" leftSection={<IconPill size={18} />} data-tab="drugs">
            {t('lib.drugs')}
          </Tabs.Tab>
          <Tabs.Tab value="phrases" leftSection={<IconTextCaption size={18} />} data-tab="phrases">
            {t('lib.phrases')}
          </Tabs.Tab>
          <Tabs.Tab value="favorites" leftSection={<IconTemplate size={18} />} data-tab="favorites">
            {t('lib.favorites')}
          </Tabs.Tab>
          <Tabs.Tab value="conditions" leftSection={<IconStethoscope size={18} />} data-tab="conditions">
            {t('lib.conditions')}
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="drugs">
          <DrugsTab />
        </Tabs.Panel>
        <Tabs.Panel value="phrases">
          <PhrasesTab />
        </Tabs.Panel>
        <Tabs.Panel value="favorites">
          <FavoritesTab />
        </Tabs.Panel>
        <Tabs.Panel value="conditions">
          <ConditionsTab />
        </Tabs.Panel>
      </Tabs>
    </div>
  )
}

const confirmDelete = (t: ReturnType<typeof useApp>['t'], name: string, onConfirm: () => void) =>
  modals.openConfirmModal({
    title: t('c.deleteConfirmTitle'),
    children: <Text>{t('c.deleteConfirm', { name })}</Text>,
    labels: { confirm: t('c.delete'), cancel: t('c.cancel') },
    confirmProps: { color: 'red' },
    onConfirm
  })

const EMPTY_DRUG: DrugInput = { name: '', form: '', strength: '', dose: '', frequency: '', duration: '', route: '', instructions: '' }

function DrugsTab() {
  const { t } = useApp()
  const [drugs, setDrugs] = useState<Drug[]>([])
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<DrugInput | null>(null)
  const load = () => api.drugs.list().then(setDrugs).catch((e) => notifyError(e, t))
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const shown = useMemo(() => {
    const n = normalizeForSearch(q)
    return n ? drugs.filter((d) => normalizeForSearch(d.name).includes(n)) : drugs
  }, [drugs, q])

  const save = async () => {
    if (!editing) return
    try {
      await api.drugs.save(editing)
      setEditing(null)
      notifyOk(t('c.saved'))
      load()
    } catch (e) {
      notifyError(e, t)
    }
  }

  const set = (k: keyof DrugInput) => (v: string) => setEditing((d) => (d ? { ...d, [k]: v } : d))

  return (
    <div className="rx-card">
      <Group justify="space-between" mb="md">
        <Group>
          <TextInput leftSection={<IconSearch size={18} />} placeholder={t('lib.searchDrugs')} value={q} onChange={(e) => setQ(e.currentTarget.value)} w={320} />
          <Text c="dimmed">{t('lib.drugCount', { n: drugs.length })}</Text>
        </Group>
        <Button leftSection={<IconPlus size={18} />} onClick={() => setEditing({ ...EMPTY_DRUG })} id="add-drug">
          {t('lib.addDrug')}
        </Button>
      </Group>
      <Table highlightOnHover verticalSpacing="xs">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t('rx.drug')}</Table.Th>
            <Table.Th>{t('rx.form')}</Table.Th>
            <Table.Th>{t('rx.strength')}</Table.Th>
            <Table.Th>{t('rx.dose')}</Table.Th>
            <Table.Th>{t('rx.frequency')}</Table.Th>
            <Table.Th>{t('rx.duration')}</Table.Th>
            <Table.Th>{t('lib.uses')}</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {shown.map((d) => (
            <Table.Tr key={d.id} className="rx-click-row" onClick={() => setEditing({ ...d })}>
              <Table.Td dir="ltr" style={{ textAlign: 'start', fontWeight: 600 }}>
                {d.name}
              </Table.Td>
              <Table.Td dir="ltr" style={{ textAlign: 'start' }}>{d.form}</Table.Td>
              <Table.Td dir="ltr" style={{ textAlign: 'start' }}>{d.strength}</Table.Td>
              <Table.Td style={{ unicodeBidi: 'plaintext' }}>{d.dose}</Table.Td>
              <Table.Td style={{ unicodeBidi: 'plaintext' }}>{d.frequency}</Table.Td>
              <Table.Td style={{ unicodeBidi: 'plaintext' }}>{d.duration}</Table.Td>
              <Table.Td>
                <Badge variant="light" color="gray">
                  {d.useCount}
                </Badge>
              </Table.Td>
              <Table.Td onClick={(e) => e.stopPropagation()}>
                <ActionIcon
                  variant="subtle"
                  color="red"
                  onClick={() =>
                    confirmDelete(t, d.name, async () => {
                      await api.drugs.delete(d.id)
                      load()
                    })
                  }
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      <Modal opened={!!editing} onClose={() => setEditing(null)} title={<Text fw={700}>{editing?.id ? t('lib.editDrug') : t('lib.addDrug')}</Text>} size="lg">
        {editing && (
          <Stack>
            <Text fz="sm" c="dimmed">
              {t('lib.drugDefaultsHint')}
            </Text>
            <TextInput label={t('rx.drug')} value={editing.name} onChange={(e) => set('name')(e.currentTarget.value)} dir="ltr" withAsterisk data-autofocus id="drug-name" />
            <SimpleGrid cols={2}>
              <Autocomplete label={t('rx.form')} data={DRUG_FORMS} value={editing.form} onChange={set('form')} dir="ltr" />
              <TextInput label={t('rx.strength')} value={editing.strength} onChange={(e) => set('strength')(e.currentTarget.value)} dir="ltr" />
              <TextInput label={t('rx.dose')} value={editing.dose} onChange={(e) => set('dose')(e.currentTarget.value)} dir="auto" />
              <Autocomplete label={t('rx.frequency')} data={FREQUENCY_SUGGESTIONS} value={editing.frequency} onChange={set('frequency')} dir="auto" />
              <Autocomplete label={t('rx.duration')} data={DURATION_SUGGESTIONS} value={editing.duration} onChange={set('duration')} dir="auto" />
              <Autocomplete label={t('rx.route')} data={ROUTES} value={editing.route} onChange={set('route')} dir="ltr" />
            </SimpleGrid>
            <Autocomplete label={t('rx.instructions')} data={INSTRUCTION_SUGGESTIONS} value={editing.instructions} onChange={set('instructions')} dir="auto" />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setEditing(null)}>
                {t('c.cancel')}
              </Button>
              <Button onClick={save} disabled={!editing.name.trim()} id="drug-save">
                {t('c.save')}
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </div>
  )
}

function PhrasesTab() {
  const { t } = useApp()
  const [phrases, setPhrases] = useState<DosePhrase[]>([])
  const [text, setText] = useState('')
  const [editId, setEditId] = useState<number | null>(null)
  const [editText, setEditText] = useState('')
  const load = () => api.phrases.list().then(setPhrases)
  useEffect(() => {
    load()
  }, [])

  const add = async () => {
    if (!text.trim()) return
    await api.phrases.save({ text })
    setText('')
    load()
  }
  const move = async (i: number, dir: -1 | 1) => {
    const ids = phrases.map((p) => p.id)
    const j = i + dir
    if (j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    await api.phrases.reorder(ids)
    load()
  }

  return (
    <div className="rx-card" style={{ maxWidth: 820 }}>
      <Group mb="md" align="flex-end">
        <TextInput style={{ flex: 1 }} label={t('lib.addPhrase')} placeholder={t('lib.phrasePlaceholder')} value={text} onChange={(e) => setText(e.currentTarget.value)} onKeyDown={(e) => e.key === 'Enter' && add()} dir="auto" id="phrase-input" />
        <Button leftSection={<IconPlus size={18} />} onClick={add} disabled={!text.trim()}>
          {t('c.add')}
        </Button>
      </Group>
      <Stack gap={6}>
        {phrases.map((p, i) => (
          <Group key={p.id} justify="space-between" wrap="nowrap" p={8} style={{ border: '1px solid #e9ecef', borderRadius: 8 }}>
            {editId === p.id ? (
              <TextInput
                style={{ flex: 1 }}
                size="sm"
                value={editText}
                dir="auto"
                autoFocus
                onChange={(e) => setEditText(e.currentTarget.value)}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter' && editText.trim()) {
                    await api.phrases.save({ id: p.id, text: editText })
                    setEditId(null)
                    load()
                  }
                  if (e.key === 'Escape') setEditId(null)
                }}
                onBlur={() => setEditId(null)}
              />
            ) : (
              <Text style={{ unicodeBidi: 'plaintext', flex: 1 }}>{p.text}</Text>
            )}
            <Group gap={2} wrap="nowrap">
              <ActionIcon variant="subtle" color="gray" disabled={i === 0} onClick={() => move(i, -1)}>
                <IconArrowUp size={16} />
              </ActionIcon>
              <ActionIcon variant="subtle" color="gray" disabled={i === phrases.length - 1} onClick={() => move(i, 1)}>
                <IconArrowDown size={16} />
              </ActionIcon>
              <ActionIcon
                variant="subtle"
                onClick={() => {
                  setEditId(p.id)
                  setEditText(p.text)
                }}
              >
                <IconEdit size={16} />
              </ActionIcon>
              <ActionIcon
                variant="subtle"
                color="red"
                onClick={async () => {
                  await api.phrases.delete(p.id)
                  load()
                }}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Group>
          </Group>
        ))}
      </Stack>
    </div>
  )
}

function FavoritesTab() {
  const { t } = useApp()
  const [favorites, setFavorites] = useState<Favorite[]>([])
  const [editing, setEditing] = useState<(FavoriteInput & { items: MedicineItem[] }) | null>(null)
  const load = () => api.favorites.list().then(setFavorites)
  useEffect(() => {
    load()
  }, [])

  const save = async () => {
    if (!editing) return
    try {
      await api.favorites.save(editing)
      setEditing(null)
      notifyOk(t('rx.templateSaved'))
      load()
    } catch (e) {
      notifyError(e, t)
    }
  }

  return (
    <div className="rx-card">
      <Group justify="flex-end" mb="md">
        <Button leftSection={<IconPlus size={18} />} onClick={() => setEditing({ name: '', diagnosis: '', notes: '', items: [emptyItem()] })}>
          {t('lib.addFavorite')}
        </Button>
      </Group>
      {favorites.length === 0 && <Text c="dimmed">{t('rx.noTemplates')}</Text>}
      <SimpleGrid cols={3}>
        {favorites.map((f) => (
          <div key={f.id} className="rx-card" style={{ padding: 14, cursor: 'pointer' }} onClick={() => setEditing({ ...f, items: [...f.items] })}>
            <Group justify="space-between" wrap="nowrap">
              <Text fw={700}>{f.name}</Text>
              <ActionIcon
                variant="subtle"
                color="red"
                onClick={(e) => {
                  e.stopPropagation()
                  confirmDelete(t, f.name, async () => {
                    await api.favorites.delete(f.id)
                    load()
                  })
                }}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Group>
            {f.diagnosis && (
              <Text fz="sm" c="dimmed" style={{ unicodeBidi: 'plaintext' }}>
                {f.diagnosis}
              </Text>
            )}
            <Stack gap={0} mt={6} dir="ltr">
              {f.items.map((i, k) => (
                <Text key={k} fz="sm" ta="left">
                  {k + 1}. {i.drugName} {i.strength} {i.form}
                </Text>
              ))}
            </Stack>
          </div>
        ))}
      </SimpleGrid>
      <Modal opened={!!editing} onClose={() => setEditing(null)} title={<Text fw={700}>{editing?.id ? t('lib.editFavorite') : t('lib.addFavorite')}</Text>} size={1100}>
        {editing && (
          <Stack>
            <SimpleGrid cols={2}>
              <TextInput label={t('rx.templateName')} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.currentTarget.value })} withAsterisk data-autofocus />
              <TextInput label={t('rx.diagnosis')} value={editing.diagnosis} onChange={(e) => setEditing({ ...editing, diagnosis: e.currentTarget.value })} dir="auto" />
            </SimpleGrid>
            <MedicinesEditor items={editing.items} onChange={(items) => setEditing((cur) => (cur ? { ...cur, items } : cur))} />
            <Textarea label={t('rx.notes')} value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.currentTarget.value })} dir="auto" />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setEditing(null)}>
                {t('c.cancel')}
              </Button>
              <Button onClick={save} disabled={!editing.name.trim()}>
                {t('c.save')}
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </div>
  )
}
