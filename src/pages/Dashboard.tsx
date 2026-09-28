import { useMemo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Add01Icon, ArrowRight02Icon, Note01Icon, Notebook01Icon, SparklesIcon } from '@hugeicons/core-free-icons'
import { EquityChart } from '../components/charts'
import { Icon } from '../components/Icon'
import { TradeTable, useTradeModal } from '../components/TradeTable'
import { Empty } from '../components/ui'
import { computeStats, equityCurve, groupBy, isClosed, netPnl, sortByExit, sum, tradeDay } from '../lib/calc'
import { makeDemo } from '../lib/demo'
import { fmtDateTime, num, pct, pnlClass, price, useMoney, ymd } from '../lib/format'
import { useT } from '../i18n'
import { useStore } from '../store'

function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: number }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className={`value ${tone != null ? pnlClass(tone) : ''}`}>{value}</div>
      {sub != null && <div className="sub">{sub}</div>}
    </div>
  )
}

function MoreLink({ to, children }: { to: string; children: ReactNode }) {
  return <Link to={to} className="more">{children}<Icon icon={ArrowRight02Icon} size={14} /></Link>
}

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
  const maxStrategyAbs = Math.max(1, ...byStrategy.map((b) => Math.abs(b.stats.net)))

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
  const balance = settings.startingBalance + stats.net

  return (
    <div className="stack">
      <div className="page-head">
        <h1>{t.dashboard.title}</h1>
        <div className="row">
          {!hasTodayNote && <Link to="/calendar" className="btn"><Icon icon={Note01Icon} />{t.dashboard.todayPlan}</Link>}
          <button className="primary" onClick={() => show()}><Icon icon={Add01Icon} />{t.nav.newTrade}</button>
        </div>
      </div>

      <div className="dash-top">
        <div className="card hero">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="hero-label">{t.dashboard.balance}</span>
            <MoreLink to="/analytics">{t.dashboard.toAnalytics}</MoreLink>
          </div>
          <div className="hero-value">{money(balance)}</div>
          <div className={`num ${pnlClass(stats.net)}`}>
            {money(stats.net, { sign: true })} · {pct((stats.net / settings.startingBalance) * 100)}
          </div>
          <div className="hero-strip">
            <div><div className="k">{t.dashboard.today}</div><div className={`v ${pnlClass(todayPnl)}`}>{money(todayPnl, { sign: true })}</div></div>
            <div><div className="k">{t.dashboard.thisMonth}</div><div className={`v ${pnlClass(monthPnl)}`}>{money(monthPnl, { sign: true })}</div></div>
          </div>
          <EquityChart data={curve} height={230} />
        </div>

        <div className="card flush stat-grid">
          <Stat label={t.dashboard.winRate} value={pct(stats.winRate)} sub={t.dashboard.winLoss(stats.wins, stats.losses, stats.count)} />
          <Stat label={t.dashboard.profitFactor} value={num(stats.profitFactor)} sub={t.dashboard.payoff(num(stats.payoff))} />
          <Stat label={t.dashboard.expectancy} value={money(stats.expectancy, { sign: true })} tone={stats.expectancy}
            sub={stats.avgR != null ? t.dashboard.avgR(num(stats.avgR)) : t.dashboard.perTrade} />
          <Stat label={t.dashboard.maxDrawdown} value={money(-stats.maxDrawdown)} tone={-stats.maxDrawdown} sub={pct(stats.maxDrawdownPct)} />
          <Stat label={t.dashboard.streak} value={streak === 0 ? '—' : t.dashboard.streakValue(Math.abs(streak), streak > 0)} tone={streak}
            sub={t.dashboard.streakRecord(stats.maxWinStreak, stats.maxLossStreak)} />
          <Stat label={t.analytics.m.greenDays} value={pct(stats.tradingDays ? (stats.greenDays / stats.tradingDays) * 100 : 0, 0)}
            sub={t.common.of(stats.greenDays, stats.tradingDays)} />
        </div>
      </div>

      <div className="dash-bottom">
        <div className="card">
          <div className="card-head"><h2>{t.dashboard.recent}</h2><MoreLink to="/trades">{t.dashboard.allTrades}</MoreLink></div>
          <TradeTable trades={sortByExit(closed).slice(-8)} compact sortable={false} />
        </div>

        <div className="stack" style={{ gap: 16 }}>
          <div className="card">
            <div className="card-head"><h2>{t.dashboard.strategies}</h2><MoreLink to="/strategies">{t.dashboard.all}</MoreLink></div>
            {byStrategy.map(({ id, s, stats: st }) => {
              const share = Math.abs(st.net) / maxStrategyAbs
              return (
                <div key={id} className="strategy-row">
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <span className="row" style={{ gap: 8 }}><span className="dot" style={{ background: s?.color ?? 'var(--faint)' }} />{s?.name ?? t.common.noStrategy}</span>
                    <span className={`num ${pnlClass(st.net)}`}>{money(st.net, { sign: true })}</span>
                  </div>
                  <div className="bar-bg" style={{ margin: '8px 0 6px' }}>
                    <div className="bar-fg" style={{ width: `${share * 100}%`, background: st.net < 0 ? 'var(--neg)' : s?.color ?? 'var(--faint)' }} />
                  </div>
                  <div className="hint">{t.dashboard.strategyLine(st.count, pct(st.winRate, 0), num(st.profitFactor))}</div>
                </div>
              )
            })}
          </div>

          <div className="card">
            <div className="card-head"><h2>{t.dashboard.openPositions}</h2><span className="count-pill">{open.length}</span></div>
            {open.length === 0 ? <div className="hint">{t.dashboard.noOpen}</div> : open.map((tr) => (
              <button key={tr.id} className="position-row" onClick={() => show(tr)}>
                <span>
                  <b>{tr.symbol}</b>{' '}
                  <span className={`badge ${tr.direction}`}>{tr.direction === 'long' ? 'LONG' : 'SHORT'}</span>
                </span>
                <span className="hint num">{price(tr.entryPrice)} · {fmtDateTime(tr.entryDate)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
