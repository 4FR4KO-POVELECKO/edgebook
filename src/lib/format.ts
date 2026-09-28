import { useStore } from '../store'

const nf = (digits: number) =>
  new Intl.NumberFormat('ru-RU', { minimumFractionDigits: digits, maximumFractionDigits: digits })

const n0 = nf(0)
const n2 = nf(2)

export function money(v: number, currency: string, opts: { sign?: boolean; compact?: boolean } = {}) {
  const abs = Math.abs(v)
  const body = opts.compact && abs >= 10000 ? compact(abs) : (abs >= 1000 ? n0 : n2).format(abs)
  const sign = v < 0 ? '−' : opts.sign && v > 0 ? '+' : ''
  return `${sign}${currency}${body}`
}

function compact(v: number) {
  if (v >= 1e6) return (v / 1e6).toFixed(1).replace('.', ',') + 'M'
  return (v / 1e3).toFixed(1).replace('.', ',') + 'K'
}

/** Money formatter bound to the user's currency. */
export function useMoney() {
  const currency = useStore((s) => s.settings.currency)
  return (v: number, opts?: { sign?: boolean; compact?: boolean }) => money(v, currency, opts)
}

export const num = (v: number, digits = 2) => (Number.isFinite(v) ? nf(digits).format(v) : '∞')

export const pct = (v: number, digits = 1) => `${num(v, digits)}%`

export const price = (v?: number) =>
  v == null ? '—' : new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 8 }).format(v)

export const rFmt = (r?: number) => (r == null ? '—' : `${r > 0 ? '+' : r < 0 ? '−' : ''}${num(Math.abs(r), 2)}R`)

export function duration(min?: number) {
  if (min == null) return '—'
  if (min < 60) return `${Math.round(min)} мин`
  if (min < 60 * 24) return `${num(min / 60, 1)} ч`
  return `${num(min / 60 / 24, 1)} д`
}

export const pnlClass = (v: number) => (v > 0 ? 'pos' : v < 0 ? 'neg' : 'muted')

export function fmtDateTime(s?: string) {
  if (!s) return '—'
  const d = new Date(s)
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

/** 'YYYY-MM-DD' in local time */
export function ymd(d: Date) {
  const p = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** 'YYYY-MM-DDTHH:mm' in local time, for datetime-local inputs */
export function localDateTime(d = new Date()) {
  const p = (x: number) => String(x).padStart(2, '0')
  return `${ymd(d)}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export { n0, n2 }
