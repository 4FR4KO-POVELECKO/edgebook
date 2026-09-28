import { useId } from 'react'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import type { EquityPoint } from '../lib/calc'
import { useT } from '../i18n'
import { useMoney } from '../lib/format'

/** Mirrors the tokens in index.css; SVG presentation attributes can't read CSS variables. */
const C = {
  grid: '#1c2230',
  axis: '#5d6579',
  zero: '#2e3748',
  tooltipBg: '#161b25',
  tooltipBorder: '#2e3748',
  text: '#e8ebf1',
  muted: '#8b93a7',
  pos: '#29c99f',
  neg: '#f2636f',
}

const AXIS = { stroke: C.axis, tick: { fill: C.axis }, tickLine: false, axisLine: false } as const
const GRID = <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />
const tooltipStyle = {
  contentStyle: {
    background: C.tooltipBg, border: `1px solid ${C.tooltipBorder}`, borderRadius: 10, fontSize: 12,
    boxShadow: '0 8px 24px rgba(0,0,0,.45)', padding: '8px 12px',
  },
  labelStyle: { color: C.muted, marginBottom: 2 },
  itemStyle: { color: C.text, fontFamily: 'var(--mono)' },
  cursor: { stroke: C.zero, fill: 'rgba(255,255,255,0.03)' },
}

function EquityTip({ active, payload, marker }: { active?: boolean; payload?: readonly { payload?: EquityPoint }[]; marker?: string }) {
  const money = useMoney()
  const t = useT()
  const p = payload?.[0]?.payload
  if (!active || !p) return null
  return (
    <div className="chart-tip">
      {marker && <div className={`chart-tip-marker ${p.pnl >= 0 ? 'pos' : 'neg'}`}>{marker}</div>}
      <div className="chart-tip-head">{p.i ? t.charts.trade(p.i) : t.charts.balance}{p.date ? ` · ${p.date}` : ''}</div>
      {p.symbol && (
        <div className="chart-tip-row">
          <span>{p.symbol} <span className={`badge ${p.direction}`}>{p.direction === 'long' ? 'L' : 'S'}</span></span>
          <b className={p.pnl >= 0 ? 'pos' : 'neg'}>{money(p.pnl, { sign: true })}</b>
        </div>
      )}
      <div className="chart-tip-row"><span className="muted">{t.charts.balance}</span><b>{money(p.equity)}</b></div>
    </div>
  )
}

export function EquityChart({ data, height = 260, markers = true }: { data: EquityPoint[]; height?: number; markers?: boolean }) {
  const money = useMoney()
  const t = useT()
  // several charts can share a page (strategies), so gradient ids must be unique
  const fillId = `eq-${useId().replace(/:/g, '')}`
  const up = data.length > 1 && data[data.length - 1].equity >= data[0].equity
  const color = up ? C.pos : C.neg
  const trades = data.slice(1)
  const best = markers && trades.length > 4 ? trades.reduce((a, b) => (b.pnl > a.pnl ? b : a)) : undefined
  const worst = markers && trades.length > 4 ? trades.reduce((a, b) => (b.pnl < a.pnl ? b : a)) : undefined
  // labels would collide with the line; the tooltip names the marker instead
  const marker = (p: EquityPoint | undefined, fill: string) => p && (
    <ReferenceDot x={p.i} y={p.equity} r={4.5} fill={fill} stroke={C.tooltipBg} strokeWidth={2} ifOverflow="extendDomain" />
  )
  const markerName = (i: number) => (i === best?.i ? t.charts.best : i === worst?.i ? t.charts.worst : undefined)
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 18, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        {GRID}
        <XAxis dataKey="i" {...AXIS} minTickGap={30} />
        <YAxis {...AXIS} width={70} domain={['auto', 'auto']} tickFormatter={(v) => money(v, { compact: true })} />
        <Tooltip cursor={tooltipStyle.cursor} content={(props) => {
          const payload = props.payload as readonly { payload?: EquityPoint }[]
          const i = payload?.[0]?.payload?.i
          return <EquityTip active={props.active} payload={payload} marker={i != null ? markerName(i) : undefined} />
        }} />
        <Area type="monotone" dataKey="equity" stroke={color} strokeWidth={2} fill={`url(#${fillId})`} isAnimationActive={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: C.tooltipBg }} />
        {marker(best, C.pos)}
        {marker(worst, C.neg)}
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function DrawdownChart({ data, height = 120 }: { data: EquityPoint[]; height?: number }) {
  const money = useMoney()
  const t = useT()
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
        {GRID}
        <XAxis dataKey="i" {...AXIS} minTickGap={30} />
        <YAxis {...AXIS} width={70} tickFormatter={(v) => money(v, { compact: true })} />
        <Tooltip {...tooltipStyle} labelFormatter={(i) => t.charts.trade(Number(i))} formatter={(v) => [money(Number(v)), t.charts.drawdown]} />
        <Area type="monotone" dataKey="drawdown" stroke={C.neg} strokeWidth={1.5} fill={C.neg} fillOpacity={0.14} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

/** Bars colored by sign. */
export function PnlBars({ data, xKey = 'name', yKey = 'value', height = 240, label = 'P&L', unit = 'money', layout = 'horizontal' }: {
  data: Record<string, unknown>[]; xKey?: string; yKey?: string; height?: number; label?: string; unit?: 'money' | 'r' | 'count'; layout?: 'horizontal' | 'vertical'
}) {
  const money = useMoney()
  const fmt = (v: number) => (unit === 'money' ? money(v, { compact: true }) : unit === 'r' ? `${v.toFixed(2)}R` : String(v))
  const vertical = layout === 'vertical'
  const id = useId().replace(/:/g, '')
  // bars fade toward the zero line; gradient direction follows the bar's sign and orientation
  const grad = (name: string, color: string, towardZero: [string, string, string, string]) => (
    <linearGradient id={`${name}-${id}`} x1={towardZero[0]} y1={towardZero[1]} x2={towardZero[2]} y2={towardZero[3]}>
      <stop offset="0%" stopColor={color} stopOpacity={1} />
      <stop offset="100%" stopColor={color} stopOpacity={0.45} />
    </linearGradient>
  )
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={layout} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
        <defs>
          {vertical ? grad('pos', C.pos, ['1', '0', '0', '0']) : grad('pos', C.pos, ['0', '0', '0', '1'])}
          {vertical ? grad('neg', C.neg, ['0', '0', '1', '0']) : grad('neg', C.neg, ['0', '1', '0', '0'])}
        </defs>
        {vertical ? <CartesianGrid stroke={C.grid} strokeDasharray="3 3" horizontal={false} /> : GRID}
        {vertical ? (
          <>
            <XAxis type="number" {...AXIS} tickFormatter={fmt} />
            <YAxis type="category" dataKey={xKey} {...AXIS} width={110} />
          </>
        ) : (
          <>
            <XAxis dataKey={xKey} {...AXIS} minTickGap={5} />
            <YAxis {...AXIS} width={70} tickFormatter={fmt} />
          </>
        )}
        <Tooltip {...tooltipStyle} formatter={(v) => [unit === 'money' ? money(Number(v)) : fmt(Number(v)), label]} />
        <ReferenceLine {...(vertical ? { x: 0 } : { y: 0 })} stroke={C.zero} />
        <Bar dataKey={yKey} radius={vertical ? [0, 4, 4, 0] : [4, 4, 0, 0]} isAnimationActive={false} maxBarSize={40}>
          {data.map((d, i) => (
            <Cell key={i} fill={`url(#${(unit === 'count' ? Number(d.sign ?? 1) : Number(d[yKey])) >= 0 ? 'pos' : 'neg'}-${id})`} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
