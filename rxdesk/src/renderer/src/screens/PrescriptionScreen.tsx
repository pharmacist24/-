import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActionIcon,
  Autocomplete,
  Badge,
  Button,
  Group,
  Kbd,
  Menu,
  Modal,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip,
  UnstyledButton
} from '@mantine/core'
import { useHotkeys } from '@mantine/hooks'
import { modals } from '@mantine/modals'
import {
  IconAlertTriangle,
  IconDeviceFloppy,
  IconEdit,
  IconEye,
  IconFilePlus,
  IconFileTypePdf,
  IconHistory,
  IconPrinter,
  IconStar,
  IconTemplate,
  IconTrash,
  IconX
} from '@tabler/icons-react'
import type { ConditionOption, DosePhrase, Favorite, LayoutRecord, MedicineItem, Patient, PrescriptionListItem } from '@shared/types'
import { ageFromBirthDate, formatAge, formatDate, genderText, todayIso } from '@shared/text'
import { api } from '../lib/api'
import { useApp } from '../lib/app-context'
import { notifyError, notifyOk } from '../lib/notify'
import { enterAsTab } from '../lib/keyboard'
import MedicinesEditor, { emptyItem } from '../components/MedicinesEditor'
import PatientPicker from '../components/PatientPicker'
import DiagnosisInput, { splitDiagnoses } from '../components/DiagnosisInput'
import TreatmentPanel from '../components/TreatmentPanel'
import PatientFormModal from '../components/PatientFormModal'
import { usePrinting } from '../print/usePrinting'
import classes from './PrescriptionScreen.module.css'

interface RxForm {
  date: string
  diagnosis: string
  notes: string
  nextVisit: string
  labTests: string
}

const EMPTY_FORM = (): RxForm => ({ date: todayIso(), diagnosis: '', notes: '', nextVisit: '', labTests: '' })

function addDays(iso: string, days: number, months = 0): string {
  const base = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(iso + 'T12:00:00') : new Date()
  base.setMonth(base.getMonth() + months)
  base.setDate(base.getDate() + days)
  return todayIso(base)
}

const filled = (items: MedicineItem[]) => items.filter((i) => i.drugName.trim())

export default function PrescriptionScreen({ rxId: initialRxId, patientId, repeatFrom }: { rxId?: number; patientId?: number; repeatFrom?: number }) {
  const { t, lang, navigate, setLeaveGuard, settings } = useApp()
  const rf = settings.rxForm
  const [patient, setPatient] = useState<Patient | null>(null)
  const [rxId, setRxId] = useState<number | undefined>(initialRxId)
  const [form, setForm] = useState<RxForm>(EMPTY_FORM)
  const [items, setItems] = useState<MedicineItem[]>([emptyItem()])
  const [saved, setSaved] = useState('')
  const [activeRow, setActiveRow] = useState(0)
  const [repeatOf, setRepeatOf] = useState<number | null>(null)
  const [phrases, setPhrases] = useState<DosePhrase[]>([])
  const [favorites, setFavorites] = useState<Favorite[]>([])
  const [layouts, setLayouts] = useState<LayoutRecord[]>([])
  const [layoutId, setLayoutId] = useState<string | null>(null)
  const [history, setHistory] = useState<PrescriptionListItem[]>([])
  const [busy, setBusy] = useState('')
  const [tplOpen, setTplOpen] = useState(false)
  const [tplName, setTplName] = useState('')
  const [editPatient, setEditPatient] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const formRef = useRef<HTMLDivElement>(null)
  const printing = usePrinting()

  const snapshot = useMemo(
    () => JSON.stringify({ p: patient?.id ?? null, f: form, i: filled(items) }),
    [patient, form, items]
  )
  const dirty = loaded && snapshot !== saved && (filled(items).length > 0 || !!form.diagnosis || !!form.notes || !!form.labTests || !!rxId)

  useEffect(() => {
    setLeaveGuard(() => dirty)
  }, [dirty, setLeaveGuard])
  useEffect(() => () => setLeaveGuard(null), [setLeaveGuard])

  // Reference data
  useEffect(() => {
    api.phrases.list().then(setPhrases)
    api.favorites.list().then(setFavorites)
    api.layouts.list().then((ls) => {
      setLayouts(ls)
      setLayoutId(String((ls.find((l) => l.isDefault) ?? ls[0])?.id ?? ''))
    })
  }, [])

  // Initial load: existing prescription, repeat of an old one, or a new one for a patient.
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const sourceId = initialRxId ?? repeatFrom
        let p: Patient | null = null
        let f = EMPTY_FORM()
        let its: MedicineItem[] = []
        if (sourceId) {
          const rx = await api.rx.get(sourceId)
          if (rx) {
            p = await api.patients.get(rx.patientId)
            its = rx.items
            f = { date: initialRxId ? rx.date : todayIso(), diagnosis: rx.diagnosis, notes: rx.notes, labTests: rx.labTests, nextVisit: initialRxId ? rx.nextVisit : '' }
            if (repeatFrom) setRepeatOf(rx.id)
          }
        } else if (patientId) {
          p = await api.patients.get(patientId)
        }
        if (!alive) return
        setPatient(p)
        setForm(f)
        setItems([...its, emptyItem()])
        setSaved(initialRxId ? JSON.stringify({ p: p?.id ?? null, f, i: its }) : '')
        setLoaded(true)
      } catch (e) {
        notifyError(e, t)
      }
    })()
    return () => {
      alive = false
    }
  }, [initialRxId, repeatFrom, patientId, t])

  // Patient's previous prescriptions
  useEffect(() => {
    if (!patient) {
      setHistory([])
      return
    }
    api.rx.list({ patientId: patient.id, limit: 8 }).then((h) => setHistory(h.filter((x) => x.id !== rxId)))
  }, [patient, rxId])


  const patientAge = patient ? ageFromBirthDate(patient.birthDate) : null
  const patientIsChild = patientAge ? patientAge.years < 12 : null

  // A hidden section still shows when this prescription already has a value in it, so nothing is lost.
  const showDx = rf.showDiagnosis || !!form.diagnosis
  const showNotes = rf.showNotes || !!form.notes
  const showLabs = rf.showLabTests || !!form.labTests
  const showNext = rf.showNextVisit || !!form.nextVisit

  const setF = <K extends keyof RxForm>(k: K, v: RxForm[K]) => setForm((f) => ({ ...f, [k]: v }))

  const save = useCallback(async (): Promise<number | null> => {
    if (!patient) {
      modals.open({ title: t('c.error'), children: <Text>{t('rx.noPatient')}</Text> })
      return null
    }
    if (!filled(items).length && !form.labTests.trim() && !form.notes.trim() && !form.diagnosis.trim()) {
      modals.open({ title: t('c.error'), children: <Text>{t('rx.noItems')}</Text> })
      return null
    }
    setBusy('save')
    try {
      const rx = await api.rx.save({ id: rxId, patientId: patient.id, ...form, items: filled(items) })
      setRxId(rx.id)
      setRepeatOf(null)
      setSaved(JSON.stringify({ p: patient.id, f: form, i: filled(items) }))
      notifyOk(t('rx.saved'))
      return rx.id
    } catch (e) {
      notifyError(e, t)
      return null
    } finally {
      setBusy('')
    }
  }, [patient, items, form, rxId, t])

  const ensureSaved = async (): Promise<number | null> => {
    if (!patient) {
      modals.open({ title: t('c.error'), children: <Text>{t('rx.noPatient')}</Text> })
      return null
    }
    if (rxId && !dirty) return rxId
    return save()
  }

  const layoutNum = layoutId ? Number(layoutId) : undefined
  const doPrint = async () => {
    const id = await ensureSaved()
    if (id) printing.printSaved(id, layoutNum)
  }
  const doPreview = async () => {
    const id = await ensureSaved()
    if (id) printing.previewSaved(id, layoutNum)
  }
  const doPdf = async () => {
    const id = await ensureSaved()
    if (id) printing.pdfSaved(id, layoutNum)
  }

  useHotkeys(
    [
      ['mod+S', () => void save()],
      ['mod+P', () => void doPrint()],
      ['mod+N', () => navigate({ name: 'rx' })]
    ],
    []
  )

  const insertPhrase = (text: string) => {
    const idx = Math.min(activeRow, items.length - 1)
    setItems(items.map((it, i) => (i === idx ? { ...it, dose: text } : it)))
  }

  const addOption = (o: ConditionOption) => {
    setItems([...filled(items), ...o.items.map((i) => ({ ...emptyItem(), ...i })), emptyItem()])
    setForm((cur) => ({ ...cur, notes: cur.notes || o.advice, labTests: cur.labTests || o.labs }))
  }

  const insertTemplate = (f: Favorite) => {
    setItems([...filled(items), ...f.items.map((i) => ({ ...emptyItem(), ...i })), emptyItem()])
    setForm((cur) => ({ ...cur, diagnosis: cur.diagnosis || f.diagnosis, notes: cur.notes || f.notes }))
  }

  const repeatInto = async (id: number) => {
    const rx = await api.rx.get(id)
    if (!rx) return
    const apply = () => {
      setItems([...rx.items, emptyItem()])
      setForm((cur) => ({ ...cur, diagnosis: rx.diagnosis, notes: rx.notes, labTests: rx.labTests }))
      setRepeatOf(rx.id)
    }
    if (filled(items).length) {
      modals.openConfirmModal({
        title: t('pt.repeat'),
        children: <Text>{t('c.unsavedText')}</Text>,
        labels: { confirm: t('c.confirm'), cancel: t('c.cancel') },
        onConfirm: apply
      })
    } else apply()
  }

  const saveTemplate = async () => {
    try {
      const fav = await api.favorites.save({ name: tplName, diagnosis: form.diagnosis, notes: form.notes, items: filled(items) })
      setFavorites(await api.favorites.list())
      setTplOpen(false)
      notifyOk(t('rx.templateSaved') + ': ' + fav.name)
    } catch (e) {
      notifyError(e, t)
    }
  }

  const deleteRx = () =>
    modals.openConfirmModal({
      title: t('c.deleteConfirmTitle'),
      children: t('rx.deleteConfirm'),
      labels: { confirm: t('c.delete'), cancel: t('c.cancel') },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        if (!rxId) return
        await api.rx.delete(rxId)
        setLeaveGuard(null)
        notifyOk(t('c.deleted'))
        navigate({ name: 'rx' })
      }
    })

  return (
    <div className={classes.screen}>
      {/* Header bar */}
      <div className={classes.header}>
        <Group gap="sm">
          <Title order={3}>{rxId ? t('rx.editTitle', { id: rxId }) : t('rx.newTitle')}</Title>
          {dirty && rxId ? <Badge color="orange" variant="light">{t('d.unsaved')}</Badge> : null}
          {repeatOf ? <Badge variant="light">{t('rx.repeatOf', { id: repeatOf })}</Badge> : null}
        </Group>
        <Group gap="xs">
          <Tooltip label="Ctrl+N">
            <Button variant="default" leftSection={<IconFilePlus size={18} />} onClick={() => navigate({ name: 'rx' })}>
              {t('c.new')}
            </Button>
          </Tooltip>
          <TextInput type="date" w={165} size="md" value={form.date} onChange={(e) => setF('date', e.currentTarget.value)} aria-label={t('rx.date')} id="rx-date" />
          {!rf.showSidePanel && (
            <Menu position="bottom-end" width={300}>
              <Menu.Target>
                <Button variant="default" leftSection={<IconTemplate size={18} />} data-menu="templates">
                  {t('rx.templates')}
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                {favorites.length === 0 && <Menu.Label>{t('rx.noTemplates')}</Menu.Label>}
                {favorites.map((f) => (
                  <Menu.Item key={f.id} onClick={() => insertTemplate(f)} data-template={f.name}>
                    <Text fw={600} fz="sm">
                      {f.name}
                    </Text>
                    <Text fz="xs" c="dimmed" dir="ltr" ta="left" lineClamp={1}>
                      {f.items.map((i) => i.drugName).join(', ')}
                    </Text>
                  </Menu.Item>
                ))}
                <Menu.Divider />
                <Menu.Item
                  leftSection={<IconStar size={16} />}
                  disabled={!filled(items).length}
                  onClick={() => {
                    setTplName(form.diagnosis)
                    setTplOpen(true)
                  }}
                  id="save-template"
                >
                  {t('rx.saveAsTemplate')}
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          )}
          <Select
            w={190}
            size="md"
            value={layoutId}
            onChange={setLayoutId}
            data={layouts.map((l) => ({ value: String(l.id), label: l.name }))}
            aria-label={t('rx.layout')}
          />
          <Tooltip label={t('c.preview')}>
            <ActionIcon variant="default" size={42} onClick={doPreview} id="rx-preview">
              <IconEye size={20} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={t('c.pdf')}>
            <ActionIcon variant="default" size={42} onClick={doPdf} id="rx-pdf">
              <IconFileTypePdf size={20} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Ctrl+S">
            <Button variant="light" leftSection={<IconDeviceFloppy size={18} />} onClick={() => void save()} loading={busy === 'save'} id="rx-save">
              {t('c.save')}
            </Button>
          </Tooltip>
          <Tooltip label="Ctrl+P">
            <Button leftSection={<IconPrinter size={18} />} onClick={doPrint} id="rx-print">
              {t('c.print')}
            </Button>
          </Tooltip>
        </Group>
      </div>

      <div className={classes.body}>
        <ScrollArea className={classes.main} type="auto" offsetScrollbars>
          <Stack gap="md" ref={formRef} id="rx-form" p="md" pt="sm" onKeyDown={(e) => enterAsTab(e)}>
            {/* Patient */}
            <div className="rx-card">
              {!patient ? (
                <PatientPicker onSelect={setPatient} autoFocus={loaded} />
              ) : (
                <Group justify="space-between" align="flex-start" wrap="nowrap">
                  <div>
                    <Group gap="xs">
                      <Text fz={22} fw={700} id="rx-patient-name">
                        {patient.name}
                      </Text>
                      <Text c="dimmed">
                        {[formatAge(patient.birthDate, lang), genderText(patient.gender, lang), patient.weight].filter(Boolean).join(' · ')}
                      </Text>
                    </Group>
                    <Group gap="xs" mt={4}>
                      {patient.allergies && (
                        <Badge color="red" size="lg" variant="light" tt="none" leftSection={<IconAlertTriangle size={14} />}>
                          {t('rx.allergies')}: {patient.allergies}
                        </Badge>
                      )}
                      {patient.chronicDiseases && (
                        <Badge color="grape" size="lg" variant="light" tt="none">
                          {t('rx.chronic')}: {patient.chronicDiseases}
                        </Badge>
                      )}
                    </Group>
                  </div>
                  <Group gap={4} data-enter-skip>
                    {!rf.showSidePanel && history.length > 0 && (
                      <Menu position="bottom-end" width={320}>
                        <Menu.Target>
                          <Button variant="subtle" size="sm" leftSection={<IconHistory size={16} />} tabIndex={-1} data-menu="previous">
                            {t('rx.previous')} ({history.length})
                          </Button>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Label>{t('pt.repeat')}</Menu.Label>
                          {history.map((h) => (
                            <Menu.Item key={h.id} onClick={() => repeatInto(h.id)}>
                              <Group justify="space-between" wrap="nowrap">
                                <Text fz="sm" fw={600}>
                                  {formatDate(h.date, lang)}
                                </Text>
                                <Text fz="xs" c="dimmed" lineClamp={1}>
                                  {h.diagnosis}
                                </Text>
                              </Group>
                              <Text fz="xs" c="dimmed" dir="ltr" ta="left" lineClamp={1}>
                                {h.drugsSummary}
                              </Text>
                            </Menu.Item>
                          ))}
                        </Menu.Dropdown>
                      </Menu>
                    )}
                    <Tooltip label={t('c.edit')}>
                      <ActionIcon variant="subtle" size="lg" onClick={() => setEditPatient(true)} tabIndex={-1}>
                        <IconEdit size={20} />
                      </ActionIcon>
                    </Tooltip>
                    {!rxId && (
                      <Button variant="subtle" size="sm" leftSection={<IconX size={16} />} onClick={() => setPatient(null)} tabIndex={-1}>
                        {t('rx.changePatient')}
                      </Button>
                    )}
                  </Group>
                </Group>
              )}
            </div>

            {/* Diagnoses (shown if enabled, or if this prescription already has one) + treatment suggestions */}
            {showDx && (
              <div className="rx-card">
                <DiagnosisInput value={form.diagnosis} onChange={(v) => setF('diagnosis', v)} child={patientIsChild} />
                {rf.showSmartPanel && <TreatmentPanel diagnoses={splitDiagnoses(form.diagnosis)} patient={patient} onAdd={addOption} />}
              </div>
            )}

            {/* Medicines */}
            <div className="rx-card" style={{ paddingInline: 10 }}>
              <Group justify="space-between" px={8} mb={6}>
                <Text fw={700} fz="lg">
                  <span dir="ltr">℞</span> {t('rx.medicines')}
                </Text>
                <Text fz="xs" c="dimmed">
                  {t('rx.shortcuts')}
                </Text>
              </Group>
              <MedicinesEditor
                items={items}
                onChange={setItems}
                allergies={patient?.allergies}
                activeRow={activeRow}
                onActiveRow={setActiveRow}
                fields={rf.medFields}
                phrases={phrases.map((p) => p.text)}
              />
            </div>

            {/* Extra: advice, lab tests, next visit (each shown if enabled, or if it already has a value) */}
            {(showNotes || showLabs || showNext) && (
              <div className="rx-card">
                {showLabs || showNext ? (
                  <Text fw={700} mb="sm">
                    {t('rx.extra')}
                  </Text>
                ) : null}
                <SimpleGrid cols={showNotes && showLabs ? 2 : 1} spacing="md">
                  {showNotes && <Textarea label={t('rx.notes')} value={form.notes} onChange={(e) => setF('notes', e.currentTarget.value)} dir="auto" minRows={showLabs ? 3 : 2} id="rx-notes" />}
                  {showLabs && <Textarea label={t('rx.labTests')} value={form.labTests} onChange={(e) => setF('labTests', e.currentTarget.value)} dir="auto" minRows={3} id="rx-labs" />}
                </SimpleGrid>
                {showNext && (
                  <Group mt={showNotes || showLabs ? 'md' : 0} align="flex-end">
                    <TextInput type="date" label={t('rx.nextVisit')} w={190} value={form.nextVisit} onChange={(e) => setF('nextVisit', e.currentTarget.value)} id="rx-next" />
                    <Group gap={6} data-enter-skip>
                      {[
                        ['+3', 3, 0],
                        ['+7', 7, 0],
                        ['+14', 14, 0],
                        ['+1M', 0, 1]
                      ].map(([label, d, m]) => (
                        <Button key={String(label)} size="sm" variant="default" tabIndex={-1} onClick={() => setF('nextVisit', addDays(form.date, Number(d), Number(m)))}>
                          <span dir="ltr">{label}</span>
                        </Button>
                      ))}
                      {form.nextVisit && (
                        <ActionIcon variant="subtle" color="gray" onClick={() => setF('nextVisit', '')} tabIndex={-1}>
                          <IconX size={16} />
                        </ActionIcon>
                      )}
                    </Group>
                  </Group>
                )}
              </div>
            )}
            {rxId && (
              <Group justify="flex-end">
                <Button variant="subtle" color="red" leftSection={<IconTrash size={16} />} onClick={deleteRx}>
                  {t('rx.delete')}
                </Button>
              </Group>
            )}
          </Stack>
        </ScrollArea>

        {/* Side panel */}
        {rf.showSidePanel && (
        <ScrollArea className={classes.side} type="auto">
          <Stack gap="md" p="md" pt="sm">
            <div className="rx-card" style={{ padding: 14 }}>
              <Text fw={700}>{t('rx.phrases')}</Text>
              <Text fz="xs" c="dimmed" mb={8}>
                {t('rx.phrasesHint')}
              </Text>
              <Stack gap={6}>
                {phrases.map((p) => (
                  <UnstyledButton key={p.id} className={classes.phrase} onClick={() => insertPhrase(p.text)} dir="auto" data-phrase={p.id}>
                    {p.text}
                  </UnstyledButton>
                ))}
              </Stack>
            </div>
            <div className="rx-card" style={{ padding: 14 }}>
              <Group justify="space-between" mb={8}>
                <Text fw={700}>
                  <IconTemplate size={18} style={{ verticalAlign: -3 }} /> {t('rx.templates')}
                </Text>
                <Tooltip label={t('rx.saveAsTemplate')}>
                  <ActionIcon
                    variant="light"
                    disabled={!filled(items).length}
                    onClick={() => {
                      setTplName(form.diagnosis)
                      setTplOpen(true)
                    }}
                    id="save-template"
                  >
                    <IconStar size={18} />
                  </ActionIcon>
                </Tooltip>
              </Group>
              {favorites.length === 0 && (
                <Text fz="sm" c="dimmed">
                  {t('rx.noTemplates')}
                </Text>
              )}
              <Stack gap={6}>
                {favorites.map((f) => (
                  <UnstyledButton key={f.id} className={classes.template} onClick={() => insertTemplate(f)} data-template={f.name}>
                    <Text fw={600} fz="sm">
                      {f.name}
                    </Text>
                    <Text fz="xs" c="dimmed" dir="ltr" ta="left" lineClamp={1}>
                      {f.items.map((i) => i.drugName).join(', ')}
                    </Text>
                  </UnstyledButton>
                ))}
              </Stack>
            </div>
            {patient && history.length > 0 && (
              <div className="rx-card" style={{ padding: 14 }}>
                <Text fw={700} mb={8}>
                  {t('rx.history')}
                </Text>
                <Stack gap={6}>
                  {history.map((h) => (
                    <UnstyledButton key={h.id} className={classes.template} onClick={() => repeatInto(h.id)} title={t('pt.repeat')}>
                      <Group justify="space-between" wrap="nowrap">
                        <Text fz="sm" fw={600}>
                          {formatDate(h.date, lang)}
                        </Text>
                        <Text fz="xs" c="dimmed" lineClamp={1}>
                          {h.diagnosis}
                        </Text>
                      </Group>
                      <Text fz="xs" c="dimmed" dir="ltr" ta="left" lineClamp={1}>
                        {h.drugsSummary}
                      </Text>
                    </UnstyledButton>
                  ))}
                </Stack>
              </div>
            )}
            <Text fz="xs" c="dimmed" ta="center">
              <Kbd>Ctrl</Kbd>+<Kbd>S</Kbd> · <Kbd>Ctrl</Kbd>+<Kbd>P</Kbd> · <Kbd>Ctrl</Kbd>+<Kbd>N</Kbd>
            </Text>
          </Stack>
        </ScrollArea>
        )}
      </div>

      <Modal opened={tplOpen} onClose={() => setTplOpen(false)} title={t('rx.saveAsTemplate')}>
        <TextInput label={t('rx.templateName')} value={tplName} onChange={(e) => setTplName(e.currentTarget.value)} data-autofocus onKeyDown={(e) => e.key === 'Enter' && tplName.trim() && saveTemplate()} id="template-name" />
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => setTplOpen(false)}>
            {t('c.cancel')}
          </Button>
          <Button onClick={saveTemplate} disabled={!tplName.trim()} id="template-save">
            {t('c.save')}
          </Button>
        </Group>
      </Modal>
      <PatientFormModal
        opened={editPatient}
        patient={patient}
        onClose={() => setEditPatient(false)}
        onSaved={(p) => {
          setPatient(p)
          setEditPatient(false)
        }}
      />
      {printing.element}
    </div>
  )
}
