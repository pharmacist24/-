import { useEffect, useState } from 'react'
import { Group, SegmentedControl, SimpleGrid, Stack, Table, Text, Title, Tooltip } from '@mantine/core'
import type { ReportSummary } from '@shared/types'
import { formatDate, todayIso } from '@shared/text'
import { api } from '../lib/api'
import { useApp } from '../lib/app-context'
import { notifyError } from '../lib/notify'

const BAR = '#0ca678'

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rx-card">
      <Text c="dimmed" fz="sm">
        {label}
      </Text>
      <Text fz={34} fw={800} lh={1.2} data-stat={label}>
        {value.toLocaleString('en')}
      </Text>
    </div>
  )
}

/** Single-series column chart with hover tooltips (CSS only). */
function Columns({ data, tooltip }: { data: { label: string; short: string; value: number }[]; tooltip: (d: { label: string; value: number }) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div dir="ltr">
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 180, borderBottom: '1px solid #dee2e6' }}>
        {data.map((d) => (
          <Tooltip key={d.label} label={tooltip(d)}>
            <div style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end', cursor: 'default' }}>
              <div style={{ width: '100%', height: `${(d.value / max) * 100}%`, minHeight: d.value ? 3 : 0, background: BAR, borderRadius: '4px 4px 0 0' }} />
            </div>
          </Tooltip>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 2, marginTop: 4 }}>
        {data.map((d, i) => (
          <Text key={d.label} fz={10} c="dimmed" ta="center" style={{ flex: 1, overflow: 'hidden', whiteSpace: 'nowrap' }}>
            {i % Math.ceil(data.length / 10) === 0 ? d.short : ''}
          </Text>
        ))}
      </div>
    </div>
  )
}

export default function ReportsScreen() {
  const { t, lang } = useApp()
  const [r, setR] = useState<ReportSummary | null>(null)
  const [range, setRange] = useState<'day' | 'month'>('day')
  const [measure, setMeasure] = useState<'prescriptions' | 'patients'>('prescriptions')

  useEffect(() => {
    api.reports.summary().then(setR).catch((e) => notifyError(e, t))
  }, [t])

  if (!r) return null

  // Fill in days/months with no prescriptions so the time axis is continuous.
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - 29 + i)
    const iso = todayIso(d)
    const row = r.perDay.find((x) => x.day === iso)
    return { label: formatDate(iso, lang), short: iso.slice(8, 10), value: row ? row[measure] : 0 }
  })
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - 11 + i)
    const key = todayIso(d).slice(0, 7)
    const row = r.perMonth.find((x) => x.month === key)
    return { label: key.slice(5) + '/' + key.slice(0, 4), short: key.slice(5), value: row ? row[measure] : 0 }
  })
  const maxDrug = Math.max(1, ...r.topDrugs.map((d) => d.count))
  const unit = measure === 'prescriptions' ? t('rp.prescriptions') : t('rp.patients')

  return (
    <div className="rx-page-wrap">
      <Title order={2} mb="md">
        {t('rp.title')}
      </Title>
      <SimpleGrid cols={4} mb="lg">
        <Stat label={t('rp.today')} value={r.today} />
        <Stat label={t('rp.month')} value={r.thisMonth} />
        <Stat label={t('rp.totalRx')} value={r.totalPrescriptions} />
        <Stat label={t('rp.totalPatients')} value={r.totalPatients} />
      </SimpleGrid>
      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
        <div className="rx-card">
          <Group justify="space-between" mb="md">
            <Text fw={700}>{range === 'day' ? t('rp.perDay') : t('rp.perMonth')}</Text>
            <Group gap="xs">
              <SegmentedControl
                size="xs"
                value={measure}
                onChange={(v) => setMeasure(v as typeof measure)}
                data={[
                  { value: 'prescriptions', label: t('rp.prescriptions') },
                  { value: 'patients', label: t('rp.patients') }
                ]}
              />
              <SegmentedControl
                size="xs"
                value={range}
                onChange={(v) => setRange(v as typeof range)}
                data={[
                  { value: 'day', label: t('rp.perDay') },
                  { value: 'month', label: t('rp.perMonth') }
                ]}
              />
            </Group>
          </Group>
          {r.totalPrescriptions === 0 ? (
            <Text c="dimmed" ta="center" py="xl">
              {t('rp.noData')}
            </Text>
          ) : (
            <Columns data={range === 'day' ? days : months} tooltip={(d) => `${d.label}: ${d.value} ${unit}`} />
          )}
        </div>
        <div className="rx-card">
          <Text fw={700} mb="md">
            {t('rp.topDrugs')}
          </Text>
          {r.topDrugs.length === 0 ? (
            <Text c="dimmed" ta="center" py="xl">
              {t('rp.noData')}
            </Text>
          ) : (
            <Table verticalSpacing={4} withRowBorders={false}>
              <Table.Tbody>
                {r.topDrugs.map((d, i) => (
                  <Table.Tr key={d.name}>
                    <Table.Td w={28} c="dimmed">
                      {i + 1}
                    </Table.Td>
                    <Table.Td dir="ltr" w="34%" style={{ textAlign: 'start', fontWeight: 600 }}>
                      {d.name}
                    </Table.Td>
                    <Table.Td>
                      <Stack gap={0}>
                        <div style={{ height: 10, width: `${(d.count / maxDrug) * 100}%`, minWidth: 4, background: BAR, borderRadius: 4 }} />
                      </Stack>
                    </Table.Td>
                    <Table.Td w={90} fz="sm">
                      {t('rp.times', { n: d.count })}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </div>
      </SimpleGrid>
    </div>
  )
}
