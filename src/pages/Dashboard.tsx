import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Add01Icon, ArrowRight02Icon, Note01Icon, Notebook01Icon, SparklesIcon } from '@hugeicons/core-free-icons'
import { EquityChart } from '../components/charts'
import { Icon } from '../components/Icon'
import { TradeTable, useTradeModal } from '../components/TradeTable'
import { Empty, Kpi } from '../components/ui'
import { computeStats, equityCurve, groupBy, isClosed, netPnl, sortByExit, sum, tradeDay } from '../lib/calc'
import { makeDemo } from '../lib/demo'
import { num, pct, pnlClass, useMoney, ymd } from '../lib/format'
import { useT } from '../i18n'
import { useStore } from '../store'

export default function Dashboard() {
  const { trades, strategies, settings, restore, dayNotes } = useStore()
  const show = useTradeModal((s) => s.show)
  const money = useMoney()
  const t = useT()

  const stats = useMemo(() => computeStats(trades, settings.startingBalance), [trades, settings.startingBalance])
  const curve = useMemo(() => equityCurve(trades, settings.startingBalance), [trades, settings.startingBalance])
  const closed = trades.filter(isClosed)
  const open = trades.filter((t) => t.status === 'open')

  const today = ymd(new Date())
  const monthKey = today.slice(0, 7)
  const todayPnl = sum(closed.filter((t) => tradeDay(t) === today).map(netPnl))
  const monthPnl = sum(closed.filter((t) => tradeDay(t).startsWith(monthKey)).map(netPnl))

  // current streak by trade
  const sorted = sortByExit(closed)
  let streak = 0
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = netPnl(sorted[i])
    if (p === 0) break
    if (streak === 0) streak = p > 0 ? 1 : -1
    else if ((p > 0) === (streak > 0)) streak += streak > 0 ? 1 : -1
    else break
  }

  const byStrategy = [...groupBy(closed, (t) => t.strategyId ?? '')].map(([id, ts]) => ({
    id, s: strategies.find((x) => x.id === id), stats: computeStats(ts),
  })).sort((a, b) => b.stats.net - a.stats.net)

  if (trades.length === 0) {
    return (
      <div className="card">
        <Empty title={t.dashboard.emptyTitle} icon={Notebook01Icon}>
          <p>{t.dashboard.emptyText}</p>
          <div className="row" style={{ justifyContent: 'center', marginTop: 16 }}>
            <button className="primary" onClick={() => show()}><Icon icon={Add01Icon} />{t.dashboard.addTrade}</button>
            <button onClick={() => restore({ ...makeDemo(), settings })}><Icon icon={SparklesIcon} />{t.dashboard.loadDemo}</button>
          </div>
        </Empty>
      </div>
    )
  }

  const hasTodayNote = !!dayNotes[today]?.plan

  return (
    <div className="stack">
      <div className="page-head">
        <h1>{t.dashboard.title}</h1>
        <div className="row">
          {!hasTodayNote && <Link to="/calendar" className="btn"><Icon icon={Note01Icon} />{t.dashboard.todayPlan}</Link>}
          <button className="primary" onClick={() => show()}><Icon icon={Add01Icon} />{t.nav.newTrade}</button>
        </div>
      </div>

      <div className="kpis">
        <Kpi label={t.dashboard.balance} value={money(settings.startingBalance + stats.net)} sub={<span className={pnlClass(stats.net)}>{money(stats.net, { sign: true })} · {pct((stats.net / settings.startingBalance) * 100)}</span>} />
        <Kpi label={t.dashboard.today} value={money(todayPnl, { sign: true })} tone={todayPnl} />
        <Kpi label={t.dashboard.thisMonth} value={money(monthPnl, { sign: true })} tone={monthPnl} />
        <Kpi label={t.dashboard.winRate} value={pct(stats.winRate)} sub={t.dashboard.winLoss(stats.wins, stats.losses, stats.count)} />
        <Kpi label={t.dashboard.profitFactor} value={num(stats.profitFactor)} sub={t.dashboard.payoff(num(stats.payoff))} />
        <Kpi label={t.dashboard.expectancy} value={money(stats.expectancy, { sign: true })} tone={stats.expectancy} sub={stats.avgR != null ? t.dashboard.avgR(num(stats.avgR)) : t.dashboard.perTrade} />
        <Kpi label={t.dashboard.maxDrawdown} value={money(-stats.maxDrawdown)} tone={-stats.maxDrawdown} sub={pct(stats.maxDrawdownPct)} />
        <Kpi label={t.dashboard.streak} value={streak === 0 ? '—' : t.dashboard.streakValue(Math.abs(streak), streak > 0)} tone={streak} sub={t.dashboard.streakRecord(stats.maxWinStreak, stats.maxLossStreak)} />
      </div>

      <div className="grid g3">
        <div className="card span2">
          <div className="card-head"><h2>{t.dashboard.equity}</h2><Link to="/analytics" className="more">{t.dashboard.toAnalytics}<Icon icon={ArrowRight02Icon} size={14} /></Link></div>
          <EquityChart data={curve} />
        </div>
        <div className="card">
          <div className="card-head"><h2>{t.dashboard.strategies}</h2><Link to="/strategies" className="more">{t.dashboard.all}<Icon icon={ArrowRight02Icon} size={14} /></Link></div>
          {byStrategy.map(({ id, s, stats: st }) => (
            <div key={id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="row" style={{ gap: 6 }}><span className="dot" style={{ background: s?.color ?? '#8a94a3' }} />{s?.name ?? t.common.noStrategy}</span>
                <span className={`num ${pnlClass(st.net)}`}>{money(st.net, { sign: true })}</span>
              </div>
              <div className="hint">{t.dashboard.strategyLine(st.count, pct(st.winRate, 0), num(st.profitFactor))}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid g3">
        <div className="card span2">
          <div className="card-head"><h2>{t.dashboard.recent}</h2><Link to="/trades" className="more">{t.dashboard.allTrades}<Icon icon={ArrowRight02Icon} size={14} /></Link></div>
          <TradeTable trades={sortByExit(closed).slice(-8)} compact sortable={false} />
        </div>
        <div className="card">
          <div className="card-head"><h2>{t.dashboard.openPositions}</h2><span className="muted">{open.length}</span></div>
          {open.length === 0 ? <div className="hint">{t.dashboard.noOpen}</div> : <TradeTable trades={open} compact sortable={false} />}
        </div>
      </div>
    </div>
  )
}
