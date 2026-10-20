import { useMemo, useState } from 'react'
import { Button, Center, Paper, PasswordInput, Stack, Text, Title } from '@mantine/core'
import { IconLock } from '@tabler/icons-react'
import { api, ApiError } from '../lib/api'
import { makeT } from '../i18n'

export default function LockScreen({ lang, onUnlocked }: { lang: 'ar' | 'en'; onUnlocked: () => void }) {
  const t = useMemo(() => makeT(lang), [lang])
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!pin) return
    setBusy(true)
    setError('')
    try {
      const ok = await api.auth.unlock(pin)
      if (ok) onUnlocked()
      else {
        setError(t('lock.wrong'))
        setPin('')
      }
    } catch (e) {
      if (e instanceof ApiError && e.code === 'PIN_WAIT') setError(t('err.PIN_WAIT', { s: e.message }))
      else setError(t('err.UNKNOWN'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Center h="100vh" dir={lang === 'ar' ? 'rtl' : 'ltr'} style={{ background: 'linear-gradient(160deg,#e6f4f1,#f4f6f9)' }}>
      <Paper p={40} radius="lg" shadow="md" w={400}>
        <Stack align="center" gap="md">
          <IconLock size={48} color="#0c8599" />
          <Title order={2}>{t('lock.title')}</Title>
          <Text c="dimmed">{t('lock.enterPin')}</Text>
          <PasswordInput
            data-autofocus
            autoFocus
            w="100%"
            size="lg"
            value={pin}
            inputMode="numeric"
            onChange={(e) => setPin(e.currentTarget.value.replace(/\D/g, '').slice(0, 8))}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            error={error || undefined}
            styles={{ input: { textAlign: 'center', letterSpacing: 8, fontSize: 24 } }}
            id="pin-input"
          />
          <Button fullWidth size="lg" loading={busy} onClick={submit} id="unlock-btn">
            {t('lock.unlock')}
          </Button>
        </Stack>
      </Paper>
    </Center>
  )
}
