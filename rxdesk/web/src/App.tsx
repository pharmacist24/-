import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActionIcon,
  Alert,
  AppShell,
  Badge,
  Box,
  Button,
  Center,
  DirectionProvider,
  Group,
  Loader,
  MantineProvider,
  Menu,
  Modal,
  NavLink,
  Paper,
  PasswordInput,
  SegmentedControl,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip,
  useDirection
} from '@mantine/core'
import { ModalsProvider } from '@mantine/modals'
import { Notifications, notifications } from '@mantine/notifications'
import {
  IconArrowBack,
  IconBuildingHospital,
  IconChartBar,
  IconCloudCheck,
  IconCloudUpload,
  IconCloudX,
  IconDots,
  IconDownload,
  IconKey,
  IconLayoutBoard,
  IconLogout,
  IconPill,
  IconPlayerPause,
  IconPlayerPlay,
  IconPlus,
  IconRefresh,
  IconSettings,
  IconTrash,
  IconUsers
} from '@tabler/icons-react'
import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import '../../src/renderer/src/styles/fonts.css'
import '../../src/renderer/src/styles/app.css'
import type { Session } from '@supabase/supabase-js'
import { theme } from '../../src/renderer/src/theme'
import { AppProvider, useApp, type Route } from '../../src/renderer/src/lib/app-context'
import { makeT } from '../../src/renderer/src/i18n'
import { api } from '../../src/renderer/src/lib/api'
import { onSyncedChanges } from '../../src/renderer/src/lib/sync'
import PatientsScreen from '../../src/renderer/src/screens/PatientsScreen'
import PatientDetailScreen from '../../src/renderer/src/screens/PatientDetailScreen'
import LibraryScreen from '../../src/renderer/src/screens/LibraryScreen'
import DesignerScreen from '../../src/renderer/src/screens/DesignerScreen'
import ReportsScreen from '../../src/renderer/src/screens/ReportsScreen'
import SettingsScreen from '../../src/renderer/src/screens/SettingsScreen'
import type { AppSettings, ClinicProfile } from '@shared/types'
import { adminAction, isAdmin, listClinics, supabase, type ClinicRow } from './cloud'
import { ClinicSession } from './clinicSession'
import { webT, type WebLang, type WT } from './strings'
import './web.css'

function savedLang(): WebLang {
  try {
    return localStorage.getItem('rxdesk.webLang') === 'en' ? 'en' : 'ar'
  } catch {
    return 'ar'
  }
}

export default function App() {
  return (
    <DirectionProvider initialDirection={savedLang() === 'ar' ? 'rtl' : 'ltr'} detectDirection={false}>
      <MantineProvider theme={theme} defaultColorScheme="light">
        <ModalsProvider>
          <Notifications position="bottom-center" />
          <Admin />
        </ModalsProvider>
      </MantineProvider>
    </DirectionProvider>
  )
}

function Admin() {
  const [lang, setLangState] = useState<WebLang>(savedLang())
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [admin, setAdmin] = useState<boolean | null>(null)
  const [clinic, setClinic] = useState<ClinicRow | null>(null)
  const { setDirection } = useDirection()
  const t = useMemo(() => webT(lang), [lang])

  const setLang = (l: WebLang) => {
    setLangState(l)
    try {
      localStorage.setItem('rxdesk.webLang', l)
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    if (clinic) return // inside a clinic the clinic's own language is used
    const dir = lang === 'ar' ? 'rtl' : 'ltr'
    setDirection(dir)
    document.documentElement.dir = dir
    document.documentElement.lang = lang
  }, [lang, clinic, setDirection])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    setAdmin(null)
    if (session?.user) isAdmin(session.user.id).then(setAdmin)
  }, [session?.user?.id])

  if (session === undefined) return <FullLoader />
  if (!session) return <SignIn t={t} lang={lang} setLang={setLang} />
  if (admin === null) return <FullLoader />
  if (!admin)
    return (
      <Center h="100vh">
        <Stack align="center">
          <Text c="red">{t('notAdmin')}</Text>
          <Button variant="default" onClick={() => supabase.auth.signOut()}>
            {t('signOut')}
          </Button>
        </Stack>
      </Center>
    )
  if (clinic) return <ClinicWorkspace key={clinic.id} clinic={clinic} t={t} onBack={() => setClinic(null)} />
  return <Clinics t={t} lang={lang} setLang={setLang} email={session.user.email ?? ''} onOpen={setClinic} />
}

function FullLoader({ text }: { text?: string }) {
  return (
    <Center h="100vh">
      <Stack align="center">
        <Loader />
        {text && <Text c="dimmed">{text}</Text>}
      </Stack>
    </Center>
  )
}

function LangSwitch({ lang, setLang }: { lang: WebLang; setLang: (l: WebLang) => void }) {
  return (
    <SegmentedControl
      size="xs"
      value={lang}
      onChange={(v) => setLang(v as WebLang)}
      data={[
        { value: 'ar', label: 'العربية' },
        { value: 'en', label: 'English' }
      ]}
    />
  )
}

// ------------------------------------------------------------------ sign in
function SignIn({ t, lang, setLang }: { t: WT; lang: WebLang; setLang: (l: WebLang) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [creating, setCreating] = useState(false)

  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      if (creating) {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password })
        if (error) throw error
        if (!data.session) setInfo(t('checkMail'))
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Center h="100vh" bg="gray.0">
      <Paper withBorder shadow="sm" p="xl" radius="md" w={400}>
        <Stack>
          <Group justify="space-between">
            <Text fw={800} fz={24} c="teal.8" dir="ltr">
              ℞ RxDesk
            </Text>
            <LangSwitch lang={lang} setLang={setLang} />
          </Group>
          <Title order={3}>{creating ? t('createAdmin') : t('signInTitle')}</Title>
          <TextInput label={t('email')} value={email} onChange={(e) => setEmail(e.currentTarget.value)} dir="ltr" id="admin-email" autoComplete="username" />
          <PasswordInput
            label={t('password')}
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
            dir="ltr"
            id="admin-password"
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
          {error && <Alert color="red">{error}</Alert>}
          {info && <Alert color="teal">{info}</Alert>}
          <Button onClick={submit} loading={busy} disabled={!email || password.length < 6} id="admin-signin">
            {creating ? t('createAdminBtn') : t('signIn')}
          </Button>
          <Button variant="subtle" size="xs" onClick={() => setCreating(!creating)}>
            {creating ? t('signIn') : t('createAdmin')}
          </Button>
        </Stack>
      </Paper>
    </Center>
  )
}

// ------------------------------------------------------------------ clinics list
function fmt(iso: string | null, lang: WebLang): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })
}

function Clinics({ t, lang, setLang, email, onOpen }: { t: WT; lang: WebLang; setLang: (l: WebLang) => void; email: string; onOpen: (c: ClinicRow) => void }) {
  const [rows, setRows] = useState<ClinicRow[] | null>(null)
  const [q, setQ] = useState('')
  const [creating, setCreating] = useState(false)
  const [resetFor, setResetFor] = useState<ClinicRow | null>(null)
  const [deleteFor, setDeleteFor] = useState<ClinicRow | null>(null)

  const load = useCallback(() => {
    listClinics()
      .then(setRows)
      .catch((e) => notifications.show({ color: 'red', message: (e as Error).message }))
  }, [])
  useEffect(load, [load])

  const act = async (body: Record<string, unknown>, ok?: string) => {
    try {
      await adminAction(body)
      if (ok) notifications.show({ color: 'teal', message: ok })
      load()
    } catch (e) {
      notifications.show({ color: 'red', message: (e as Error).message })
    }
  }

  const shown = (rows ?? []).filter((c) => !q || (c.name + ' ' + c.owner_email).toLowerCase().includes(q.toLowerCase()))

  return (
    <Box p="lg" maw={1200} mx="auto">
      <Group justify="space-between" mb="lg">
        <Group>
          <Text fw={800} fz={26} c="teal.8" dir="ltr">
            ℞ RxDesk
          </Text>
          <Title order={2}>{t('clinics')}</Title>
        </Group>
        <Group>
          <LangSwitch lang={lang} setLang={setLang} />
          <Text fz="sm" c="dimmed" dir="ltr">
            {email}
          </Text>
          <Button variant="default" leftSection={<IconLogout size={16} />} onClick={() => supabase.auth.signOut()}>
            {t('signOut')}
          </Button>
        </Group>
      </Group>
      <Group mb="md">
        <TextInput placeholder={t('search')} value={q} onChange={(e) => setQ(e.currentTarget.value)} w={320} />
        <ActionIcon variant="default" size="lg" onClick={load} title={t('refresh')}>
          <IconRefresh size={18} />
        </ActionIcon>
        <Box style={{ flex: 1 }} />
        <Button leftSection={<IconPlus size={18} />} onClick={() => setCreating(true)} id="new-clinic">
          {t('newClinic')}
        </Button>
      </Group>
      <Paper withBorder radius="md">
        {!rows ? (
          <Center p="xl">
            <Loader />
          </Center>
        ) : shown.length === 0 ? (
          <Text c="dimmed" ta="center" p="xl">
            {t('none')}
          </Text>
        ) : (
          <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md" id="clinics-table">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('clinicName')}</Table.Th>
                <Table.Th>{t('email')}</Table.Th>
                <Table.Th>{t('lastSync')}</Table.Th>
                <Table.Th>{t('patients')}</Table.Th>
                <Table.Th>{t('prescriptions')}</Table.Th>
                <Table.Th>{t('drugs')}</Table.Th>
                <Table.Th>{t('version')}</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {shown.map((c) => (
                <Table.Tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => onOpen(c)} data-clinic={c.name}>
                  <Table.Td fw={600}>
                    {c.name} {c.disabled && <Badge color="gray">{t('disabled')}</Badge>}
                  </Table.Td>
                  <Table.Td dir="ltr" style={{ textAlign: 'start' }}>
                    {c.owner_email}
                  </Table.Td>
                  <Table.Td>{c.last_sync_at ? fmt(c.last_sync_at, lang) : <Text c="dimmed">{t('never')}</Text>}</Table.Td>
                  <Table.Td>{c.patients}</Table.Td>
                  <Table.Td>{c.prescriptions}</Table.Td>
                  <Table.Td>{c.drugs}</Table.Td>
                  <Table.Td dir="ltr">{c.app_version}</Table.Td>
                  <Table.Td onClick={(e) => e.stopPropagation()}>
                    <Group gap={4} wrap="nowrap">
                      <Button size="xs" variant="light" onClick={() => onOpen(c)}>
                        {t('open')}
                      </Button>
                      <Menu position="bottom-end">
                        <Menu.Target>
                          <ActionIcon variant="subtle">
                            <IconDots size={18} />
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item leftSection={<IconKey size={16} />} onClick={() => setResetFor(c)}>
                            {t('resetPassword')}
                          </Menu.Item>
                          <Menu.Item
                            leftSection={c.disabled ? <IconPlayerPlay size={16} /> : <IconPlayerPause size={16} />}
                            onClick={() => act({ action: 'set-disabled', clinicId: c.id, disabled: !c.disabled })}
                          >
                            {c.disabled ? t('enable') : t('disable')}
                          </Menu.Item>
                          <Menu.Item color="red" leftSection={<IconTrash size={16} />} onClick={() => setDeleteFor(c)}>
                            {t('delete')}
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>
      <NewClinicModal t={t} opened={creating} onClose={() => setCreating(false)} onCreated={load} />
      <PasswordModal t={t} clinic={resetFor} onClose={() => setResetFor(null)} />
      <DeleteModal t={t} clinic={deleteFor} onClose={() => setDeleteFor(null)} onDeleted={load} />
    </Box>
  )
}

function NewClinicModal({ t, opened, onClose, onCreated }: { t: WT; opened: boolean; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const close = () => {
    setName('')
    setEmail('')
    setPassword('')
    setError('')
    setDone(false)
    onClose()
  }
  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      await adminAction({ action: 'create', name: name.trim(), email: email.trim(), password })
      setDone(true)
      onCreated()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal opened={opened} onClose={close} title={t('newClinic')} centered>
      {done ? (
        <Stack>
          <Alert color="teal">{t('created')}</Alert>
          <Text dir="ltr" ff="monospace">
            {email}
            <br />
            {password}
          </Text>
          <Button onClick={close}>OK</Button>
        </Stack>
      ) : (
        <Stack>
          <TextInput label={t('clinicName')} value={name} onChange={(e) => setName(e.currentTarget.value)} id="nc-name" />
          <TextInput label={t('doctorEmail')} value={email} onChange={(e) => setEmail(e.currentTarget.value)} dir="ltr" id="nc-email" />
          <TextInput label={t('doctorPassword')} value={password} onChange={(e) => setPassword(e.currentTarget.value)} dir="ltr" id="nc-password" />
          {error && <Alert color="red">{error}</Alert>}
          <Group justify="flex-end">
            <Button variant="default" onClick={close}>
              {t('cancel')}
            </Button>
            <Button onClick={submit} loading={busy} disabled={!name.trim() || !email.includes('@') || password.length < 8} id="nc-create">
              {t('create')}
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  )
}

function PasswordModal({ t, clinic, onClose }: { t: WT; clinic: ClinicRow | null; onClose: () => void }) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    setBusy(true)
    try {
      await adminAction({ action: 'reset-password', clinicId: clinic!.id, password })
      notifications.show({ color: 'teal', message: t('passwordChanged') })
      setPassword('')
      onClose()
    } catch (e) {
      notifications.show({ color: 'red', message: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal opened={!!clinic} onClose={onClose} title={`${t('resetPassword')} — ${clinic?.name ?? ''}`} centered>
      <Stack>
        <TextInput label={t('newPassword')} value={password} onChange={(e) => setPassword(e.currentTarget.value)} dir="ltr" />
        <Group justify="flex-end">
          <Button onClick={submit} loading={busy} disabled={password.length < 8}>
            {t('save')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}

function DeleteModal({ t, clinic, onClose, onDeleted }: { t: WT; clinic: ClinicRow | null; onClose: () => void; onDeleted: () => void }) {
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    setBusy(true)
    try {
      await adminAction({ action: 'delete', clinicId: clinic!.id })
      setTyped('')
      onClose()
      onDeleted()
    } catch (e) {
      notifications.show({ color: 'red', message: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal opened={!!clinic} onClose={onClose} title={t('delete')} centered>
      <Stack>
        <Text>{t('deleteConfirm')}</Text>
        <Text fw={700}>{clinic?.name}</Text>
        <TextInput value={typed} onChange={(e) => setTyped(e.currentTarget.value)} />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button color="red" onClick={submit} loading={busy} disabled={typed.trim() !== clinic?.name.trim()}>
            {t('delete')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}

// ------------------------------------------------------------------ one clinic
type Boot = { session: ClinicSession; settings: AppSettings; profile: ClinicProfile }

function ClinicWorkspace({ clinic, t, onBack }: { clinic: ClinicRow; t: WT; onBack: () => void }) {
  const [boot, setBoot] = useState<Boot | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const s = new ClinicSession(clinic.id, clinic.name)
    let alive = true
    s.open()
      .then(() => {
        if (!alive) return
        setBoot({ session: s, settings: s.repo.getSettings(), profile: s.repo.getProfile() })
      })
      .catch((e) => alive && setError((e as Error).message))
    return () => {
      alive = false
      s.close()
    }
  }, [clinic.id, clinic.name])

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (boot?.session.hasUnsaved()) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [boot])

  if (error)
    return (
      <Center h="100vh">
        <Stack align="center">
          <Text c="red">{error}</Text>
          <Button onClick={onBack}>{t('allClinics')}</Button>
        </Stack>
      </Center>
    )
  if (!boot) return <FullLoader text={t('loadingClinic')} />
  const back = () => {
    if (boot.session.hasUnsaved() && !window.confirm(t('pending'))) return
    onBack()
  }
  return (
    <AppProvider initialSettings={boot.settings} initialProfile={boot.profile} initialRoute={{ name: 'patients' }}>
      <WebShell clinic={clinic} session={boot.session} t={t} onBack={back} />
    </AppProvider>
  )
}

const NAV: { name: Route['name']; icon: typeof IconUsers; label: Parameters<ReturnType<typeof makeT>>[0] }[] = [
  { name: 'patients', icon: IconUsers, label: 'nav.patients' },
  { name: 'reports', icon: IconChartBar, label: 'nav.reports' },
  { name: 'library', icon: IconPill, label: 'nav.library' },
  { name: 'designer', icon: IconLayoutBoard, label: 'nav.designer' },
  { name: 'settings', icon: IconSettings, label: 'nav.settings' }
]

function SaveBadge({ session, t }: { session: ClinicSession; t: WT }) {
  const [, force] = useState(0)
  useEffect(() => {
    session.onState = () => force((n) => n + 1)
    return () => {
      session.onState = () => undefined
    }
  }, [session])
  const st = session.state
  const icon = st === 'saving' ? <IconCloudUpload size={16} /> : st === 'error' ? <IconCloudX size={16} /> : <IconCloudCheck size={16} />
  return (
    <Tooltip label={session.lastError || ''} disabled={!session.lastError}>
      <Badge variant="light" color={st === 'error' ? 'orange' : st === 'saving' ? 'blue' : 'teal'} leftSection={icon} id="web-save-state" data-state={st}>
        {st === 'saving' ? t('saving') : st === 'error' ? t('saveFailed') : t('saved')}
      </Badge>
    </Tooltip>
  )
}

function WebShell({ clinic, session, t, onBack }: { clinic: ClinicRow; session: ClinicSession; t: WT; onBack: () => void }) {
  const app = useApp()
  const { route, navigate, reload, lang } = app
  const active = route.name === 'patient' ? 'patients' : route.name
  useEffect(() => onSyncedChanges(() => void reload()), [reload])

  return (
    <AppShell navbar={{ width: 232, breakpoint: 0 }} header={{ height: 56 }} padding={0}>
      <AppShell.Header px="md">
        <Group h="100%" justify="space-between" wrap="nowrap">
          <Group wrap="nowrap">
            <Button variant="subtle" leftSection={<IconArrowBack size={18} style={{ transform: lang === 'ar' ? 'scaleX(-1)' : undefined }} />} onClick={onBack} id="back-to-clinics">
              {t('allClinics')}
            </Button>
            <IconBuildingHospital size={20} />
            <Text fw={700} lineClamp={1}>
              {clinic.name}
            </Text>
            {!clinic.last_sync_at && (
              <Tooltip label={t('notSyncedYet')} multiline w={280}>
                <Badge color="orange" variant="light">
                  {t('never')}
                </Badge>
              </Tooltip>
            )}
          </Group>
          <Group wrap="nowrap">
            <SaveBadge session={session} t={t} />
            <Menu position="bottom-end">
              <Menu.Target>
                <Button variant="default" size="xs" leftSection={<IconDownload size={16} />}>
                  {t('export')}
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item onClick={() => api.exports.patientsCsv()}>{t('exportPatients')}</Menu.Item>
                <Menu.Item onClick={() => api.exports.prescriptionsCsv()}>{t('exportRx')}</Menu.Item>
              </Menu.Dropdown>
            </Menu>
            <ActionIcon variant="default" onClick={() => session.run().then(() => reload())} title={t('refresh')} id="web-refresh">
              <IconRefresh size={16} />
            </ActionIcon>
          </Group>
        </Group>
      </AppShell.Header>
      <AppShell.Navbar p="sm" className="rx-nav">
        <Stack gap={2}>
          {NAV.map((n) => (
            <NavLink
              key={n.name}
              active={active === n.name}
              label={app.t(n.label)}
              leftSection={<n.icon size={22} stroke={1.7} />}
              onClick={() => navigate({ name: n.name } as Route)}
              className="rx-navlink"
              data-nav={n.name}
            />
          ))}
        </Stack>
      </AppShell.Navbar>
      <AppShell.Main className="rx-main">
        <Screen route={route} />
      </AppShell.Main>
    </AppShell>
  )
}

function Screen({ route }: { route: Route }) {
  switch (route.name) {
    case 'patient':
      return <PatientDetailScreen key={route.id} id={route.id} />
    case 'library':
      return <LibraryScreen />
    case 'designer':
      return <DesignerScreen />
    case 'reports':
      return <ReportsScreen />
    case 'settings':
      return <SettingsScreen key={route.tab ?? ''} initialTab={route.tab} />
    default:
      return <PatientsScreen />
  }
}
