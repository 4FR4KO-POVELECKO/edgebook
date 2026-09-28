import { useMemo, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Add01Icon, ArrowRight02Icon, Calendar03Icon, Note01Icon, Notebook01Icon, SparklesIcon, Target02Icon } from '@hugeicons/core-free-icons'
import { Logo } from '../components/Logo'
import { EquityChart } from '../components/charts'
import { Icon } from '../components/Icon'
import { TradeTable, useTradeModal } from '../components/TradeTable'
import { Sparkline, Delta } from '../components/Sparkline'
import { comparePeriods, computeStats, equityCurve, groupBy, isClosed, netPnl, sortByExit, sum, tradeDay, weeklyStats, type Stats } from '../lib/calc'
import { makeDemo } from '../lib/demo'
import { fmtDateTime, num, pct, pnlClass, price, useMoney, ymd } from '../lib/format'
import { useT } from '../i18n'
import { useStore } from '../store'

function Stat({ label, value, sub, tone, delta, spark }: {
  label: string; value: ReactNode; sub?: ReactNode; tone?: number; delta?: ReactNode; spark?: ReactNode
}) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="stat-value-row">
        <span className={`value ${tone != null ? pnlClass(tone) : ''}`}>{value}</span>
        {delta}
      </div>
      {sub != null && <div className="sub">{sub}</div>}
      {spark && <div className="stat-spark">{spark}</div>}
    </div>
  )
}

function MoreLink({ to, children }: { to: string; children: ReactNode }) {
  return <Link to={to} className="more">{children}<Icon icon={ArrowRight02Icon} size={14} /></Link>
}

export default function Dashboard() {
  const { trades, strategies, settings, restore, dayNotes } = useStore()
  const show = useTradeModal((s) => s.show)
  const navigate = useNavigate()
  const money = useMoney()
  const t = useT()

  const stats = useMemo(() => computeStats(trades, settings.startingBalance), [trades, settings.startingBalance])
  const curve = useMemo(() => equityCurve(trades, settings.startingBalance), [trades, settings.startingBalance])
  const weeks = useMemo(() => weeklyStats(trades), [trades])
  const { current: cur, previous: prev } = useMemo(() => comparePeriods(trades), [trades])
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

  // context for stat cards: weekly trend + last 30 days vs the 30 before
  const finite = (v: number | undefined) => (v != null && Number.isFinite(v) ? v : undefined)
  const greenPct = (s: Stats) => (s.tradingDays ? (s.greenDays / s.tradingDays) * 100 : undefined)
  const series = (f: (s: Stats) => number | undefined) => weeks.map((w) => (w.count ? finite(f(w)) : undefined))
  const delta = (f: (s: Stats) => number | undefined, fmt: (v: number) => string, higherIsBetter = true) => {
    const a = cur.count ? finite(f(cur)) : undefined
    const b = prev.count ? finite(f(prev)) : undefined
    if (a == null || b == null) return undefined
    const d = a - b
    return <Delta value={d} text={fmt(Math.abs(d))} good={higherIsBetter ? d >= 0 : d <= 0} title={t.dashboard.vsPrev} />
  }
  const spark = (f: (s: Stats) => number | undefined) => <Sparkline values={series(f)} />

  if (trades.length === 0) {
    const [s1, s2, s3] = t.dashboard.steps
    return (
      <div className="onboarding">
        <div className="onboarding-head">
          <div className="onboarding-logo"><Logo size={40} /></div>
          <h1>{t.dashboard.onboardingTitle}</h1>
          <p className="muted">{t.dashboard.onboardingText}</p>
        </div>
        <div className="steps">
          <div className="card step">
            <span className="step-n">1</span>
            <Icon icon={Target02Icon} size={22} className="step-icon" />
            <h3>{s1.title}</h3>
            <p>{s1.text}</p>
            <Link to="/strategies" className="btn">{s1.cta}</Link>
          </div>
          <div className="card step">
            <span className="step-n">2</span>
            <Icon icon={Notebook01Icon} size={22} className="step-icon" />
            <h3>{s2.title}</h3>
            <p>{s2.text}</p>
            <button className="primary" onClick={() => show()}><Icon icon={Add01Icon} />{s2.cta}</button>
          </div>
          <div className="card step">
            <span className="step-n">3</span>
            <Icon icon={Calendar03Icon} size={22} className="step-icon" />
            <h3>{s3.title}</h3>
            <p>{s3.text}</p>
            <Link to="/calendar" className="btn">{s3.cta}</Link>
          </div>
        </div>
        <div className="onboarding-demo">
          <span className="muted">{t.dashboard.orDemo}</span>
          <button onClick={() => restore({ ...makeDemo(), settings })}><Icon icon={SparklesIcon} />{t.dashboard.loadDemo}</button>
        </div>
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
          <button className="primary desktop-only" onClick={() => show()}><Icon icon={Add01Icon} />{t.nav.newTrade}</button>
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
          <Stat label={t.dashboard.winRate} value={pct(stats.winRate)} sub={t.dashboard.winLoss(stats.wins, stats.losses, stats.count)}
            delta={delta((s) => s.winRate, (v) => pct(v))} spark={spark((s) => s.winRate)} />
          <Stat label={t.dashboard.profitFactor} value={num(stats.profitFactor)} sub={t.dashboard.payoff(num(stats.payoff))}
            delta={delta((s) => s.profitFactor, (v) => num(v))} spark={spark((s) => s.profitFactor)} />
          <Stat label={t.dashboard.expectancy} value={money(stats.expectancy, { sign: true })} tone={stats.expectancy}
            sub={stats.avgR != null ? t.dashboard.avgR(num(stats.avgR)) : t.dashboard.perTrade}
            delta={delta((s) => s.expectancy, (v) => money(v))} spark={spark((s) => s.expectancy)} />
          <Stat label={t.dashboard.maxDrawdown} value={money(-stats.maxDrawdown)} tone={-stats.maxDrawdown} sub={pct(stats.maxDrawdownPct)}
            delta={delta((s) => s.maxDrawdown, (v) => money(v), false)} spark={<Sparkline values={series((s) => -s.maxDrawdown)} color="var(--neg)" />} />
          <Stat label={t.dashboard.streak} value={streak === 0 ? '—' : t.dashboard.streakValue(Math.abs(streak), streak > 0)} tone={streak}
            sub={t.dashboard.streakRecord(stats.maxWinStreak, stats.maxLossStreak)}
            spark={<Sparkline values={sorted.slice(-20).map(netPnl)} bars />} />
          <Stat label={t.analytics.m.greenDays} value={pct(stats.tradingDays ? (stats.greenDays / stats.tradingDays) * 100 : 0, 0)}
            sub={t.common.of(stats.greenDays, stats.tradingDays)}
            delta={delta(greenPct, (v) => pct(v, 0))} spark={spark(greenPct)} />
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
              <button key={tr.id} className="position-row" onClick={() => navigate(`/trade/${tr.id}`)}>
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
