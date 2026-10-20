import { notifications } from '@mantine/notifications'
import type { TFunction, StringKey } from '../i18n'
import { ApiError } from './api'

export function notifyOk(message: string): void {
  notifications.show({ message, color: 'teal', autoClose: 2500 })
}

export function notifyWarn(message: string): void {
  notifications.show({ message, color: 'orange', autoClose: 6000 })
}

/** Shows a friendly, translated error and records the technical details in the log file. */
export function notifyError(e: unknown, t: TFunction): void {
  let message = t('err.UNKNOWN')
  if (e instanceof ApiError) {
    const key = `err.${e.code}` as StringKey
    if (e.code === 'PIN_WAIT') message = t('err.PIN_WAIT', { s: e.message })
    else if (e.code === 'VALIDATION' || e.code === 'BAD_BACKUP') message = translateValidation(e.message, t) ?? t(key)
    else message = t(key) !== key ? t(key) : t('err.UNKNOWN')
  } else {
    window.rxdesk?.invoke('app.logError', [String((e as Error)?.stack ?? e)]).catch(() => undefined)
  }
  notifications.show({ title: t('c.error'), message, color: 'red', autoClose: 7000 })
}

function translateValidation(msg: string, t: TFunction): string | null {
  const map: Record<string, StringKey> = {
    'Please select a patient': 'rx.noPatient',
    'Patient name is required': 'c.required'
  }
  const key = map[msg]
  if (!key) return null
  return key === 'c.required' ? `${t('pt.name')}: ${t('c.required')}` : t(key)
}
