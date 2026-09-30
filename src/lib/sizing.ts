import type { Direction } from '../types'

/**
 * Position sizing math for the calculator. All prices are per unit; `mult` is the contract
 * multiplier (1 for spot). Fees are a percentage of notional charged on entry and on exit,
 * approximated with the entry price for both sides.
 *
 * Liquidation uses the same isolated-margin approximation as the rest of the app
 * (entry × (1 ∓ 1/leverage), no maintenance margin), so real exchanges liquidate a bit earlier.
 */

export interface Common {
  direction: Direction
  entry: number
  leverage: number
  mult: number
  /** fee per side, % of notional */
  feePct: number
  /** money you accept to lose at the stop */
  riskMoney: number
}

const sign = (d: Direction) => (d === 'long' ? 1 : -1)

/** Round-trip fee in money for `qty` units. */
export const roundTripFees = (c: Common, qty: number) => 2 * (c.feePct / 100) * c.entry * qty * c.mult

export function liquidation(c: Pick<Common, 'direction' | 'entry' | 'leverage'>): number | undefined {
  if (c.leverage <= 1 || c.entry <= 0) return undefined
  return c.direction === 'long' ? c.entry * (1 - 1 / c.leverage) : c.entry * (1 + 1 / c.leverage)
}

/** True when price reaches liquidation before (or exactly at) the stop. */
export function stopPastLiquidation(c: Pick<Common, 'direction' | 'entry' | 'leverage'>, stop: number): boolean {
  const liq = liquidation(c)
  if (liq == null) return false
  return c.direction === 'long' ? stop <= liq : stop >= liq
}

/** Prices where net profit (after fees) equals k × risk, for each k. */
export function targets(c: Common, qty: number, ks = [1, 2, 3]) {
  const fees = roundTripFees(c, qty)
  return ks.map((k) => ({ k, price: c.entry + sign(c.direction) * ((k * c.riskMoney + fees) / (qty * c.mult)) }))
}

export type SizingError = 'missing' | 'feesExceedRisk' | 'stopBelowZero' | 'stopWrongSide'

export interface Sized {
  qty: number
  stop: number
  notional: number
  margin: number
  fees: number
  /** stop distance as % of entry */
  stopPct: number
  liq?: number
  liqBeforeStop: boolean
  targets: { k: number; price: number }[]
}

/** Mode 1: position size is known (units or margin), find the stop that loses exactly the risk. */
export function stopFromRisk(c: Common, size: { qty?: number; margin?: number }): Sized | SizingError {
  if (!(c.entry > 0) || !(c.riskMoney > 0) || !(c.leverage >= 1) || !(c.mult > 0)) return 'missing'
  const qty = size.qty ?? (size.margin != null ? (size.margin * c.leverage) / (c.entry * c.mult) : NaN)
  if (!(qty > 0)) return 'missing'
  const fees = roundTripFees(c, qty)
  if (fees >= c.riskMoney) return 'feesExceedRisk'
  const dist = (c.riskMoney - fees) / (qty * c.mult)
  const stop = c.entry - sign(c.direction) * dist
  if (stop <= 0) return 'stopBelowZero'
  return finish(c, qty, stop, fees)
}

/** Mode 2: the stop is known, find the position size that loses exactly the risk. */
export function sizeFromStop(c: Common, stop: number): Sized | SizingError {
  if (!(c.entry > 0) || !(c.riskMoney > 0) || !(c.leverage >= 1) || !(c.mult > 0) || !(stop > 0)) return 'missing'
  if (sign(c.direction) * (c.entry - stop) <= 0) return 'stopWrongSide'
  const perUnit = Math.abs(c.entry - stop) * c.mult + 2 * (c.feePct / 100) * c.entry * c.mult
  const qty = c.riskMoney / perUnit
  return finish(c, qty, stop, roundTripFees(c, qty))
}

function finish(c: Common, qty: number, stop: number, fees: number): Sized {
  const notional = qty * c.entry * c.mult
  const liq = liquidation(c)
  return {
    qty, stop, notional, fees,
    margin: notional / c.leverage,
    stopPct: (Math.abs(c.entry - stop) / c.entry) * 100,
    liq,
    liqBeforeStop: stopPastLiquidation(c, stop),
    targets: targets(c, qty),
  }
}

/** Margin you'd need for a notional, and the smallest leverage that fits into `available`. */
export function marginNeeds(notional: number, leverage: number, available: number) {
  return { margin: notional / leverage, minLeverage: available > 0 ? notional / available : undefined }
}

/**
 * Mode 3: the highest leverage at which liquidation still comes after the stop, keeping
 * `bufferPct` (% of entry) between them. Liquidation distance ≈ 1/leverage of entry.
 */
export function maxSafeLeverage(direction: Direction, entry: number, stop: number, bufferPct: number) {
  if (!(entry > 0) || !(stop > 0)) return 'missing' as const
  if (sign(direction) * (entry - stop) <= 0) return 'stopWrongSide' as const
  const stopFrac = Math.abs(entry - stop) / entry
  return { stopPct: stopFrac * 100, maxLeverage: 1 / (stopFrac + Math.max(0, bufferPct) / 100) }
}

/** Liquidation price for each common leverage, and whether it stays at least `bufferPct` (% of
 * entry) beyond the stop — the same rule as maxSafeLeverage, so the two always agree. */
export function leverageLadder(direction: Direction, entry: number, stop: number, bufferPct = 0, levels = [1, 2, 3, 5, 10, 20, 25, 50, 75, 100, 125]) {
  const needed = Math.abs(entry - stop) + (Math.max(0, bufferPct) / 100) * entry
  return levels.map((lev) => {
    const liq = liquidation({ direction, entry, leverage: lev })
    // strictly beyond: liquidation exactly at the stop is not safe
    return { lev, liq, safe: liq == null || Math.abs(entry - liq) > needed }
  })
}
