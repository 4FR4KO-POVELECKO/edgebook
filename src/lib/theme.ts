import { useMemo, useSyncExternalStore } from 'react'
import { useStore } from '../store'

export type ResolvedTheme = 'light' | 'dark'

const mql = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: light)') : undefined

function resolve(): ResolvedTheme {
  const mode = useStore.getState().settings.theme ?? 'system'
  if (mode === 'system') return mql?.matches ? 'light' : 'dark'
  return mode
}

const listeners = new Set<() => void>()

/** Sets data-theme on <html>. Runs synchronously on changes, before React re-renders,
 * so components reading CSS variables during render see the new theme. */
function apply() {
  const next = resolve()
  const root = document.documentElement
  if (root.dataset.theme !== next) {
    root.dataset.theme = next
    root.style.colorScheme = next
    listeners.forEach((l) => l())
  }
}

let started = false
export function startThemeSync() {
  if (started) return
  started = true
  apply()
  useStore.subscribe((s, prev) => { if (s.settings.theme !== prev.settings.theme) apply() })
  mql?.addEventListener('change', apply)
}

export function useResolvedTheme(): ResolvedTheme {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb) },
    () => (document.documentElement.dataset.theme as ResolvedTheme) ?? 'dark',
  )
}

/** Current values of CSS color tokens, for SVG attributes that can't use var(). */
export function useCssColors<K extends string>(names: readonly K[]): Record<K, string> {
  const theme = useResolvedTheme()
  const key = names.join()
  return useMemo(() => {
    const cs = getComputedStyle(document.documentElement)
    return Object.fromEntries(key.split(',').map((n) => [n, cs.getPropertyValue(`--${n}`).trim()])) as Record<K, string>
  }, [theme, key])
}
