import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { EquityChart } from '../components/charts'
import { TradeTable, useTradeModal } from '../components/TradeTable'
import { Empty, Kpi } from '../components/ui'
import { computeStats, equityCurve, groupBy, isClosed, netPnl, sortByExit, sum, tradeDay } from '../lib/calc'
import { makeDemo } from '../lib/demo'
import { num, pct, pnlClass, useMoney, ymd } from '../lib/format'
import { useStore } from '../store'

export default function Dashboard() {
  const { trades, strategies, settings, restore, dayNotes } = useStore()
  const show = useTradeModal((s) => s.show)
  const money = useMoney()

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
        <Empty title="Дневник пока пуст">
          <p>Добавь первую сделку или загрузи демо-данные, чтобы посмотреть, как всё работает.</p>
          <div className="row" style={{ justifyContent: 'center', marginTop: 16 }}>
            <button className="primary" onClick={() => show()}>+ Добавить сделку</button>
            <button onClick={() => restore({ ...makeDemo(), settings })}>Загрузить демо-данные</button>
          </div>
        </Empty>
      </div>
    )
  }

  const hasTodayNote = !!dayNotes[today]?.plan

  return (
    <div className="stack">
      <div className="page-head">
        <h1>Обзор</h1>
        <div className="row">
          {!hasTodayNote && <Link to="/calendar" className="btn">📝 План на сегодня</Link>}
          <button className="primary" onClick={() => show()}>+ Сделка</button>
        </div>
      </div>

      <div className="kpis">
        <Kpi label="Баланс" value={money(settings.startingBalance + stats.net)} sub={<span className={pnlClass(stats.net)}>{money(stats.net, { sign: true })} · {pct((stats.net / settings.startingBalance) * 100)}</span>} />
        <Kpi label="Сегодня" value={money(todayPnl, { sign: true })} tone={todayPnl} />
        <Kpi label="Этот месяц" value={money(monthPnl, { sign: true })} tone={monthPnl} />
        <Kpi label="Win rate" value={pct(stats.winRate)} sub={`${stats.wins} / ${stats.losses} · ${stats.count} сделок`} />
        <Kpi label="Profit factor" value={num(stats.profitFactor)} sub={`Payoff ${num(stats.payoff)}`} />
        <Kpi label="Матожидание" value={money(stats.expectancy, { sign: true })} tone={stats.expectancy} sub={stats.avgR != null ? `${num(stats.avgR)}R в среднем` : 'на сделку'} />
        <Kpi label="Макс. просадка" value={money(-stats.maxDrawdown)} tone={-stats.maxDrawdown} sub={pct(stats.maxDrawdownPct)} />
        <Kpi label="Текущая серия" value={streak === 0 ? '—' : `${Math.abs(streak)} ${streak > 0 ? 'побед' : 'убытков'}`} tone={streak} sub={`Рекорд: ${stats.maxWinStreak}W / ${stats.maxLossStreak}L`} />
      </div>

      <div className="grid g3">
        <div className="card span2">
          <div className="card-head"><h2>Кривая баланса</h2><Link to="/analytics" className="small">Аналитика →</Link></div>
          <EquityChart data={curve} />
        </div>
        <div className="card">
          <div className="card-head"><h2>Стратегии</h2><Link to="/strategies" className="small">Все →</Link></div>
          {byStrategy.map(({ id, s, stats: st }) => (
            <div key={id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="row" style={{ gap: 6 }}><span className="dot" style={{ background: s?.color ?? '#8a94a3' }} />{s?.name ?? 'Без стратегии'}</span>
                <span className={`num ${pnlClass(st.net)}`}>{money(st.net, { sign: true })}</span>
              </div>
              <div className="hint">{st.count} сделок · WR {pct(st.winRate, 0)} · PF {num(st.profitFactor)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid g3">
        <div className="card span2">
          <div className="card-head"><h2>Последние сделки</h2><Link to="/trades" className="small">Все сделки →</Link></div>
          <TradeTable trades={sortByExit(closed).slice(-8)} compact sortable={false} />
        </div>
        <div className="card">
          <div className="card-head"><h2>Открытые позиции</h2><span className="muted">{open.length}</span></div>
          {open.length === 0 ? <div className="hint">Нет открытых позиций</div> : <TradeTable trades={open} compact sortable={false} />}
        </div>
      </div>
    </div>
  )
}
