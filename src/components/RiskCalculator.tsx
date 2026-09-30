import { useMemo, useState, type ReactNode } from 'react'
import { ArrowDownRight01Icon, ArrowUpRight01Icon } from '@hugeicons/core-free-icons'
import { useT } from '../i18n'
import { netPnl, sum } from '../lib/calc'
import { num, pct, price, useMoney } from '../lib/format'
import {
  leverageLadder, marginNeeds, maxSafeLeverage, sizeFromStop, stopFromRisk,
  type Common, type Sized, type SizingError,
} from '../lib/sizing'
import { useStore } from '../store'
import type { Direction } from '../types'
import { Icon } from './Icon'
import type { TradeDraft } from './TradeForm'
import { Seg } from './ui'

export type CalcMode = 'stop' | 'size' | 'leverage'

/** What the calculator hands back to the trade form. */
export interface CalcResult {
  direction: Direction
  entry: number
  stop?: number
  qty?: number
  leverage: number
  mult: number
  takeProfit?: number
}

export interface CalcInitial {
  mode?: CalcMode
  direction?: Direction
  entry?: string
  stop?: string
  leverage?: string
  mult?: string
  qty?: string
}

/** Trade-form draft fields from a calculator result; fields the result doesn't set are left out. */
export function draftFromCalc(r: CalcResult): Partial<TradeDraft> {
  return {
    direction: r.direction,
    entryPrice: String(r.entry),
    leverage: String(r.leverage),
    multiplier: String(r.mult),
    ...(r.stop != null && { stopLoss: String(r.stop) }),
    ...(r.takeProfit != null && { takeProfit: String(r.takeProfit) }),
    ...(r.qty != null && { quantity: String(r.qty) }),
  }
}

const toNum = (v: string) => {
  const x = Number(v.replace(',', '.').replace(/\s/g, ''))
  return v.trim() === '' || !Number.isFinite(x) ? NaN : x
}

/** Decimals worth showing for a quantity: whole units for big sizes, more for fractional ones. */
const qtyDecimals = (q: number) => (q >= 1000 ? 0 : q >= 10 ? 2 : q >= 1 ? 3 : 5)

/** Round a quantity down, so the actual loss never exceeds the risk. */
export function roundQtyDown(q: number) {
  const f = 10 ** qtyDecimals(q)
  return Math.floor(q * f) / f
}

const px = (v: number) => price(+v.toPrecision(7))

export function RiskCalculator({ initial, onUse, useLabel }: { initial?: CalcInitial; onUse: (r: CalcResult) => void; useLabel: string }) {
  const t = useT()
  const money = useMoney()
  const settings = useStore((s) => s.settings)
  const trades = useStore((s) => s.trades)
  const journalBalance = useMemo(() => settings.startingBalance + sum(trades.map(netPnl)), [settings.startingBalance, trades])

  const [mode, setMode] = useState<CalcMode>(initial?.mode ?? 'stop')
  const [direction, setDirection] = useState<Direction>(initial?.direction ?? 'long')
  const [entry, setEntry] = useState(initial?.entry ?? '')
  const [stop, setStop] = useState(initial?.stop ?? '')
  const [leverage, setLeverage] = useState(initial?.leverage && toNum(initial.leverage) >= 1 ? initial.leverage : '1')
  const [mult, setMult] = useState(initial?.mult || '1')
  const [fee, setFee] = useState('0')
  const [balance, setBalance] = useState(String(Math.round(journalBalance * 100) / 100))
  const [riskPct, setRiskPct] = useState(String(settings.riskPercent))
  const [sizeBy, setSizeBy] = useState<'units' | 'margin'>('units')
  const [qty, setQty] = useState(initial?.qty ?? '')
  const [margin, setMargin] = useState('')
  const [buffer, setBuffer] = useState('0.5')

  const riskMoney = (toNum(balance) * toNum(riskPct)) / 100
  const common: Common = {
    direction, entry: toNum(entry), leverage: toNum(leverage) || 1, mult: toNum(mult) || 1,
    feePct: toNum(fee) || 0, riskMoney,
  }

  const sized: Sized | SizingError | undefined =
    mode === 'stop' ? stopFromRisk(common, sizeBy === 'units' ? { qty: toNum(qty) } : { margin: toNum(margin) })
      : mode === 'size' ? sizeFromStop(common, toNum(stop))
        : undefined
  const safe = mode === 'leverage' ? maxSafeLeverage(direction, toNum(entry), toNum(stop), toNum(buffer) || 0) : undefined

  const field = (labelText: ReactNode, value: string, set: (v: string) => void, opts: { suffix?: string; wide?: boolean; hint?: ReactNode } = {}) => (
    <label className={`field ${opts.wide ? 'full' : 'half'}`}>
      <span>{labelText}</span>
      <div className={opts.suffix ? 'input-suffix' : undefined}>
        <input inputMode="decimal" value={value} onChange={(e) => set(e.target.value)} />
        {opts.suffix && <span>{opts.suffix}</span>}
      </div>
      {opts.hint && <span className="hint">{opts.hint}</span>}
    </label>
  )

  const levPresets = (
    <div className="chips lev-presets">
      {[1, 2, 5, 10, 20, 50].map((v) => (
        <span key={v} className={`chip ${toNum(leverage) === v ? 'on' : ''}`} onClick={() => setLeverage(String(v))}>{v}×</span>
      ))}
    </div>
  )

  const use = () => {
    if (mode === 'leverage') {
      if (typeof safe !== 'object') return
      onUse({ direction, entry: common.entry, stop: toNum(stop), leverage: Math.max(1, Math.floor(safe.maxLeverage)), mult: common.mult })
      return
    }
    if (!sized || typeof sized !== 'object') return
    onUse({
      direction, entry: common.entry, stop: +sized.stop.toPrecision(7), qty: roundQtyDown(sized.qty),
      leverage: common.leverage, mult: common.mult, takeProfit: +sized.targets[1].price.toPrecision(7),
    })
  }
  const canUse = mode === 'leverage' ? typeof safe === 'object' : typeof sized === 'object'
  const error = mode === 'leverage' ? (typeof safe === 'string' ? safe : undefined) : typeof sized === 'string' ? sized : undefined

  return (
    <div className="calc">
      <div className="calc-inputs">
        <div className="calc-modes">
          <Seg value={mode} onChange={setMode} options={[
            { value: 'stop', label: t.calc.modes.stop },
            { value: 'size', label: t.calc.modes.size },
            { value: 'leverage', label: t.calc.modes.leverage },
          ]} />
        </div>
        <p className="hint calc-mode-hint">{t.calc.modeHints[mode]}</p>

        <div className="row" style={{ marginBottom: 14 }}>
          <Seg value={direction} onChange={setDirection} options={[
            { value: 'long', label: <><Icon icon={ArrowUpRight01Icon} size={16} />Long</>, cls: 'long' },
            { value: 'short', label: <><Icon icon={ArrowDownRight01Icon} size={16} />Short</>, cls: 'short' },
          ]} />
        </div>

        <div className="form-grid">
          {field(t.calc.entry, entry, setEntry)}
          {mode !== 'stop'
            ? field(t.calc.stop, stop, setStop)
            : (
              <div className="field half">
                <span>{t.calc.sizeBy}</span>
                <Seg value={sizeBy} onChange={setSizeBy} options={[{ value: 'units', label: t.calc.units }, { value: 'margin', label: t.calc.margin }]} />
              </div>
            )}

          {mode === 'stop' && (sizeBy === 'units' ? field(t.calc.units, qty, setQty) : field(t.calc.margin, margin, setMargin, { suffix: settings.currency }))}

          {mode !== 'leverage' && (
            <label className="field half">
              <span>{t.calc.leverage}</span>
              <div className="input-suffix">
                <input inputMode="decimal" value={leverage} onChange={(e) => setLeverage(e.target.value)} />
                <span>×</span>
              </div>
              {levPresets}
            </label>
          )}

          {mode !== 'leverage' && (
            <>
              {field(t.calc.balance, balance, setBalance, { suffix: settings.currency })}
              {field(t.calc.riskPct, riskPct, setRiskPct, { suffix: '%', hint: Number.isFinite(riskMoney) && riskMoney > 0 ? t.calc.atRisk(money(riskMoney)) : undefined })}
              {field(t.calc.fee, fee, setFee, { suffix: '%' })}
              {field(t.calc.multiplier, mult, setMult)}
            </>
          )}
          {mode === 'leverage' && field(t.calc.buffer, buffer, setBuffer, { suffix: '%' })}
        </div>
      </div>

      <div className="calc-result">
        {error ? <div className="hint calc-empty">{t.calc.errors[error]}</div> : (
          <>
            {mode !== 'leverage' && typeof sized === 'object' && (
              <SizedView sized={sized} mode={mode} common={common} balance={toNum(balance)} />
            )}
            {mode === 'leverage' && typeof safe === 'object' && (
              <LeverageView direction={direction} entry={common.entry} stop={toNum(stop)} buffer={toNum(buffer) || 0} safe={safe} />
            )}
          </>
        )}
        <button className="primary calc-use" disabled={!canUse} onClick={use}>{useLabel}</button>
      </div>
    </div>
  )
}

function SizedView({ sized, mode, common, balance }: { sized: Sized; mode: CalcMode; common: Common; balance: number }) {
  const t = useT()
  const money = useMoney()
  const qty = roundQtyDown(sized.qty)
  const needs = marginNeeds(sized.notional, common.leverage, balance)
  return (
    <>
      <div className="calc-main">
        <div className="hint">{mode === 'stop' ? t.calc.stopAt : t.calc.sizeIs}</div>
        <div className="calc-big num">{mode === 'stop' ? px(sized.stop) : num(qty, qtyDecimals(qty))}</div>
        <div className="hint">
          {mode === 'stop' ? `${t.calc.stopDist} ${pct(sized.stopPct, 2)}` : `${t.calc.notional} ${money(sized.notional)}`}
        </div>
      </div>

      <dl className="calc-list">
        {mode === 'stop' && <Row k={t.calc.notional} v={money(sized.notional)} />}
        {mode === 'size' && <Row k={t.calc.stopDist} v={pct(sized.stopPct, 2)} />}
        <Row k={t.calc.marginNeeded} v={money(sized.margin)} />
        {mode === 'size' && needs.minLeverage != null && needs.minLeverage > 1 && <Row k={t.calc.minLev} v={`${num(Math.ceil(needs.minLeverage * 10) / 10, 1)}×`} />}
        {sized.fees > 0 && <Row k={t.calc.fees} v={money(sized.fees)} />}
        {sized.liq != null && <Row k={t.calc.liquidation} v={<span className="neg">{px(sized.liq)}</span>} />}
      </dl>

      {sized.liqBeforeStop && <div className="warn-box" style={{ marginBottom: 14 }}>{t.calc.liqWarn}</div>}

      <div className="section-title" style={{ marginTop: 4 }}>{t.calc.targets}</div>
      <div className="calc-targets">
        {sized.targets.map((tg) => (
          <div key={tg.k}>
            <div className="hint">{tg.k}R · <span className="pos">+{money(tg.k * common.riskMoney)}</span></div>
            <div className="num">{px(tg.price)}</div>
          </div>
        ))}
      </div>
    </>
  )
}

function LeverageView({ direction, entry, stop, buffer, safe }: {
  direction: Direction; entry: number; stop: number; buffer: number; safe: { stopPct: number; maxLeverage: number }
}) {
  const t = useT()
  const ladder = leverageLadder(direction, entry, stop, buffer)
  return (
    <>
      <div className="calc-main">
        <div className="hint">{t.calc.maxLev}</div>
        <div className="calc-big num">{num(Math.floor(safe.maxLeverage * 10) / 10, 1)}×</div>
        <div className="hint">{t.calc.stopDist} {pct(safe.stopPct, 2)}</div>
      </div>
      <div className="section-title" style={{ marginTop: 4 }}>{t.calc.ladder}</div>
      <div className="calc-ladder">
        {ladder.filter((l) => l.lev > 1).map((l) => (
          <div key={l.lev} className={l.safe ? 'ok' : 'bad'}>
            <span className="num">{l.lev}×</span>
            <span className="num">{l.liq != null ? px(l.liq) : '—'}</span>
            <span className="small">{l.safe ? t.calc.safe : t.calc.unsafe}</span>
          </div>
        ))}
      </div>
      <p className="hint" style={{ marginTop: 12 }}>{t.calc.maxLevNote}</p>
    </>
  )
}

function Row({ k, v }: { k: ReactNode; v: ReactNode }) {
  return <div className="calc-row"><dt>{k}</dt><dd className="num">{v}</dd></div>
}
