import { useSyncExternalStore } from 'react'

/** Whether a CSS media query currently matches; re-renders when it changes. */
export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', cb)
      return () => mql.removeEventListener('change', cb)
    },
    () => window.matchMedia(query).matches,
  )
}

export const MOBILE = '(max-width: 860px)'
