import { uid } from '../store'
import type { Strategy, Trade } from '../types'

export const CSV_COLUMNS = [
  'symbol', 'market', 'direction', 'status', 'entryDate', 'exitDate', 'entryPrice', 'exitPrice',
  'quantity', 'multiplier', 'fees', 'stopLoss', 'takeProfit', 'strategy', 'tags', 'mistakes',
  'emotion', 'rating', 'notes',
] as const

function esc(v: unknown) {
  const s = v == null ? '' : String(v)
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function tradesToCsv(trades: Trade[], strategies: Strategy[]) {
  const sName = new Map(strategies.map((s) => [s.id, s.name]))
  const rows = trades.map((t) =>
    [
      t.symbol, t.market, t.direction, t.status, t.entryDate, t.exitDate, t.entryPrice, t.exitPrice,
      t.quantity, t.multiplier, t.fees, t.stopLoss, t.takeProfit,
      t.strategyId ? sName.get(t.strategyId) : '', t.tags.join('|'), t.mistakes.join('|'),
      t.emotion, t.rating, t.notes,
    ].map(esc).join(','),
  )
  return [CSV_COLUMNS.join(','), ...rows].join('\n')
}

export function parseCsv(text: string): string[][] {
  const firstLine = text.split('\n', 1)[0]
  const delim = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ','
  const rows: string[][] = []
  let row: string[] = [], cell = '', q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') q = false
      else cell += c
    } else if (c === '"') q = true
    else if (c === delim) { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cell); cell = ''
      if (row.some((x) => x !== '')) rows.push(row)
      row = []
    } else cell += c
  }
  row.push(cell)
  if (row.some((x) => x !== '')) rows.push(row)
  return rows
}

const toNum = (s?: string) => {
  if (s == null || s.trim() === '') return undefined
  const n = Number(s.replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : undefined
}

/** Returns trades plus names of strategies that don't exist yet (caller creates them). */
export function csvToTrades(text: string, strategies: Strategy[]): { trades: Trade[]; errors: string[]; newStrategies: Strategy[] } {
  const rows = parseCsv(text)
  if (rows.length < 2) return { trades: [], errors: ['Файл пустой'], newStrategies: [] }
  const header = rows[0].map((h) => h.trim())
  const idx = (k: string) => header.indexOf(k)
  const errors: string[] = []
  const byName = new Map(strategies.map((s) => [s.name.toLowerCase(), s]))
  const newStrategies: Strategy[] = []
  const trades: Trade[] = []

  rows.slice(1).forEach((r, i) => {
    const g = (k: string) => (idx(k) >= 0 ? r[idx(k)]?.trim() : undefined)
    const symbol = g('symbol')
    const entryPrice = toNum(g('entryPrice'))
    const quantity = toNum(g('quantity'))
    const entryDate = g('entryDate')
    if (!symbol || entryPrice == null || quantity == null || !entryDate) {
      errors.push(`Строка ${i + 2}: нужны symbol, entryDate, entryPrice, quantity`)
      return
    }
    let strategyId: string | undefined
    const sn = g('strategy')
    if (sn) {
      let s = byName.get(sn.toLowerCase())
      if (!s) {
        s = { id: uid(), name: sn, description: '', color: '#6c8cff', timeframe: '', market: '', rules: [], archived: false, createdAt: new Date().toISOString() }
        byName.set(sn.toLowerCase(), s)
        newStrategies.push(s)
      }
      strategyId = s.id
    }
    const exitPrice = toNum(g('exitPrice'))
    const exitDate = g('exitDate') || undefined
    const dir = (g('direction') ?? '').toLowerCase()
    const status = g('status')
    const split = (s?: string) => (s ? s.split('|').map((x) => x.trim()).filter(Boolean) : [])
    trades.push({
      id: uid(),
      symbol: symbol.toUpperCase(),
      market: g('market') || 'Акции',
      direction: dir === 'short' || dir === 'sell' || dir === 'шорт' ? 'short' : 'long',
      status: status === 'open' || exitPrice == null || !exitDate ? 'open' : 'closed',
      entryDate: entryDate.replace(' ', 'T').slice(0, 16),
      exitDate: exitDate?.replace(' ', 'T').slice(0, 16),
      entryPrice,
      exitPrice,
      quantity,
      multiplier: toNum(g('multiplier')) ?? 1,
      fees: toNum(g('fees')) ?? 0,
      stopLoss: toNum(g('stopLoss')),
      takeProfit: toNum(g('takeProfit')),
      strategyId,
      checklist: {},
      tags: split(g('tags')),
      mistakes: split(g('mistakes')),
      emotion: g('emotion') || undefined,
      rating: toNum(g('rating')),
      notes: g('notes') ?? '',
      screenshots: [],
      createdAt: new Date().toISOString(),
    })
  })
  return { trades, errors, newStrategies }
}

export function download(filename: string, content: string, type = 'text/plain') {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Downscale an image to keep IndexedDB small. */
export function compressImage(file: File, maxSide = 1600, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = () => {
      const img = new Image()
      img.onerror = reject
      img.onload = () => {
        const k = Math.min(1, maxSide / Math.max(img.width, img.height))
        const c = document.createElement('canvas')
        c.width = Math.round(img.width * k)
        c.height = Math.round(img.height * k)
        c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
        resolve(c.toDataURL('image/jpeg', quality))
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}
