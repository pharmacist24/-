import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useDirection } from '@mantine/core'
import { modals } from '@mantine/modals'
import type { AppSettings, ClinicProfile } from '@shared/types'
import { DEFAULT_SETTINGS, EMPTY_PROFILE } from '@shared/defaults'
import { makeT, type TFunction } from '../i18n'
import { api } from './api'

export type Route =
  | { name: 'rx'; rxId?: number; patientId?: number; repeatFrom?: number; key?: number }
  | { name: 'patients' }
  | { name: 'patient'; id: number }
  | { name: 'library' }
  | { name: 'designer' }
  | { name: 'reports' }
  | { name: 'settings'; tab?: string }

interface AppContextValue {
  settings: AppSettings
  profile: ClinicProfile
  lang: 'ar' | 'en'
  t: TFunction
  route: Route
  navigate: (r: Route) => void
  reload: () => Promise<void>
  updateSettings: (patch: Partial<AppSettings>) => Promise<AppSettings>
  setProfile: (p: ClinicProfile) => void
  /** Screens with unsaved work register a check; navigation asks before leaving. */
  setLeaveGuard: (fn: (() => boolean) | null) => void
}

const Ctx = createContext<AppContextValue | null>(null)

export function useApp(): AppContextValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useApp outside provider')
  return v
}

export function useT(): TFunction {
  return useApp().t
}

export function AppProvider({
  initialSettings,
  initialProfile,
  children
}: {
  initialSettings: AppSettings
  initialProfile: ClinicProfile
  children: ReactNode
}) {
  const [settings, setSettings] = useState<AppSettings>(initialSettings ?? DEFAULT_SETTINGS)
  const [profile, setProfile] = useState<ClinicProfile>(initialProfile ?? EMPTY_PROFILE)
  const [route, setRoute] = useState<Route>({ name: 'rx', key: Date.now() })
  const guard = useRef<(() => boolean) | null>(null)
  const { setDirection } = useDirection()
  const lang = settings.language
  const t = useMemo(() => makeT(lang), [lang])

  useEffect(() => {
    const dir = lang === 'ar' ? 'rtl' : 'ltr'
    setDirection(dir)
    document.documentElement.dir = dir
    document.documentElement.lang = lang
  }, [lang, setDirection])

  const reload = useCallback(async () => {
    const [s, p] = await Promise.all([api.settings.get(), api.settings.getProfile()])
    setSettings(s)
    setProfile(p)
  }, [])

  const updateSettings = useCallback(async (patch: Partial<AppSettings>) => {
    const s = await api.settings.update(patch)
    setSettings(s)
    return s
  }, [])

  const navigate = useCallback(
    (r: Route) => {
      const go = () => {
        guard.current = null
        setRoute({ ...r, ...(r.name === 'rx' ? { key: Date.now() } : {}) } as Route)
      }
      if (guard.current?.()) {
        modals.openConfirmModal({
          title: t('c.unsavedTitle'),
          children: t('c.unsavedText'),
          labels: { confirm: t('c.leave'), cancel: t('c.stay') },
          confirmProps: { color: 'red' },
          onConfirm: go
        })
      } else go()
    },
    [t]
  )

  const setLeaveGuard = useCallback((fn: (() => boolean) | null) => {
    guard.current = fn
  }, [])

  const value: AppContextValue = {
    settings,
    profile,
    lang,
    t,
    route,
    navigate,
    reload,
    updateSettings,
    setProfile,
    setLeaveGuard
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
