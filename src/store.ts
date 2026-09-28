import { del, get, set } from 'idb-keyval'
import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import { ru } from './i18n/ru'
import type { DayNote, Settings, Strategy, Trade } from './types'

// IndexedDB instead of localStorage: screenshots easily blow past the 5 MB localStorage limit.
const idbStorage: StateStorage = {
  getItem: async (name) => (await get<string>(name)) ?? null,
  setItem: (name, value) => set(name, value),
  removeItem: (name) => del(name),
}

export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8)

export interface BackupData {
  trades: Trade[]
  strategies: Strategy[]
  dayNotes: Record<string, DayNote>
  settings: Settings
}

interface State extends BackupData {
  addTrade: (t: Omit<Trade, 'id' | 'createdAt'>) => void
  updateTrade: (id: string, patch: Partial<Trade>) => void
  deleteTrade: (id: string) => void
  importTrades: (ts: Trade[]) => void

  addStrategy: (s: Omit<Strategy, 'id' | 'createdAt' | 'archived'>) => void
  updateStrategy: (id: string, patch: Partial<Strategy>) => void
  deleteStrategy: (id: string) => void

  setDayNote: (n: DayNote) => void
  setSettings: (s: Partial<Settings>) => void

  restore: (d: BackupData) => void
  reset: () => void
}

const initial: BackupData = {
  trades: [],
  strategies: [],
  dayNotes: {},
  settings: { lang: 'en', startingBalance: 10000, currency: '$', riskPercent: 1 },
}

// v1 stored built-in markets/emotions/mistakes as Russian labels; v2 stores language-neutral keys.
const reverse = (m: Record<string, string>) => Object.fromEntries(Object.entries(m).map(([k, v]) => [v, k]))
const ruMarket = reverse(ru.markets)
const ruEmotion = reverse(ru.emotions)
const ruMistake = reverse(ru.mistakes)

function migrateLabels(d: BackupData): BackupData {
  return {
    ...d,
    trades: d.trades.map((t) => ({
      ...t,
      market: ruMarket[t.market] ?? t.market,
      emotion: t.emotion ? ruEmotion[t.emotion] ?? t.emotion : t.emotion,
      mistakes: t.mistakes.map((m) => ruMistake[m] ?? m),
    })),
    strategies: d.strategies.map((s) => ({ ...s, market: ruMarket[s.market] ?? s.market })),
  }
}

function normalize(d: BackupData): BackupData {
  return migrateLabels({ ...initial, ...d, settings: { ...initial.settings, ...d.settings } })
}

export const useStore = create<State>()(
  persist(
    (setState) => ({
      ...initial,

      addTrade: (t) =>
        setState((s) => ({
          trades: [...s.trades, { ...t, id: uid(), createdAt: new Date().toISOString() }],
        })),
      updateTrade: (id, patch) =>
        setState((s) => ({ trades: s.trades.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
      deleteTrade: (id) => setState((s) => ({ trades: s.trades.filter((t) => t.id !== id) })),
      importTrades: (ts) => setState((s) => ({ trades: [...s.trades, ...ts] })),

      addStrategy: (st) =>
        setState((s) => ({
          strategies: [
            ...s.strategies,
            { ...st, id: uid(), archived: false, createdAt: new Date().toISOString() },
          ],
        })),
      updateStrategy: (id, patch) =>
        setState((s) => ({
          strategies: s.strategies.map((x) => (x.id === id ? { ...x, ...patch } : x)),
        })),
      deleteStrategy: (id) =>
        setState((s) => ({
          strategies: s.strategies.filter((x) => x.id !== id),
          trades: s.trades.map((t) => (t.strategyId === id ? { ...t, strategyId: undefined } : t)),
        })),

      setDayNote: (n) => setState((s) => ({ dayNotes: { ...s.dayNotes, [n.date]: n } })),
      setSettings: (patch) => setState((s) => ({ settings: { ...s.settings, ...patch } })),

      restore: (d) => setState(normalize(d)),
      reset: () => setState((s) => ({ ...initial, settings: { ...initial.settings, lang: s.settings.lang } })),
    }),
    {
      name: 'trader-journal',
      version: 2,
      storage: createJSONStorage(() => idbStorage),
      migrate: (persisted) => normalize(persisted as BackupData),
      // settings are merged key-by-key so newly added fields get their defaults
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<BackupData>
        return { ...current, ...p, settings: { ...current.settings, ...p.settings } }
      },
    },
  ),
)
