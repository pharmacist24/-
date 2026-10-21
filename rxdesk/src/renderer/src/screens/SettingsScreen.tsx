import { useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Checkbox,
  Paper,
  SimpleGrid,
  Code,
  Group,
  NumberInput,
  PasswordInput,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  Table,
  Tabs,
  Text,
  Title
} from '@mantine/core'
import { modals } from '@mantine/modals'
import {
  IconBuildingHospital,
  IconDatabase,
  IconDeviceFloppy,
  IconFileExport,
  IconFolder,
  IconInfoCircle,
  IconLanguage,
  IconListDetails,
  IconLock,
  IconPrinter,
  IconRestore
} from '@tabler/icons-react'
import type { AppInfo, BackupInfo, ClinicProfile, LayoutRecord, MedicineItem, PrinterInfo, RxFormSettings, RxMedField } from '@shared/types'
import { ALL_RX_MED_FIELDS, DETAILED_RX_FORM, SIMPLE_RX_FORM } from '@shared/defaults'
import type { StringKey } from '../i18n'
import MedicinesEditor, { doseLine } from '../components/MedicinesEditor'
import { formatDate } from '@shared/text'
import { api } from '../lib/api'
import { useApp } from '../lib/app-context'
import { notifyError, notifyOk } from '../lib/notify'
import ProfileForm from '../components/ProfileForm'

export default function SettingsScreen() {
  const { t } = useApp()
  const [tab, setTab] = useState<string | null>('rxform')
  return (
    <div className="rx-page-wrap">
      <Title order={2} mb="md">
        {t('st.title')}
      </Title>
      <Tabs value={tab} onChange={setTab} variant="outline" keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="rxform" leftSection={<IconListDetails size={18} />} data-tab="rxform">
            {t('st.rxForm')}
          </Tabs.Tab>
          <Tabs.Tab value="clinic" leftSection={<IconBuildingHospital size={18} />}>
            {t('st.clinic')}
          </Tabs.Tab>
          <Tabs.Tab value="general" leftSection={<IconLanguage size={18} />}>
            {t('st.general')}
          </Tabs.Tab>
          <Tabs.Tab value="printing" leftSection={<IconPrinter size={18} />} data-tab="printing">
            {t('st.printing')}
          </Tabs.Tab>
          <Tabs.Tab value="backup" leftSection={<IconDatabase size={18} />} data-tab="backup">
            {t('st.backup')}
          </Tabs.Tab>
          <Tabs.Tab value="security" leftSection={<IconLock size={18} />} data-tab="security">
            {t('st.security')}
          </Tabs.Tab>
          <Tabs.Tab value="about" leftSection={<IconInfoCircle size={18} />}>
            {t('st.about')}
          </Tabs.Tab>
        </Tabs.List>
        <div className="rx-card" style={{ maxWidth: 900 }}>
          <Tabs.Panel value="rxform">
            <RxFormTab />
          </Tabs.Panel>
          <Tabs.Panel value="clinic">
            <ClinicTab />
          </Tabs.Panel>
          <Tabs.Panel value="general">
            <GeneralTab />
          </Tabs.Panel>
          <Tabs.Panel value="printing">
            <PrintingTab />
          </Tabs.Panel>
          <Tabs.Panel value="backup">
            <BackupTab />
          </Tabs.Panel>
          <Tabs.Panel value="security">
            <SecurityTab />
          </Tabs.Panel>
          <Tabs.Panel value="about">
            <AboutTab />
          </Tabs.Panel>
        </div>
      </Tabs>
    </div>
  )
}

const SAMPLE_DRUG = { dose: '1 tablet', frequency: 'every 12 hours', duration: '7 days', instructions: 'بعد الأكل' }

/** Settings → Prescription screen: which boxes and sections the New prescription screen shows. */
function RxFormTab() {
  const { t, settings, updateSettings } = useApp()
  const rf = settings.rxForm
  const set = (patch: Partial<RxFormSettings>) => updateSettings({ rxForm: { ...rf, ...patch } }).catch((e) => notifyError(e, t))
  const same = (a: RxFormSettings, b: RxFormSettings) => JSON.stringify(a) === JSON.stringify(b)
  const sample = (fields: RxMedField[]): MedicineItem[] => [
    {
      drugName: 'Augmentin',
      form: 'Tab',
      strength: '1 g',
      dose: doseLine(SAMPLE_DRUG, fields),
      frequency: fields.includes('frequency') ? SAMPLE_DRUG.frequency : '',
      duration: fields.includes('duration') ? SAMPLE_DRUG.duration : '',
      route: fields.includes('route') ? 'Oral' : '',
      instructions: fields.includes('instructions') ? SAMPLE_DRUG.instructions : ''
    }
  ]
  const [preview, setPreview] = useState<MedicineItem[]>(() => sample(rf.medFields))
  useEffect(() => setPreview(sample(rf.medFields)), [rf.medFields.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  const preset = (value: RxFormSettings, title: StringKey, hint: StringKey, id: string) => (
    <Paper
      withBorder
      p="md"
      radius="md"
      style={{ cursor: 'pointer', borderColor: same(rf, value) ? 'var(--mantine-color-teal-6)' : undefined, background: same(rf, value) ? 'var(--mantine-color-teal-0)' : undefined }}
      onClick={() => set(value)}
      data-preset={id}
    >
      <Text fw={700}>{t(title)}</Text>
      <Text fz="sm" c="dimmed">
        {t(hint)}
      </Text>
    </Paper>
  )
  const sections: [keyof RxFormSettings, StringKey][] = [
    ['showNotes', 'st.rxShowNotes'],
    ['showDiagnosis', 'st.rxShowDiagnosis'],
    ['showSmartPanel', 'st.rxShowSmartPanel'],
    ['showLabTests', 'st.rxShowLabTests'],
    ['showNextVisit', 'st.rxShowNextVisit'],
    ['showSidePanel', 'st.rxShowSidePanel']
  ]
  return (
    <Stack gap="lg">
      <Text c="dimmed">{t('st.rxFormHint')}</Text>
      <SimpleGrid cols={2}>
        {preset(SIMPLE_RX_FORM, 'st.rxSimple', 'st.rxSimpleHint', 'simple')}
        {preset(DETAILED_RX_FORM, 'st.rxDetailed', 'st.rxDetailedHint', 'detailed')}
      </SimpleGrid>
      <div>
        <Text fw={600} mb={6}>
          {t('st.rxMedFields')}
        </Text>
        <SimpleGrid cols={3} spacing="xs">
          <Checkbox label={t('rx.drug')} checked disabled />
          <Checkbox label={t('rx.dose')} checked disabled />
          {ALL_RX_MED_FIELDS.map((f) => (
            <Checkbox
              key={f}
              label={t(`rx.${f}` as StringKey)}
              checked={rf.medFields.includes(f)}
              onChange={(e) => set({ medFields: e.currentTarget.checked ? [...rf.medFields, f] : rf.medFields.filter((x) => x !== f) })}
              data-field-toggle={f}
            />
          ))}
        </SimpleGrid>
      </div>
      <div>
        <Text fw={600} mb={6}>
          {t('st.rxSections')}
        </Text>
        <Stack gap="xs">
          {sections.map(([k, label]) => (
            <Switch key={k} label={t(label)} checked={!!rf[k]} onChange={(e) => set({ [k]: e.currentTarget.checked })} data-section-toggle={k} />
          ))}
        </Stack>
      </div>
      <div>
        <Text fw={600} mb={6}>
          {t('st.rxPreview')}
        </Text>
        <div style={{ pointerEvents: 'none' }} data-enter-skip>
          <MedicinesEditor items={preview} onChange={setPreview} fields={rf.medFields} />
        </div>
        {rf.medFields.length < ALL_RX_MED_FIELDS.length && (
          <Text fz="sm" c="dimmed" mt={4}>
            {t('st.rxHiddenNote')}
          </Text>
        )}
      </div>
    </Stack>
  )
}

function ClinicTab() {
  const { t, profile, setProfile, setLeaveGuard } = useApp()
  const [value, setValue] = useState<ClinicProfile>(profile)
  const [busy, setBusy] = useState(false)
  const dirty = JSON.stringify(value) !== JSON.stringify(profile)
  useEffect(() => {
    setLeaveGuard(() => dirty)
    return () => setLeaveGuard(null)
  }, [dirty, setLeaveGuard])
  const save = async () => {
    setBusy(true)
    try {
      setProfile(await api.settings.saveProfile(value))
      notifyOk(t('st.profileSaved'))
    } catch (e) {
      notifyError(e, t)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Stack>
      <ProfileForm value={value} onChange={setValue} />
      <Group justify="flex-end">
        <Button leftSection={<IconDeviceFloppy size={18} />} onClick={save} loading={busy} disabled={!dirty} id="save-profile">
          {t('c.saveChanges')}
        </Button>
      </Group>
    </Stack>
  )
}

function GeneralTab() {
  const { t, settings, updateSettings } = useApp()
  const run = (p: Parameters<typeof updateSettings>[0]) => updateSettings(p).catch((e) => notifyError(e, t))
  return (
    <Stack gap="lg">
      <div>
        <Text fw={600} mb={6}>
          {t('st.language')}
        </Text>
        <SegmentedControl
          value={settings.language}
          onChange={(v) => run({ language: v as 'ar' | 'en' })}
          data={[
            { value: 'ar', label: 'العربية' },
            { value: 'en', label: 'English' }
          ]}
          id="ui-language"
        />
      </div>
      <div>
        <Text fw={600} mb={2}>
          {t('st.printLanguage')}
        </Text>
        <Text c="dimmed" fz="sm" mb={6}>
          {t('st.printLanguageHint')}
        </Text>
        <SegmentedControl
          value={settings.printLanguage}
          onChange={(v) => run({ printLanguage: v as 'ar' | 'en' })}
          data={[
            { value: 'ar', label: 'العربية' },
            { value: 'en', label: 'English' }
          ]}
        />
      </div>
    </Stack>
  )
}

function PrintingTab() {
  const { t, settings, updateSettings } = useApp()
  const [printers, setPrinters] = useState<PrinterInfo[]>([])
  const [layouts, setLayouts] = useState<LayoutRecord[]>([])
  useEffect(() => {
    api.print.printers().then(setPrinters).catch(() => setPrinters([]))
    api.layouts.list().then(setLayouts).catch((e) => notifyError(e, t))
  }, [t])
  const run = (p: Parameters<typeof updateSettings>[0]) => updateSettings(p).catch((e) => notifyError(e, t))
  const def = layouts.find((l) => l.isDefault)
  return (
    <Stack gap="lg">
      <Select
        label={t('st.printer')}
        value={settings.defaultPrinter || '__default'}
        onChange={(v) => run({ defaultPrinter: v === '__default' ? '' : v ?? '' })}
        data={[{ value: '__default', label: t('st.systemDefault') }, ...printers.map((p) => ({ value: p.name, label: p.displayName }))]}
      />
      <Switch
        label={t('st.silent')}
        description={t('st.silentHint')}
        checked={settings.silentPrint}
        onChange={(e) => run({ silentPrint: e.currentTarget.checked })}
      />
      <NumberInput label={t('st.copies')} min={1} max={20} w={200} value={settings.copies} onChange={(v) => run({ copies: Number(v) || 1 })} />
      <Select
        label={t('st.defaultLayout')}
        value={def ? String(def.id) : null}
        data={layouts.map((l) => ({ value: String(l.id), label: l.name }))}
        onChange={async (v) => {
          if (!v) return
          await api.layouts.setDefault(Number(v))
          setLayouts(await api.layouts.list())
          notifyOk(t('c.saved'))
        }}
      />
    </Stack>
  )
}

function fmtSize(n: number): string {
  return n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`
}

function BackupTab() {
  const { t, lang, settings, updateSettings } = useApp()
  const [autoList, setAutoList] = useState<BackupInfo[]>([])
  const [busy, setBusy] = useState('')
  const refresh = () => api.backup.listAuto().then(setAutoList).catch(() => undefined)
  useEffect(() => {
    refresh()
  }, [settings.autoBackup.folder])

  const wrap = async (key: string, fn: () => Promise<void>) => {
    setBusy(key)
    try {
      await fn()
    } catch (e) {
      notifyError(e, t)
    } finally {
      setBusy('')
    }
  }

  const backupNow = () =>
    wrap('now', async () => {
      const r = await api.backup.now()
      if (r) notifyOk(t('st.backupDone', { path: r.path }))
    })

  const restore = () =>
    wrap('restore', async () => {
      const c = await api.backup.pickRestoreFile()
      if (!c) return
      modals.openConfirmModal({
        title: t('st.restoreConfirmTitle'),
        children: (
          <Text>
            {t('st.restoreConfirm', {
              patients: c.patients,
              prescriptions: c.prescriptions,
              date: formatDate(c.createdAt.slice(0, 10), lang)
            })}
          </Text>
        ),
        labels: { confirm: t('c.confirm'), cancel: t('c.cancel') },
        confirmProps: { color: 'red' },
        onConfirm: async () => {
          try {
            await api.backup.restore(c.path)
            notifyOk(t('st.restoreDone'))
          } catch (e) {
            notifyError(e, t)
          }
        }
      })
    })

  const exp = (kind: 'patients' | 'rx') =>
    wrap(kind, async () => {
      const p = kind === 'patients' ? await api.exports.patientsCsv() : await api.exports.prescriptionsCsv()
      if (p) notifyOk(t('st.exported', { path: p }))
    })

  const ab = settings.autoBackup
  return (
    <Stack gap="lg">
      <Group align="flex-start" grow>
        <Stack gap={4}>
          <Button leftSection={<IconDeviceFloppy size={18} />} onClick={backupNow} loading={busy === 'now'} id="backup-now">
            {t('st.backupNow')}
          </Button>
          <Text fz="sm" c="dimmed">
            {t('st.backupNowHint')}
          </Text>
        </Stack>
        <Stack gap={4}>
          <Button variant="light" color="orange" leftSection={<IconRestore size={18} />} onClick={restore} loading={busy === 'restore'}>
            {t('st.restore')}
          </Button>
          <Text fz="sm" c="dimmed">
            {t('st.restoreHint')}
          </Text>
        </Stack>
      </Group>

      <div className="rx-card" style={{ background: '#fafbfc' }}>
        <Switch
          label={<Text fw={600}>{t('st.auto')}</Text>}
          checked={ab.enabled}
          onChange={(e) => updateSettings({ autoBackup: { ...ab, enabled: e.currentTarget.checked } })}
          mb="md"
        />
        <Text fz="sm" fw={500}>
          {t('st.autoFolder')}
        </Text>
        <Code block mb="xs" dir="ltr" ff={ab.folder ? undefined : "inherit"} style={{ textAlign: "start" }}>
          {ab.folder || t('st.autoFolderDefault')}
        </Code>
        <Group mb="md">
          <Button
            variant="default"
            size="sm"
            leftSection={<IconFolder size={16} />}
            onClick={async () => {
              const f = await api.backup.chooseFolder()
              if (f) await updateSettings({ autoBackup: { ...ab, folder: f } })
            }}
          >
            {t('st.chooseFolder')}
          </Button>
          {ab.folder && (
            <Button variant="subtle" size="sm" onClick={() => updateSettings({ autoBackup: { ...ab, folder: '' } })}>
              {t('st.useDefaultFolder')}
            </Button>
          )}
        </Group>
        <Group align="flex-end">
          <NumberInput
            label={t('st.keep')}
            min={1}
            max={365}
            w={220}
            value={ab.keep}
            onChange={(v) => updateSettings({ autoBackup: { ...ab, keep: Number(v) || 14 } })}
          />
          <Button
            variant="light"
            loading={busy === 'auto'}
            onClick={() =>
              wrap('auto', async () => {
                const r = await api.backup.runAutoNow()
                notifyOk(t('st.backupDone', { path: r.path }))
                await refresh()
                // lastRunAt changed in the main process
                await updateSettings({})
              })
            }
          >
            {t('st.runAutoNow')}
          </Button>
        </Group>
        <Text fz="sm" mt="sm" c="dimmed">
          {t('st.lastAuto')}: {ab.lastRunAt ? `${formatDate(ab.lastRunAt.slice(0, 10), lang)} ${ab.lastRunAt.slice(11, 16)}` : t('st.never')}
        </Text>
        {autoList.length > 0 && (
          <Table mt="sm" fz="sm">
            <Table.Tbody>
              {autoList.map((b) => (
                <Table.Tr key={b.path}>
                  <Table.Td dir="ltr" style={{ textAlign: 'start' }}>
                    {b.path.split(/[\\/]/).pop()}
                  </Table.Td>
                  <Table.Td>{fmtSize(b.sizeBytes)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </div>

      <Group>
        <Button variant="default" leftSection={<IconFileExport size={18} />} onClick={() => exp('patients')} loading={busy === 'patients'}>
          {t('st.exportPatients')}
        </Button>
        <Button variant="default" leftSection={<IconFileExport size={18} />} onClick={() => exp('rx')} loading={busy === 'rx'}>
          {t('st.exportRx')}
        </Button>
      </Group>
    </Stack>
  )
}

function SecurityTab() {
  const { t, settings, reload } = useApp()
  const [current, setCurrent] = useState('')
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [busy, setBusy] = useState(false)
  const digits = (s: string) => s.replace(/\D/g, '').slice(0, 8)
  const valid = /^\d{4,8}$/.test(pin) && pin === pin2

  const submit = async (remove: boolean) => {
    setBusy(true)
    try {
      await api.auth.setPin(current, remove ? '' : pin)
      notifyOk(remove ? t('pin.removed') : t('pin.saved'))
      setCurrent('')
      setPin('')
      setPin2('')
      await reload()
    } catch (e) {
      notifyError(e, t)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Stack maw={420}>
      <Text c="dimmed">{t('setup.securityHint')}</Text>
      {settings.pinEnabled && (
        <PasswordInput label={t('pin.current')} value={current} onChange={(e) => setCurrent(digits(e.currentTarget.value))} id="pin-current" />
      )}
      <PasswordInput label={t('pin.new')} value={pin} onChange={(e) => setPin(digits(e.currentTarget.value))} id="pin-new" />
      <PasswordInput
        label={t('pin.confirm')}
        value={pin2}
        onChange={(e) => setPin2(digits(e.currentTarget.value))}
        error={pin2 && pin !== pin2 ? t('pin.mismatch') : undefined}
        id="pin-new2"
      />
      <Group>
        <Button onClick={() => submit(false)} disabled={!valid || (settings.pinEnabled && !current)} loading={busy} id="pin-save">
          {settings.pinEnabled ? t('pin.change') : t('pin.enable')}
        </Button>
        {settings.pinEnabled && (
          <Button variant="light" color="red" onClick={() => submit(true)} disabled={!current} loading={busy}>
            {t('pin.remove')}
          </Button>
        )}
      </Group>
    </Stack>
  )
}

function AboutTab() {
  const { t } = useApp()
  const [info, setInfo] = useState<AppInfo | null>(null)
  useEffect(() => {
    api.app.info().then(setInfo)
  }, [])
  return (
    <Stack>
      <Alert color="teal" variant="light" icon={<IconLock />}>
        {t('st.offline')}
      </Alert>
      <Text>
        <b>RxDesk</b> — {t('st.version')} <span dir="ltr">{info?.version}</span>
      </Text>
      <div>
        <Text fz="sm" fw={500}>
          {t('st.dataFolder')}
        </Text>
        <Code block dir="ltr">
          {info?.dataDir}
        </Code>
      </div>
      <Group>
        <Button variant="default" leftSection={<IconFolder size={18} />} onClick={() => api.app.openDataFolder()}>
          {t('st.openDataFolder')}
        </Button>
        <Button variant="default" onClick={() => api.app.openLogFile()}>
          {t('st.openLog')}
        </Button>
      </Group>
    </Stack>
  )
}
