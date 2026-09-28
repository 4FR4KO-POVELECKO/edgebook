import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import type { EquityPoint } from '../lib/calc'
import { useMoney } from '../lib/format'

const AXIS = { stroke: '#8a94a3', tickLine: false, axisLine: false } as const
const GRID = <CartesianGrid stroke="#262e39" strokeDasharray="3 3" vertical={false} />
const tooltipStyle = {
  contentStyle: { background: '#1b212a', border: '1px solid #262e39', borderRadius: 8, fontSize: 12 },
  labelStyle: { color: '#8a94a3' },
  itemStyle: { color: '#e6e9ee' },
  cursor: { fill: 'rgba(255,255,255,0.04)' },
}

export function EquityChart({ data, height = 260 }: { data: EquityPoint[]; height?: number }) {
  const money = useMoney()
  const up = data.length > 1 && data[data.length - 1].equity >= data[0].equity
  const color = up ? '#22c3a6' : '#f0616d'
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="eqFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        {GRID}
        <XAxis dataKey="i" {...AXIS} minTickGap={30} />
        <YAxis {...AXIS} width={70} domain={['auto', 'auto']} tickFormatter={(v) => money(v, { compact: true })} />
        <Tooltip {...tooltipStyle} labelFormatter={(i, p) => `Сделка #${i}${p?.[0]?.payload?.date ? ' · ' + p[0].payload.date : ''}`}
          formatter={(v, name) => [money(Number(v)), name === 'equity' ? 'Баланс' : String(name)]} />
        <Area type="monotone" dataKey="equity" stroke={color} strokeWidth={2} fill="url(#eqFill)" isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function DrawdownChart({ data, height = 120 }: { data: EquityPoint[]; height?: number }) {
  const money = useMoney()
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
        {GRID}
        <XAxis dataKey="i" {...AXIS} minTickGap={30} />
        <YAxis {...AXIS} width={70} tickFormatter={(v) => money(v, { compact: true })} />
        <Tooltip {...tooltipStyle} labelFormatter={(i) => `Сделка #${i}`} formatter={(v) => [money(Number(v)), 'Просадка']} />
        <Area type="monotone" dataKey="drawdown" stroke="#f0616d" fill="rgba(240,97,109,0.2)" isAnimationActive={false} />
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
        {vertical ? <CartesianGrid stroke="#262e39" strokeDasharray="3 3" horizontal={false} /> : GRID}
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
        <ReferenceLine {...(vertical ? { x: 0 } : { y: 0 })} stroke="#3a4452" />
        <Bar dataKey={yKey} radius={vertical ? [0, 4, 4, 0] : [4, 4, 0, 0]} isAnimationActive={false} maxBarSize={40}>
          {data.map((d, i) => (
            <Cell key={i} fill={(unit === 'count' ? Number(d.sign ?? 1) : Number(d[yKey])) >= 0 ? '#22c3a6' : '#f0616d'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
