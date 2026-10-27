import { useState } from 'react'
import { Alert, Badge, Button, Group, PasswordInput, Stack, Table, Text, TextInput } from '@mantine/core'
import { modals } from '@mantine/modals'
import { IconCloud, IconCloudOff, IconCloudUpload, IconLogout, IconRefresh, IconShieldLock } from '@tabler/icons-react'
import type { SyncStatus } from '@shared/types'
import { api } from '../lib/api'
import { useApp } from '../lib/app-context'
import { notifyError, notifyOk } from '../lib/notify'
import { syncState, useSyncStatus, type SyncState } from '../lib/sync'
import type { StringKey } from '../i18n'

const STATE_TEXT: Record<SyncState, StringKey> = {
  off: 'sync.stOff',
  syncing: 'sync.stSyncing',
  offline: 'sync.stOffline',
  expired: 'sync.stExpired',
  error: 'sync.stError',
  ok: 'sync.stOk'
}
const STATE_COLOR: Record<SyncState, string> = { off: 'gray', syncing: 'blue', offline: 'orange', expired: 'red', error: 'orange', ok: 'teal' }

export function SyncIcon({ state, size = 20 }: { state: SyncState; size?: number }) {
  if (state === 'off') return <IconCloudOff size={size} stroke={1.7} />
  if (state === 'syncing') return <IconCloudUpload size={size} stroke={1.7} />
  return <IconCloud size={size} stroke={1.7} />
}

export function syncStateText(s: SyncStatus): StringKey {
  return STATE_TEXT[syncState(s)]
}

export function syncStateColor(s: SyncStatus): string {
  return STATE_COLOR[syncState(s)]
}

/** E-mail + password form. Used in Settings and in the setup wizard. */
export function SyncSignInForm({ onDone }: { onDone?: (s: SyncStatus) => void }) {
  const { t, reload } = useApp()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    setBusy(true)
    try {
      const s = await api.sync.signIn(email, password)
      setPassword('')
      notifyOk(t('sync.signedIn'))
      await reload()
      onDone?.(s)
    } catch (e) {
      notifyError(e, t)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Stack maw={420} gap="sm">
      <Text fz="sm" c="dimmed">
        {t('sync.askAdmin')}
      </Text>
      <TextInput label={t('sync.email')} value={email} onChange={(e) => setEmail(e.currentTarget.value)} dir="ltr" id="sync-email" autoComplete="username" />
      <PasswordInput
        label={t('sync.password')}
        value={password}
        onChange={(e) => setPassword(e.currentTarget.value)}
        dir="ltr"
        id="sync-password"
        onKeyDown={(e) => e.key === 'Enter' && email && password && submit()}
      />
      <Group>
        <Button onClick={submit} loading={busy} disabled={!email.trim() || !password} leftSection={<IconCloud size={18} />} id="sync-signin">
          {t('sync.signIn')}
        </Button>
      </Group>
    </Stack>
  )
}

function fmtTime(iso: string, lang: 'ar' | 'en'): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' })
}

/** Settings → Online sync. */
export default function SyncTab() {
  const { t, lang } = useApp()
  const [s, setS] = useSyncStatus()
  const [busy, setBusy] = useState(false)
  const st = syncState(s)

  const syncNow = async () => {
    setBusy(true)
    try {
      setS(await api.sync.now())
    } catch (e) {
      notifyError(e, t)
    } finally {
      setBusy(false)
    }
  }

  const signOut = () =>
    modals.openConfirmModal({
      title: t('sync.signOut'),
      children: <Text>{t('sync.signOutConfirm')}</Text>,
      labels: { confirm: t('c.confirm'), cancel: t('c.cancel') },
      confirmProps: { color: 'red', id: 'sync-signout-confirm' },
      onConfirm: async () => setS(await api.sync.signOut())
    })

  return (
    <Stack>
      <Text>{t('sync.intro')}</Text>
      <Alert color="gray" variant="light" icon={<IconShieldLock />}>
        {t('sync.privacy')}
      </Alert>
      {!s.signedIn ? (
        <SyncSignInForm onDone={setS} />
      ) : (
        <Stack gap="sm">
          <Group>
            <Badge size="lg" color={STATE_COLOR[st]} variant="light" leftSection={<SyncIcon state={st} size={16} />} id="sync-state" data-state={st}>
              {t(STATE_TEXT[st])}
            </Badge>
          </Group>
          {st === 'error' && (
            <Text fz="xs" c="dimmed" dir="ltr">
              {s.lastError}
            </Text>
          )}
          <Table withRowBorders={false} maw={560}>
            <Table.Tbody>
              <Table.Tr>
                <Table.Td c="dimmed">{t('sync.clinic')}</Table.Td>
                <Table.Td fw={600}>{s.clinicName}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td c="dimmed">{t('sync.account')}</Table.Td>
                <Table.Td dir="ltr" style={{ textAlign: 'start' }}>
                  {s.email}
                </Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td c="dimmed">{t('sync.lastSync')}</Table.Td>
                <Table.Td id="sync-last">{s.lastSyncAt ? fmtTime(s.lastSyncAt, lang) : t('sync.never')}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td c="dimmed">{t('sync.pending')}</Table.Td>
                <Table.Td id="sync-pending">{s.pending}</Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>
          {st === 'expired' ? (
            <SyncSignInForm onDone={setS} />
          ) : (
            <Group>
              <Button leftSection={<IconRefresh size={18} />} onClick={syncNow} loading={busy || s.syncing} id="sync-now">
                {t('sync.now')}
              </Button>
              <Button variant="subtle" color="red" leftSection={<IconLogout size={18} />} onClick={signOut} id="sync-signout">
                {t('sync.signOut')}
              </Button>
            </Group>
          )}
        </Stack>
      )}
    </Stack>
  )
}
