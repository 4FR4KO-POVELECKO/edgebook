export type Direction = 'long' | 'short'
export type TradeStatus = 'open' | 'closed'

export interface Trade {
  id: string
  symbol: string
  market: string
  direction: Direction
  status: TradeStatus
  /** local datetime, 'YYYY-MM-DDTHH:mm' */
  entryDate: string
  exitDate?: string
  entryPrice: number
  exitPrice?: number
  quantity: number
  /** contract multiplier (futures/options), 1 for spot */
  multiplier: number
  fees: number
  stopLoss?: number
  takeProfit?: number
  strategyId?: string
  /** strategy rule text -> followed */
  checklist: Record<string, boolean>
  tags: string[]
  mistakes: string[]
  emotion?: string
  /** execution quality 1..5 */
  rating?: number
  notes: string
  /** compressed data URLs */
  screenshots: string[]
  createdAt: string
}

export interface Strategy {
  id: string
  name: string
  description: string
  color: string
  timeframe: string
  market: string
  rules: string[]
  archived: boolean
  createdAt: string
}

export interface DayNote {
  /** 'YYYY-MM-DD' */
  date: string
  plan: string
  review: string
  /** 1..5 */
  mood?: number
}

export type Lang = 'en' | 'ru'
export type ThemeMode = 'system' | 'light' | 'dark'

export interface Settings {
  lang: Lang
  theme: ThemeMode
  startingBalance: number
  currency: string
  /** default risk per trade in % of balance, for the position size calculator */
  riskPercent: number
}

// Built-in values are stored as language-neutral keys and translated on display (see i18n).
export const MARKETS = ['stocks', 'crypto', 'futures', 'forex', 'options', 'other']

export const EMOTIONS = ['calm', 'confident', 'fear', 'greed', 'fomo', 'excitement', 'frustration', 'tired', 'revenge']

export const DEFAULT_MISTAKES = [
  'no_setup', 'no_stop', 'moved_stop', 'early_exit', 'late_entry', 'oversized', 'averaging_down', 'against_trend', 'overtrading',
]

export const STRATEGY_COLORS = [
  '#6c8cff',
  '#22c3a6',
  '#f5a524',
  '#e5484d',
  '#a78bfa',
  '#38bdf8',
  '#f472b6',
  '#84cc16',
]
