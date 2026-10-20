import { useCallback, useEffect, useState } from 'react'
import { AppShell, Box, Center, DirectionProvider, Loader, MantineProvider, NavLink, Stack, Text, UnstyledButton } from '@mantine/core'
import { ModalsProvider } from '@mantine/modals'
import { Notifications, notifications } from '@mantine/notifications'
import {
  IconChartBar,
  IconFilePlus,
  IconLayoutBoard,
  IconLock,
  IconPill,
  IconSettings,
  IconUsers
} from '@tabler/icons-react'
import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import './styles/fonts.css'
import './styles/app.css'
import type { AppSettings, ClinicProfile } from '@shared/types'
import { api } from './lib/api'
import { AppProvider, useApp, type Route } from './lib/app-context'
import { theme } from './theme'
import { makeT } from './i18n'
import LockScreen from './screens/LockScreen'
import SetupWizard from './screens/SetupWizard'
import PatientsScreen from './screens/PatientsScreen'
import PatientDetailScreen from './screens/PatientDetailScreen'
import SettingsScreen from './screens/SettingsScreen'
import PrescriptionScreen from './screens/PrescriptionScreen'
import LibraryScreen from './screens/LibraryScreen'
import DesignerScreen from './screens/DesignerScreen'
import ReportsScreen from './screens/ReportsScreen'

type Boot = { settings: AppSettings; profile: ClinicProfile | null; locked: boolean }

export default function App() {
  const [boot, setBoot] = useState<Boot | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const [info, settings] = await Promise.all([api.app.info(), api.settings.get()])
      const profile = info.locked ? null : await api.settings.getProfile()
      setBoot({ settings, profile, locked: info.locked })
    } catch (e) {
      setError(String((e as Error).message ?? e))
    }
  }, [])

  useEffect(() => {
    load()
    // After a restore the database was replaced: reload everything.
    const off = window.rxdesk.on('db-replaced', () => window.location.reload())
    const off2 = window.rxdesk.on('backup-failed', () => {
      const lang = boot?.settings.language ?? 'ar'
      notifications.show({ color: 'orange', message: makeT(lang)('st.backupFailed'), autoClose: 10000 })
    })
    return () => {
      off()
      off2()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load])

  const dir = (boot?.settings.language ?? 'ar') === 'ar' ? 'rtl' : 'ltr'

  return (
    <DirectionProvider initialDirection={dir} detectDirection={false}>
      <MantineProvider theme={theme} defaultColorScheme="light">
        <ModalsProvider>
          <Notifications position="top-center" />
          {error ? (
            <Center h="100vh">
              <Text c="red">{error}</Text>
            </Center>
          ) : !boot ? (
            <Center h="100vh">
              <Loader />
            </Center>
          ) : boot.locked ? (
            <LockScreen lang={boot.settings.language} onUnlocked={load} />
          ) : (
            <AppProvider initialSettings={boot.settings} initialProfile={boot.profile!}>
              <Root onLocked={load} />
            </AppProvider>
          )}
        </ModalsProvider>
      </MantineProvider>
    </DirectionProvider>
  )
}

function Root({ onLocked }: { onLocked: () => void }) {
  const { settings } = useApp()
  if (!settings.setupCompleted) return <SetupWizard />
  return <Shell onLocked={onLocked} />
}

const NAV: { name: Route['name']; icon: typeof IconUsers; label: Parameters<ReturnType<typeof makeT>>[0] }[] = [
  { name: 'rx', icon: IconFilePlus, label: 'nav.newRx' },
  { name: 'patients', icon: IconUsers, label: 'nav.patients' },
  { name: 'library', icon: IconPill, label: 'nav.library' },
  { name: 'designer', icon: IconLayoutBoard, label: 'nav.designer' },
  { name: 'reports', icon: IconChartBar, label: 'nav.reports' },
  { name: 'settings', icon: IconSettings, label: 'nav.settings' }
]

function Shell({ onLocked }: { onLocked: () => void }) {
  const { t, route, navigate, settings, profile } = useApp()
  const active = route.name === 'patient' ? 'patients' : route.name

  return (
    <AppShell navbar={{ width: 232, breakpoint: 0 }} padding={0}>
      <AppShell.Navbar p="sm" className="rx-nav">
        <Stack gap={2} h="100%">
          <Box px="xs" py="sm" mb="xs">
            <Text fw={800} fz={26} c="teal.8" style={{ letterSpacing: 0.5 }} dir="ltr" ta="center">
              ℞ RxDesk
            </Text>
            <Text fz="xs" c="dimmed" ta="center" lineClamp={1}>
              {(settings.language === 'ar' ? profile.doctorNameAr : profile.doctorNameEn) || profile.doctorNameAr || t('app.tagline')}
            </Text>
          </Box>
          {NAV.map((n) => (
            <NavLink
              key={n.name}
              active={active === n.name}
              label={t(n.label)}
              leftSection={<n.icon size={22} stroke={1.7} />}
              onClick={() => navigate({ name: n.name } as Route)}
              className="rx-navlink"
              data-nav={n.name}
            />
          ))}
          <Box style={{ flex: 1 }} />
          {settings.pinEnabled && (
            <UnstyledButton
              className="rx-lock-btn"
              onClick={async () => {
                await api.auth.lock()
                onLocked()
              }}
            >
              <IconLock size={18} /> {t('nav.lock')}
            </UnstyledButton>
          )}
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
    case 'rx':
      return <PrescriptionScreen key={route.key} rxId={route.rxId} patientId={route.patientId} repeatFrom={route.repeatFrom} />
    case 'patients':
      return <PatientsScreen />
    case 'patient':
      return <PatientDetailScreen key={route.id} id={route.id} />
    case 'library':
      return <LibraryScreen />
    case 'designer':
      return <DesignerScreen />
    case 'reports':
      return <ReportsScreen />
    case 'settings':
      return <SettingsScreen />
  }
}
