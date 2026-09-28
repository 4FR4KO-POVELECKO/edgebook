import { useStore } from '../store'
import type { Lang } from '../types'
import { en, type Dict } from './en'
import { ru } from './ru'

export type { Dict }

export const DICTS: Record<Lang, Dict> = { en, ru }

export const LANGS: { value: Lang; label: string; name: string }[] = [
  { value: 'en', label: 'EN', name: 'English' },
  { value: 'ru', label: 'RU', name: 'Русский' },
]

export const getLang = (): Lang => useStore.getState().settings.lang ?? 'en'

/** Dictionary for non-React code (formatters, CSV import). */
export const dict = (): Dict => DICTS[getLang()]

export function useT(): Dict {
  const lang = useStore((s) => s.settings.lang)
  return DICTS[lang] ?? en
}

/** Built-in values (markets, emotions, default mistakes) are stored as keys; user-entered ones as-is. */
export const label = (section: Record<string, string>, key: string) => section[key] ?? key
