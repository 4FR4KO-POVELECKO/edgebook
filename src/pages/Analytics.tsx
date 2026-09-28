import { useMemo, useState, type ReactNode } from 'react'
import { Alert02Icon, Analytics01Icon, ArrowDownRight01Icon, ArrowUpRight01Icon, CheckmarkCircle02Icon, FilterIcon } from '@hugeicons/core-free-icons'
import { DrawdownChart, EquityChart, PnlBars } from '../components/charts'
import { Icon } from '../components/Icon'
import { Empty, Seg } from '../components/ui'
import {
  computeStats, equityCurve, groupBy, holdMinutes, isClosed, netPnl, rMultiple, round2, sortByExit, sum, tradeDay, type Stats,
} from '../lib/calc'
import { duration, num, pct, pnlClass, rFmt, useMoney, ymd } from '../lib/format'
import { label, useT, type Dict } from '../i18n'
import { useStore } from '../store'
import type { Trade } from '../types'

type Period = 'all' | '30' | '90' | 'ytd'

export default function Analytics() {
  const { trades, strategies, settings } = useStore()
  const money = useMoney()
  const t = useT()
  const [period, setPeriod] = useState<Period>('all')
  const [strategy, setStrategy] = useState('')
  const [market, setMarket] = useState('')

  const filtered = useMemo(() => {
    const now = new Date()
    let from = ''
    if (period === '30' || period === '90') { const d = new Date(now); d.setDate(d.getDate() - Number(period)); from = ymd(d) }
    if (period === 'ytd') from = `${now.getFullYear()}-01-01`
    return trades.filter((t) => isClosed(t) &&
      (!from || tradeDay(t) >= from) &&
      (!strategy || (strategy === '-' ? !t.strategyId : t.strategyId === strategy)) &&
      (!market || t.market === market))
  }, [trades, period, strategy, market])

  const st = useMemo(() => computeStats(filtered, settings.startingBalance), [filtered, settings.startingBalance])
  const curve = useMemo(() => equityCurve(filtered, settings.startingBalance), [filtered, settings.startingBalance])
  const markets = [...new Set(trades.map((t) => t.market))]

  const daily = useMemo(() => {
    const m = groupBy(filtered, tradeDay)
    return [...m].sort(([a], [b]) => a.localeCompare(b)).map(([d, ts]) => ({ name: d.slice(5).split('-').reverse().join('.'), value: round2(sum(ts.map(netPnl))) }))
  }, [filtered])

  const byWeekday = t.weekdaysShort.map((name, i) => ({
    name, value: round2(sum(filtered.filter((t) => (new Date(t.entryDate).getDay() + 6) % 7 === i).map(netPnl))),
  })).filter((x, i) => i < 5 || x.value !== 0)

  const hours = groupBy(filtered, (t) => String(new Date(t.entryDate).getHours()).padStart(2, '0'))
  const byHour = [...hours].sort(([a], [b]) => a.localeCompare(b)).map(([h, ts]) => ({ name: `${h}:00`, value: round2(sum(ts.map(netPnl))) }))

  const rBuckets = useMemo(() => {
    const rs = filtered.map(rMultiple).filter((r): r is number => r != null)
    const edges = [-Infinity, -2, -1, -0.5, 0, 0.5, 1, 2, 3, Infinity]
    const labels = ['< −2R', '−2…−1', '−1…−0.5', '−0.5…0', '0…0.5', '0.5…1', '1…2', '2…3', '> 3R']
    return labels.map((name, i) => ({ name, value: rs.filter((r) => r >= edges[i] && r < edges[i + 1]).length, sign: i < 4 ? -1 : 1 }))
  }, [filtered])

  if (!trades.some(isClosed)) return <div className="card"><Empty title={t.analytics.noClosed} icon={Analytics01Icon} /></div>

  const sName = (id: string) => strategies.find((s) => s.id === id)?.name ?? t.common.noStrategy
  const sColor = (id: string) => strategies.find((s) => s.id === id)?.color

  // mistakes: cost & what-if
  const clean = filtered.filter((t) => t.mistakes.length === 0)
  const withMistakes = filtered.filter((t) => t.mistakes.length > 0)
  const mistakeCost = sum(withMistakes.map(netPnl))

  // checklist adherence: all strategy rules ticked vs not
  const withChecklist = filtered.filter((t) => Object.keys(t.checklist ?? {}).length > 0)
  const followed = withChecklist.filter((t) => Object.values(t.checklist).every(Boolean))
  const broken = withChecklist.filter((t) => !Object.values(t.checklist).every(Boolean))

  const holdLabels = t.analytics.hold
  const holdBucket = (x: Trade) => {
    const m = holdMinutes(x) ?? 0
    return holdLabels[m < 15 ? 0 : m < 60 ? 1 : m < 240 ? 2 : m < 1440 ? 3 : 4]
  }

  return (
    <div className="stack">
      <div className="page-head">
        <h1>{t.analytics.title}</h1>
        <div className="row">
          <Seg value={period} onChange={setPeriod} options={[{ value: '30', label: t.analytics.d30 }, { value: '90', label: t.analytics.d90 }, { value: 'ytd', label: t.analytics.ytd }, { value: 'all', label: t.analytics.allTime }]} />
          <select style={{ width: 170 }} value={strategy} onChange={(e) => setStrategy(e.target.value)}>
            <option value="">{t.common.allStrategies}</option>
            <option value="-">{t.common.noStrategy}</option>
            {strategies.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select style={{ width: 150 }} value={market} onChange={(e) => setMarket(e.target.value)}>
            <option value="">{t.common.allMarkets}</option>
            {markets.map((m) => <option key={m} value={m}>{label(t.markets, m)}</option>)}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? <div className="card"><Empty title={t.analytics.noMatch} icon={FilterIcon} /></div> : <>
        <MetricsGrid st={st} t={t} />

        <div className="card">
          <div className="card-head"><h2>{t.analytics.equity}</h2><span className={`num ${pnlClass(st.net)}`}>{money(st.net, { sign: true })}</span></div>
          <EquityChart data={curve} height={280} />
          <div className="section-title" style={{ marginTop: 8 }}>{t.analytics.drawdown}</div>
          <DrawdownChart data={curve} />
        </div>

        <div className="card">
          <div className="card-head"><h2>{t.analytics.daily}</h2></div>
          <PnlBars data={daily} />
        </div>

        <div className="grid g2">
          <div className="card"><div className="card-head"><h2>{t.analytics.weekday}</h2></div><PnlBars data={byWeekday} height={220} /></div>
          <div className="card"><div className="card-head"><h2>{t.analytics.hour}</h2></div><PnlBars data={byHour} height={220} /></div>
        </div>

        <div className="grid g2">
          <div className="card">
            <div className="card-head"><h2>{t.analytics.rDist}</h2><span className="muted small">{t.analytics.rTotal(rFmt(st.totalR))}</span></div>
            {st.avgR == null ? <div className="hint">{t.analytics.rHint}</div> : <PnlBars data={rBuckets} unit="count" label={t.analytics.tradesAxis} height={220} />}
          </div>
          <div className="card">
            <div className="card-head"><h2>{t.analytics.longShort}</h2></div>
            <Breakdown rows={[...groupBy(filtered, (t) => t.direction)].map(([k, ts]) => ({ key: k, label: k === 'long' ? <span className="row pos" style={{ gap: 4 }}><Icon icon={ArrowUpRight01Icon} size={15} />Long</span> : <span className="row neg" style={{ gap: 4 }}><Icon icon={ArrowDownRight01Icon} size={15} />Short</span>, trades: ts }))} />
            <div className="section-title">{t.analytics.holdTime}</div>
            <Breakdown rows={[...groupBy(filtered, holdBucket)].sort(([a], [b]) => holdLabels.indexOf(a) - holdLabels.indexOf(b)).map(([k, ts]) => ({ key: k, label: k, trades: ts }))} sort={false} />
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h2>{t.analytics.byStrategy}</h2></div>
          <Breakdown rows={[...groupBy(filtered, (t) => t.strategyId ?? '')].map(([k, ts]) => ({
            key: k, trades: ts,
            label: <span className="row" style={{ gap: 6 }}><span className="dot" style={{ background: sColor(k) ?? '#8a94a3' }} />{sName(k)}</span>,
          }))} withR />
        </div>

        <div className="grid g2">
          <div className="card">
            <div className="card-head"><h2>{t.analytics.mistakeCost}</h2><span className={`num ${pnlClass(mistakeCost)}`}>{money(mistakeCost, { sign: true })}</span></div>
            <div className="hint" style={{ marginBottom: 10 }}>
              {t.analytics.whatIf} <b className={pnlClass(sum(clean.map(netPnl)))}>{money(sum(clean.map(netPnl)), { sign: true })}</b> {t.analytics.insteadOf} <b className={pnlClass(st.net)}>{money(st.net, { sign: true })}</b>.
              {t.analytics.mistakeWr(pct(computeStats(clean).winRate), pct(computeStats(withMistakes).winRate))}
            </div>
            {withMistakes.length ? <Breakdown rows={[...groupBy(withMistakes, (t) => t.mistakes)].map(([k, ts]) => ({ key: k, label: <span className="tag bad">{label(t.mistakes, k)}</span>, trades: ts }))} /> : <div className="hint">{t.analytics.noMistakes}</div>}
          </div>
          <div className="card">
            <div className="card-head"><h2>{t.analytics.discipline}</h2></div>
            {withChecklist.length ? (
              <Breakdown rows={[
                { key: 'y', label: <span className="row" style={{ gap: 6 }}><Icon icon={CheckmarkCircle02Icon} size={16} className="pos" />{t.analytics.rulesFollowed}</span>, trades: followed },
                { key: 'n', label: <span className="row" style={{ gap: 6 }}><Icon icon={Alert02Icon} size={16} style={{ color: 'var(--warn)' }} />{t.analytics.rulesBroken}</span>, trades: broken },
              ].filter((r) => r.trades.length)} />
            ) : <div className="hint">{t.analytics.checklistHint}</div>}
            <div className="section-title">{t.analytics.byEmotion}</div>
            <Breakdown rows={[...groupBy(filtered.filter((t) => t.emotion), (x) => x.emotion!)].map(([k, ts]) => ({ key: k, label: label(t.emotions, k), trades: ts }))} />
          </div>
        </div>

        <div className="grid g2">
          <div className="card">
            <div className="card-head"><h2>{t.analytics.bySymbol}</h2></div>
            <Breakdown rows={[...groupBy(filtered, (t) => t.symbol)].map(([k, ts]) => ({ key: k, label: <b>{k}</b>, trades: ts }))} limit={12} />
          </div>
          <div className="card">
            <div className="card-head"><h2>{t.analytics.byTag}</h2></div>
            <Breakdown rows={[...groupBy(filtered.filter((t) => t.tags.length), (t) => t.tags)].map(([k, ts]) => ({ key: k, label: <span className="tag">{k}</span>, trades: ts }))} limit={12} />
            <div className="section-title">{t.analytics.byRating}</div>
            <Breakdown rows={[...groupBy(filtered.filter((t) => t.rating), (t) => String(t.rating))].sort(([a], [b]) => Number(b) - Number(a)).map(([k, ts]) => ({ key: k, label: <span style={{ color: 'var(--warn)' }}>{'★'.repeat(Number(k))}</span>, trades: ts }))} sort={false} />
          </div>
        </div>
      </>}
    </div>
  )
}

function MetricsGrid({ st, t }: { st: Stats; t: Dict }) {
  const money = useMoney()
  const m = t.analytics.m
  const items: [string, ReactNode, number?][] = [
    [m.net, money(st.net, { sign: true }), st.net],
    [m.count, st.count],
    [m.winRate, pct(st.winRate)],
    [m.pf, num(st.profitFactor)],
    [m.expectancy, money(st.expectancy, { sign: true }), st.expectancy],
    [m.avgR, rFmt(st.avgR), st.avgR],
    [m.avgWin, money(st.avgWin), 1],
    [m.avgLoss, money(-st.avgLoss), -1],
    [m.payoff, num(st.payoff)],
    [m.best, money(st.largestWin, { sign: true }), 1],
    [m.worst, money(st.largestLoss, { sign: true }), -1],
    [m.maxDd, `${money(-st.maxDrawdown)} · ${pct(st.maxDrawdownPct)}`, -1],
    [m.streaks, `${st.maxWinStreak} / ${st.maxLossStreak}`],
    [m.greenDays, t.common.of(st.greenDays, st.tradingDays)],
    [m.avgHold, duration(st.avgHoldMin)],
    [m.fees, money(-st.fees), st.fees ? -1 : 0],
  ]
  return (
    <div className="card">
      <div className="kpis" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 16 }}>
        {items.map(([l, v, tone]) => (
          <div key={l}>
            <div className="hint">{l}</div>
            <div className={`num ${tone != null ? pnlClass(tone) : ''}`} style={{ fontSize: 16, fontWeight: 600 }}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Breakdown({ rows, limit, withR, sort = true }: { rows: { key: string; label: ReactNode; trades: Trade[] }[]; limit?: number; withR?: boolean; sort?: boolean }) {
  const money = useMoney()
  const t = useT()
  const data = rows.map((r) => ({ ...r, st: computeStats(sortByExit(r.trades)) }))
  if (sort) data.sort((a, b) => b.st.net - a.st.net)
  const shown = limit ? data.slice(0, limit) : data
  const maxAbs = Math.max(1, ...shown.map((r) => Math.abs(r.st.net)))
  if (!shown.length) return <div className="hint">{t.common.noData}</div>
  return (
    <div className="table-wrap">
      <table className="plain">
        <thead>
          <tr>
            <th></th><th className="r">{t.analytics.col.trades}</th><th className="r">WR</th><th className="r">PF</th>
            {withR && <th className="r">{t.analytics.col.avgR}</th>}
            <th className="r">{t.analytics.col.avgPnl}</th><th className="r">{t.analytics.col.total}</th><th style={{ width: '22%' }}></th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr key={r.key}>
              <td>{r.label}</td>
              <td className="r num">{r.st.count}</td>
              <td className="r num">{pct(r.st.winRate, 0)}</td>
              <td className="r num">{num(r.st.profitFactor)}</td>
              {withR && <td className={`r num ${pnlClass(r.st.avgR ?? 0)}`}>{rFmt(r.st.avgR)}</td>}
              <td className={`r num ${pnlClass(r.st.expectancy)}`}>{money(r.st.expectancy, { sign: true })}</td>
              <td className={`r num ${pnlClass(r.st.net)}`}><b>{money(r.st.net, { sign: true })}</b></td>
              <td>
                <div className="bar-bg"><div className="bar-fg" style={{ width: `${(Math.abs(r.st.net) / maxAbs) * 100}%`, background: r.st.net >= 0 ? 'var(--pos)' : 'var(--neg)' }} /></div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
