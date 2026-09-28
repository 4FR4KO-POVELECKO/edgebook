import { useId } from 'react'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
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

export function EquityChart({ data, height = 260 }: { data: EquityPoint[]; height?: number }) {
  const money = useMoney()
  const t = useT()
  // several charts can share a page (strategies), so gradient ids must be unique
  const fillId = `eq-${useId().replace(/:/g, '')}`
  const up = data.length > 1 && data[data.length - 1].equity >= data[0].equity
  const color = up ? C.pos : C.neg
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        {GRID}
        <XAxis dataKey="i" {...AXIS} minTickGap={30} />
        <YAxis {...AXIS} width={70} domain={['auto', 'auto']} tickFormatter={(v) => money(v, { compact: true })} />
        <Tooltip {...tooltipStyle} labelFormatter={(i, p) => `${t.charts.trade(Number(i))}${p?.[0]?.payload?.date ? ' · ' + p[0].payload.date : ''}`}
          formatter={(v, name) => [money(Number(v)), name === 'equity' ? t.charts.balance : String(name)]} />
        <Area type="monotone" dataKey="equity" stroke={color} strokeWidth={2} fill={`url(#${fillId})`} isAnimationActive={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: C.tooltipBg }} />
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
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={layout} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
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
            <Cell key={i} fill={(unit === 'count' ? Number(d.sign ?? 1) : Number(d[yKey])) >= 0 ? C.pos : C.neg} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
