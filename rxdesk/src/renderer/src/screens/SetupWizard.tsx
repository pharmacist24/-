import { useState } from 'react'
import {
  Button,
  Center,
  Checkbox,
  Group,
  Modal,
  NumberInput,
  Paper,
  PasswordInput,
  Radio,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Stepper,
  Text,
  Title
} from '@mantine/core'
import type { ClinicProfile } from '@shared/types'
import type { PaperPreset } from '@shared/layout/types'
import { PAPER_SIZES } from '@shared/layout/types'
import { api } from '../lib/api'
import { useApp } from '../lib/app-context'
import { notifyError, notifyOk } from '../lib/notify'
import ProfileForm from '../components/ProfileForm'
import { SyncSignInForm } from '../components/SyncPanel'

export default function SetupWizard() {
  const { t, lang, settings, profile: initialProfile, reload, updateSettings } = useApp()
  const [step, setStep] = useState(0)
  const [cloudOpen, setCloudOpen] = useState(false)
  const [profile, setProfile] = useState<ClinicProfile>(initialProfile)
  const [paper, setPaper] = useState<{ preset: PaperPreset; widthMm: number; heightMm: number }>({ preset: 'A5', ...PAPER_SIZES.A5 })
  const [usePin, setUsePin] = useState(false)
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [samples, setSamples] = useState(true)
  const [busy, setBusy] = useState(false)

  const pinError = usePin && pin && !/^\d{4,8}$/.test(pin) ? t('err.PIN_FORMAT') : undefined
  const pin2Error = usePin && pin2 && pin !== pin2 ? t('pin.mismatch') : undefined
  const doctorOk = !!(profile.doctorNameAr.trim() || profile.doctorNameEn.trim())
  const pinOk = !usePin || (/^\d{4,8}$/.test(pin) && pin === pin2)

  const finish = async () => {
    setBusy(true)
    try {
      await api.settings.completeSetup({
        profile,
        language: lang,
        paper,
        pin: usePin ? pin : '',
        samplePatients: samples
      })
      await reload()
      notifyOk(t('setup.done'))
    } catch (e) {
      notifyError(e, t)
    } finally {
      setBusy(false)
    }
  }

  const nextDisabled = (step === 1 && !doctorOk) || (step === 4 && !pinOk)

  return (
    <Center mih="100vh" p="lg" style={{ background: 'linear-gradient(160deg,#e6f4f1,#f4f6f9)' }}>
      <Paper p={36} radius="lg" shadow="md" w={860} maw="100%">
        <Stepper active={step} onStepClick={(s) => s < step && setStep(s)} mb="xl" size="sm">
          <Stepper.Step label={t('setup.stepWelcome')} />
          <Stepper.Step label={t('setup.stepDoctor')} />
          <Stepper.Step label={t('setup.stepClinic')} />
          <Stepper.Step label={t('setup.stepPaper')} />
          <Stepper.Step label={t('setup.stepSecurity')} />
        </Stepper>

        <div style={{ minHeight: 330 }}>
          {step === 0 && (
            <Stack align="center" gap="lg" py="lg">
              <Text fz={56} lh={1} c="teal.7" dir="ltr">℞</Text>
              <Title order={1}>{t('setup.welcome')}</Title>
              <Text c="dimmed" ta="center" maw={560} fz="lg">
                {t('setup.welcomeText')}
              </Text>
              <div>
                <Text ta="center" fw={600} mb={6}>
                  {t('setup.language')} / Language
                </Text>
                <SegmentedControl
                  size="lg"
                  value={settings.language}
                  onChange={(v) => updateSettings({ language: v as 'ar' | 'en', printLanguage: v as 'ar' | 'en' })}
                  data={[
                    { value: 'ar', label: 'العربية' },
                    { value: 'en', label: 'English' }
                  ]}
                  id="setup-language"
                />
              </div>
              <Button variant="subtle" onClick={() => setCloudOpen(true)} id="setup-cloud">
                {t('sync.wizard')}
              </Button>
              <Modal opened={cloudOpen} onClose={() => setCloudOpen(false)} title={t('sync.tab')} centered>
                <SyncSignInForm onDone={() => setCloudOpen(false)} />
              </Modal>
            </Stack>
          )}
          {step === 1 && <ProfileForm value={profile} onChange={setProfile} section="doctor" />}
          {step === 2 && <ProfileForm value={profile} onChange={setProfile} section="clinic" />}
          {step === 3 && (
            <Stack>
              <Text c="dimmed">{t('setup.paperHint')}</Text>
              <Radio.Group
                value={paper.preset}
                onChange={(v) => {
                  const preset = v as PaperPreset
                  setPaper(preset === 'custom' ? { ...paper, preset } : { preset, ...PAPER_SIZES[preset] })
                }}
              >
                <SimpleGrid cols={2} spacing="md">
                  {(['A5', 'A4', 'Letter', 'custom'] as PaperPreset[]).map((p) => (
                    <Paper key={p} withBorder p="md" radius="md" style={{ cursor: 'pointer' }} onClick={() => setPaper(p === 'custom' ? { ...paper, preset: p } : { preset: p, ...PAPER_SIZES[p] })}>
                      <Radio value={p} label={t(`paper.${p}` as 'paper.A4')} />
                    </Paper>
                  ))}
                </SimpleGrid>
              </Radio.Group>
              {paper.preset === 'custom' && (
                <Group grow>
                  <NumberInput label={t('paper.width')} min={50} max={500} value={paper.widthMm} onChange={(v) => setPaper({ ...paper, widthMm: Number(v) || 148 })} />
                  <NumberInput label={t('paper.height')} min={50} max={1000} value={paper.heightMm} onChange={(v) => setPaper({ ...paper, heightMm: Number(v) || 210 })} />
                </Group>
              )}
            </Stack>
          )}
          {step === 4 && (
            <Stack>
              <Text c="dimmed">{t('setup.securityHint')}</Text>
              <Checkbox label={t('pin.enable')} checked={usePin} onChange={(e) => setUsePin(e.currentTarget.checked)} />
              {usePin && (
                <Group grow align="flex-start">
                  <PasswordInput label={t('pin.new')} value={pin} inputMode="numeric" onChange={(e) => setPin(e.currentTarget.value.replace(/\D/g, '').slice(0, 8))} error={pinError} />
                  <PasswordInput label={t('pin.confirm')} value={pin2} inputMode="numeric" onChange={(e) => setPin2(e.currentTarget.value.replace(/\D/g, '').slice(0, 8))} error={pin2Error} />
                </Group>
              )}
              <Checkbox mt="lg" label={t('setup.samplePatients')} checked={samples} onChange={(e) => setSamples(e.currentTarget.checked)} />
            </Stack>
          )}
        </div>

        <Group justify="space-between" mt="xl">
          <Button variant="default" onClick={() => setStep(step - 1)} disabled={step === 0}>
            {t('c.back')}
          </Button>
          {step < 4 ? (
            <Button onClick={() => setStep(step + 1)} disabled={nextDisabled} id="setup-next">
              {t('c.next')}
            </Button>
          ) : (
            <Button onClick={finish} loading={busy} disabled={nextDisabled} color="teal" id="setup-finish">
              {t('setup.finish')}
            </Button>
          )}
        </Group>
      </Paper>
    </Center>
  )
}
