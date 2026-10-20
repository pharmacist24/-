import { Button, Group, Image, SimpleGrid, Stack, Text, TextInput } from '@mantine/core'
import { IconPhoto, IconTrash } from '@tabler/icons-react'
import type { ClinicProfile } from '@shared/types'
import { useT } from '../lib/app-context'
import { imageFileToDataUrl, pickFile } from '../lib/images'
import { notifyError } from '../lib/notify'

type Section = 'doctor' | 'clinic' | 'all'

/** Doctor & clinic details, used by the setup wizard and the settings screen. */
export default function ProfileForm({
  value,
  onChange,
  section = 'all'
}: {
  value: ClinicProfile
  onChange: (p: ClinicProfile) => void
  section?: Section
}) {
  const t = useT()
  const set = (k: keyof ClinicProfile) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...value, [k]: e.currentTarget.value })

  const uploadLogo = async () => {
    const f = await pickFile('image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/bmp')
    if (!f) return
    try {
      onChange({ ...value, logo: await imageFileToDataUrl(f, 600, { keepPng: true }) })
    } catch (e) {
      notifyError(e, t)
    }
  }

  return (
    <Stack gap="md">
      {(section === 'doctor' || section === 'all') && (
        <SimpleGrid cols={2} spacing="md">
          <TextInput label={t('p.doctorNameAr')} value={value.doctorNameAr} onChange={set('doctorNameAr')} dir="rtl" data-autofocus />
          <TextInput label={t('p.doctorNameEn')} value={value.doctorNameEn} onChange={set('doctorNameEn')} dir="ltr" />
          <TextInput label={t('p.specialtyAr')} value={value.specialtyAr} onChange={set('specialtyAr')} dir="rtl" />
          <TextInput label={t('p.specialtyEn')} value={value.specialtyEn} onChange={set('specialtyEn')} dir="ltr" />
          <TextInput label={t('p.licenseNumber')} value={value.licenseNumber} onChange={set('licenseNumber')} />
        </SimpleGrid>
      )}
      {(section === 'clinic' || section === 'all') && (
        <>
          <SimpleGrid cols={2} spacing="md">
            <TextInput label={t('p.clinicName')} value={value.clinicName} onChange={set('clinicName')} />
            <TextInput label={t('p.phones')} description={t('p.phonesHint')} value={value.phones} onChange={set('phones')} dir="ltr" />
          </SimpleGrid>
          <TextInput label={t('p.address')} value={value.address} onChange={set('address')} />
          <div>
            <Text fw={500} mb={6}>
              {t('p.logo')} <Text span c="dimmed" fz="sm">({t('c.optional')})</Text>
            </Text>
            <Group>
              {value.logo ? (
                <Image src={value.logo} h={90} w={90} fit="contain" radius="md" style={{ border: '1px solid #dee2e6', background: '#fff' }} />
              ) : null}
              <Button variant="light" leftSection={<IconPhoto size={18} />} onClick={uploadLogo}>
                {t('p.uploadLogo')}
              </Button>
              {value.logo && (
                <Button variant="subtle" color="red" leftSection={<IconTrash size={18} />} onClick={() => onChange({ ...value, logo: '' })}>
                  {t('p.removeLogo')}
                </Button>
              )}
            </Group>
          </div>
        </>
      )}
    </Stack>
  )
}
