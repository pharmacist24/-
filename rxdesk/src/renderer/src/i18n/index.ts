import { ar } from './ar'
import { en, type StringKey } from './en'

export type { StringKey }
export type TFunction = (key: StringKey, vars?: Record<string, string | number>) => string

const dictionaries = { ar, en }

export function makeT(lang: 'ar' | 'en'): TFunction {
  const dict = dictionaries[lang]
  return (key, vars) => {
    let s: string = dict[key] ?? en[key] ?? key
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v))
    return s
  }
}
