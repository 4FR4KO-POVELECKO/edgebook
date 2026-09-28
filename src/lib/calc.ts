import type { Trade } from '../types'
import { ymd } from './format'

export const isClosed = (t: Trade) =>
  t.status === 'closed' && t.exitPrice != null && t.exitDate != null

export function grossPnl(t: Trade): number {
  if (!isClosed(t)) return 0
  const sign = t.direction === 'long' ? 1 : -1
  return sign * (t.exitPrice! - t.entryPrice) * t.quantity * (t.multiplier || 1)
}

export const netPnl = (t: Trade) => (isClosed(t) ? grossPnl(t) - (t.fees || 0) : 0)

/** Money at risk from entry to stop. */
export function riskAmount(t: Trade): number | undefined {
  if (t.stopLoss == null || !t.stopLoss) return undefined
  const r = Math.abs(t.entryPrice - t.stopLoss) * t.quantity * (t.multiplier || 1)
  return r > 0 ? r : undefined
}

export function rMultiple(t: Trade): number | undefined {
  const risk = riskAmount(t)
  if (!risk || !isClosed(t)) return undefined
  return netPnl(t) / risk
}

/** Planned reward:risk based on take profit and stop. */
export function plannedRR(t: Trade): number | undefined {
  if (!t.stopLoss || !t.takeProfit) return undefined
  const risk = Math.abs(t.entryPrice - t.stopLoss)
  return risk > 0 ? Math.abs(t.takeProfit - t.entryPrice) / risk : undefined
}

/** Position value at entry. */
export const notional = (t: Trade) => t.entryPrice * t.quantity * (t.multiplier || 1)

export const leverageOf = (t: Trade) => (t.leverage && t.leverage > 1 ? t.leverage : 1)

/** Return on the position's notional value (unaffected by leverage). */
export function returnPct(t: Trade): number {
  const n = notional(t)
  return n ? (netPnl(t) / n) * 100 : 0
}

/** Own capital the position ties up. */
export const marginUsed = (t: Trade) => notional(t) / leverageOf(t)

/** Return on margin (ROE): the return on your own money, amplified by leverage. */
export function roePct(t: Trade): number {
  const m = marginUsed(t)
  return m ? (netPnl(t) / m) * 100 : 0
}

/** Approximate liquidation price for isolated margin, ignoring maintenance margin and fees
 * (exchanges liquidate somewhat earlier). Undefined without leverage. */
export function liquidationPrice(t: Trade): number | undefined {
  const lev = leverageOf(t)
  if (lev <= 1 || !t.entryPrice) return undefined
  return t.direction === 'long' ? t.entryPrice * (1 - 1 / lev) : t.entryPrice * (1 + 1 / lev)
}

/** True when the stop sits at or beyond the liquidation price, so liquidation would hit first. */
export function stopBeyondLiquidation(t: Trade): boolean {
  const liq = liquidationPrice(t)
  if (liq == null || !t.stopLoss) return false
  return t.direction === 'long' ? t.stopLoss <= liq : t.stopLoss >= liq
}

export function holdMinutes(t: Trade): number | undefined {
  if (!t.exitDate) return undefined
  return (new Date(t.exitDate).getTime() - new Date(t.entryDate).getTime()) / 60000
}

/** Day a trade is attributed to (its exit date: that's when P&L is realised). */
export const tradeDay = (t: Trade) => (t.exitDate ?? t.entryDate).slice(0, 10)

export const sortByExit = (ts: Trade[]) =>
  [...ts].sort((a, b) => (a.exitDate ?? a.entryDate).localeCompare(b.exitDate ?? b.entryDate))

export interface Stats {
  count: number
  wins: number
  losses: number
  breakeven: number
  winRate: number
  net: number
  grossProfit: number
  grossLoss: number
  fees: number
  avgWin: number
  avgLoss: number
  payoff: number
  profitFactor: number
  expectancy: number
  largestWin: number
  largestLoss: number
  maxWinStreak: number
  maxLossStreak: number
  maxDrawdown: number
  maxDrawdownPct: number
  avgR?: number
  totalR?: number
  avgHoldMin?: number
  tradingDays: number
  greenDays: number
}

export function computeStats(trades: Trade[], startingBalance = 0): Stats {
  const closed = sortByExit(trades.filter(isClosed))
  const pnls = closed.map(netPnl)
  const winsArr = pnls.filter((p) => p > 0)
  const lossArr = pnls.filter((p) => p < 0)
  const grossProfit = sum(winsArr)
  const grossLoss = Math.abs(sum(lossArr))
  const net = sum(pnls)

  let ws = 0, ls = 0, maxWs = 0, maxLs = 0
  for (const p of pnls) {
    if (p > 0) { ws++; ls = 0 } else if (p < 0) { ls++; ws = 0 } else { ws = 0; ls = 0 }
    maxWs = Math.max(maxWs, ws)
    maxLs = Math.max(maxLs, ls)
  }

  let equity = startingBalance, peak = startingBalance, maxDd = 0, maxDdPct = 0
  for (const p of pnls) {
    equity += p
    peak = Math.max(peak, equity)
    const dd = peak - equity
    if (dd > maxDd) maxDd = dd
    if (peak > 0) maxDdPct = Math.max(maxDdPct, (dd / peak) * 100)
  }

  const rs = closed.map(rMultiple).filter((r): r is number => r != null)
  const holds = closed.map(holdMinutes).filter((h): h is number => h != null && h >= 0)
  const byDay = groupSum(closed, tradeDay)
  const avgWin = winsArr.length ? grossProfit / winsArr.length : 0
  const avgLoss = lossArr.length ? grossLoss / lossArr.length : 0
  const decisive = winsArr.length + lossArr.length

  return {
    count: closed.length,
    wins: winsArr.length,
    losses: lossArr.length,
    breakeven: closed.length - decisive,
    winRate: decisive ? (winsArr.length / decisive) * 100 : 0,
    net,
    grossProfit,
    grossLoss,
    fees: sum(closed.map((t) => t.fees || 0)),
    avgWin,
    avgLoss,
    payoff: avgLoss ? avgWin / avgLoss : 0,
    profitFactor: grossLoss ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
    expectancy: closed.length ? net / closed.length : 0,
    largestWin: winsArr.length ? Math.max(...winsArr) : 0,
    largestLoss: lossArr.length ? Math.min(...lossArr) : 0,
    maxWinStreak: maxWs,
    maxLossStreak: maxLs,
    maxDrawdown: maxDd,
    maxDrawdownPct: maxDdPct,
    avgR: rs.length ? sum(rs) / rs.length : undefined,
    totalR: rs.length ? sum(rs) : undefined,
    avgHoldMin: holds.length ? sum(holds) / holds.length : undefined,
    tradingDays: byDay.size,
    greenDays: [...byDay.values()].filter((v) => v > 0).length,
  }
}

export function sum(xs: number[]) {
  let s = 0
  for (const x of xs) s += x
  return s
}

export function groupSum(trades: Trade[], key: (t: Trade) => string): Map<string, number> {
  const m = new Map<string, number>()
  for (const t of trades) {
    if (!isClosed(t)) continue
    const k = key(t)
    m.set(k, (m.get(k) ?? 0) + netPnl(t))
  }
  return m
}

export function groupBy<T>(xs: T[], key: (x: T) => string | string[]): Map<string, T[]> {
  const m = new Map<string, T[]>()
  for (const x of xs) {
    const ks = key(x)
    for (const k of Array.isArray(ks) ? ks : [ks]) {
      const arr = m.get(k)
      if (arr) arr.push(x)
      else m.set(k, [x])
    }
  }
  return m
}

export interface EquityPoint {
  i: number
  date: string
  equity: number
  pnl: number
  drawdown: number
  symbol?: string
  direction?: Trade['direction']
}

export function equityCurve(trades: Trade[], startingBalance: number): EquityPoint[] {
  const closed = sortByExit(trades.filter(isClosed))
  let eq = startingBalance, peak = startingBalance
  const pts: EquityPoint[] = [{ i: 0, date: '', equity: eq, pnl: 0, drawdown: 0 }]
  closed.forEach((t, idx) => {
    const p = netPnl(t)
    eq += p
    peak = Math.max(peak, eq)
    pts.push({
      i: idx + 1, date: tradeDay(t), equity: round2(eq), pnl: round2(p), drawdown: round2(eq - peak),
      symbol: t.symbol, direction: t.direction,
    })
  })
  return pts
}

/** Closed trades whose exit day falls in [from, to] ('YYYY-MM-DD', inclusive). */
export const inRange = (trades: Trade[], from: string, to: string) =>
  trades.filter((t) => isClosed(t) && tradeDay(t) >= from && tradeDay(t) <= to)

/** Day range ending `endDaysAgo` days before `now`, `len` days long. */
export function dayRange(len: number, endDaysAgo = 0, now = new Date()): [string, string] {
  const end = new Date(now)
  end.setDate(end.getDate() - endDaysAgo)
  const start = new Date(end)
  start.setDate(start.getDate() - len + 1)
  return [ymd(start), ymd(end)]
}

/** Stats for the last `days` days and the `days` before that. */
export function comparePeriods(trades: Trade[], days = 30, now = new Date()) {
  return {
    current: computeStats(inRange(trades, ...dayRange(days, 0, now))),
    previous: computeStats(inRange(trades, ...dayRange(days, days, now))),
  }
}

/** One stats object per week for the last `weeks` weeks, oldest first. */
export function weeklyStats(trades: Trade[], weeks = 12, now = new Date()): Stats[] {
  return Array.from({ length: weeks }, (_, i) => computeStats(inRange(trades, ...dayRange(7, (weeks - 1 - i) * 7, now))))
}

export const round2 = (x: number) => Math.round(x * 100) / 100
