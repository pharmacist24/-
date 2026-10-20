import { Text, UnstyledButton } from '@mantine/core'
import {
  IconAbc,
  IconBuildingHospital,
  IconCalendar,
  IconHash,
  IconId,
  IconLine,
  IconMapPin,
  IconPhone,
  IconPhoto,
  IconPill,
  IconQrcode,
  IconRectangle,
  IconSignature,
  IconStethoscope,
  IconTextCaption,
  IconUser,
  type Icon
} from '@tabler/icons-react'
import type { ElementType } from '@shared/layout/types'
import type { StringKey } from '../i18n'
import { useT } from '../lib/app-context'
import classes from './designer.module.css'

export const PALETTE: { group: StringKey; items: [ElementType, Icon][] }[] = [
  {
    group: 'd.group.doctor',
    items: [
      ['doctorNameAr', IconStethoscope],
      ['doctorNameEn', IconStethoscope],
      ['specialtyAr', IconId],
      ['specialtyEn', IconId],
      ['clinicName', IconBuildingHospital],
      ['clinicAddress', IconMapPin],
      ['clinicPhone', IconPhone],
      ['licenseNumber', IconHash],
      ['logo', IconPhoto]
    ]
  },
  {
    group: 'd.group.patient',
    items: [
      ['patientName', IconUser],
      ['patientAge', IconUser],
      ['patientGender', IconUser],
      ['patientWeight', IconUser]
    ]
  },
  {
    group: 'd.group.rx',
    items: [
      ['date', IconCalendar],
      ['diagnosis', IconTextCaption],
      ['medicines', IconPill],
      ['notes', IconTextCaption],
      ['labTests', IconTextCaption],
      ['nextVisit', IconCalendar],
      ['signature', IconSignature],
      ['prescriptionId', IconHash],
      ['qr', IconQrcode],
      ['pageNumber', IconHash]
    ]
  },
  {
    group: 'd.group.shapes',
    items: [
      ['text', IconAbc],
      ['line', IconLine],
      ['rect', IconRectangle]
    ]
  }
]

/** Element buttons: click to add in the middle of the page, or drag onto the page. */
export default function Palette({ onAdd }: { onAdd: (type: ElementType) => void }) {
  const t = useT()
  return (
    <div className={classes.palette}>
      <Text fw={700} fz="sm" mb={6}>
        {t('d.addElement')}
      </Text>
      {PALETTE.map((g) => (
        <div key={g.group} style={{ marginBottom: 10 }}>
          <Text fz="xs" c="dimmed" fw={600} mb={4}>
            {t(g.group)}
          </Text>
          {g.items.map(([type, Ico]) => (
            <UnstyledButton
              key={type}
              className={classes.paletteItem}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('application/x-rxdesk-element', type)
                e.dataTransfer.effectAllowed = 'copy'
              }}
              onClick={() => onAdd(type)}
              data-add={type}
            >
              <Ico size={16} stroke={1.6} />
              {t(`el.${type}` as StringKey)}
            </UnstyledButton>
          ))}
        </div>
      ))}
    </div>
  )
}
