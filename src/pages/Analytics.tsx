import { useMemo, useState, type ReactNode } from 'react'
import { DrawdownChart, EquityChart, PnlBars } from '../components/charts'
import { Empty, Seg } from '../components/ui'
import {
  computeStats, equityCurve, groupBy, holdMinutes, isClosed, netPnl, rMultiple, round2, sortByExit, sum, tradeDay, type Stats,
} from '../lib/calc'
import { duration, num, pct, pnlClass, rFmt, useMoney, ymd } from '../lib/format'
import { useStore } from '../store'
import type { Trade } from '../types'

type Period = 'all' | '30' | '90' | 'ytd'
const WD = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

export default function Analytics() {
  const { trades, strategies, settings } = useStore()
  const money = useMoney()
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

  const byWeekday = WD.map((name, i) => ({
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

  if (!trades.some(isClosed)) return <div className="card"><Empty title="Нет закрытых сделок для анализа" /></div>

  const sName = (id: string) => strategies.find((s) => s.id === id)?.name ?? 'Без стратегии'
  const sColor = (id: string) => strategies.find((s) => s.id === id)?.color

  // mistakes: cost & what-if
  const clean = filtered.filter((t) => t.mistakes.length === 0)
  const withMistakes = filtered.filter((t) => t.mistakes.length > 0)
  const mistakeCost = sum(withMistakes.map(netPnl))

  // checklist adherence: all strategy rules ticked vs not
  const withChecklist = filtered.filter((t) => Object.keys(t.checklist ?? {}).length > 0)
  const followed = withChecklist.filter((t) => Object.values(t.checklist).every(Boolean))
  const broken = withChecklist.filter((t) => !Object.values(t.checklist).every(Boolean))

  const holdBucket = (t: Trade) => {
    const m = holdMinutes(t) ?? 0
    return m < 15 ? '< 15 мин' : m < 60 ? '15–60 мин' : m < 240 ? '1–4 ч' : m < 1440 ? '4–24 ч' : '> 1 дня'
  }
  const holdOrder = ['< 15 мин', '15–60 мин', '1–4 ч', '4–24 ч', '> 1 дня']

  return (
    <div className="stack">
      <div className="page-head">
        <h1>Аналитика</h1>
        <div className="row">
          <Seg value={period} onChange={setPeriod} options={[{ value: '30', label: '30 дн' }, { value: '90', label: '90 дн' }, { value: 'ytd', label: 'С начала года' }, { value: 'all', label: 'Всё время' }]} />
          <select style={{ width: 170 }} value={strategy} onChange={(e) => setStrategy(e.target.value)}>
            <option value="">Все стратегии</option>
            <option value="-">Без стратегии</option>
            {strategies.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select style={{ width: 130 }} value={market} onChange={(e) => setMarket(e.target.value)}>
            <option value="">Все рынки</option>
            {markets.map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? <div className="card"><Empty title="Нет сделок под выбранные фильтры" /></div> : <>
        <MetricsGrid st={st} />

        <div className="card">
          <div className="card-head"><h2>Кривая баланса</h2><span className={`num ${pnlClass(st.net)}`}>{money(st.net, { sign: true })}</span></div>
          <EquityChart data={curve} height={280} />
          <div className="section-title" style={{ marginTop: 8 }}>Просадка</div>
          <DrawdownChart data={curve} />
        </div>

        <div className="card">
          <div className="card-head"><h2>P&L по дням</h2></div>
          <PnlBars data={daily} />
        </div>

        <div className="grid g2">
          <div className="card"><div className="card-head"><h2>По дням недели</h2></div><PnlBars data={byWeekday} height={220} /></div>
          <div className="card"><div className="card-head"><h2>По часу входа</h2></div><PnlBars data={byHour} height={220} /></div>
        </div>

        <div className="grid g2">
          <div className="card">
            <div className="card-head"><h2>Распределение R-multiple</h2><span className="muted small">{rFmt(st.totalR)} всего</span></div>
            {st.avgR == null ? <div className="hint">Укажи стоп-лосс в сделках, чтобы считать R</div> : <PnlBars data={rBuckets} unit="count" label="Сделок" height={220} />}
          </div>
          <div className="card">
            <div className="card-head"><h2>Long vs Short</h2></div>
            <Breakdown rows={[...groupBy(filtered, (t) => t.direction)].map(([k, ts]) => ({ key: k, label: k === 'long' ? '▲ Long' : '▼ Short', trades: ts }))} />
            <div className="section-title">Время удержания</div>
            <Breakdown rows={[...groupBy(filtered, holdBucket)].sort(([a], [b]) => holdOrder.indexOf(a) - holdOrder.indexOf(b)).map(([k, ts]) => ({ key: k, label: k, trades: ts }))} sort={false} />
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h2>По стратегиям</h2></div>
          <Breakdown rows={[...groupBy(filtered, (t) => t.strategyId ?? '')].map(([k, ts]) => ({
            key: k, trades: ts,
            label: <span className="row" style={{ gap: 6 }}><span className="dot" style={{ background: sColor(k) ?? '#8a94a3' }} />{sName(k)}</span>,
          }))} withR />
        </div>

        <div className="grid g2">
          <div className="card">
            <div className="card-head"><h2>Цена ошибок</h2><span className={`num ${pnlClass(mistakeCost)}`}>{money(mistakeCost, { sign: true })}</span></div>
            <div className="hint" style={{ marginBottom: 10 }}>
              Без сделок с ошибками результат был бы <b className={pnlClass(sum(clean.map(netPnl)))}>{money(sum(clean.map(netPnl)), { sign: true })}</b> вместо <b className={pnlClass(st.net)}>{money(st.net, { sign: true })}</b>.
              Win rate чистых сделок: <b>{pct(computeStats(clean).winRate)}</b>, с ошибками: <b>{pct(computeStats(withMistakes).winRate)}</b>.
            </div>
            {withMistakes.length ? <Breakdown rows={[...groupBy(withMistakes, (t) => t.mistakes)].map(([k, ts]) => ({ key: k, label: <span className="tag bad">{k}</span>, trades: ts }))} /> : <div className="hint">Ошибок не отмечено 👍</div>}
          </div>
          <div className="card">
            <div className="card-head"><h2>Дисциплина: чек-лист стратегии</h2></div>
            {withChecklist.length ? (
              <Breakdown rows={[
                { key: 'y', label: '✅ Все правила соблюдены', trades: followed },
                { key: 'n', label: '⚠️ Правила нарушены', trades: broken },
              ].filter((r) => r.trades.length)} />
            ) : <div className="hint">Отмечай правила стратегии в сделках, и здесь появится сравнение</div>}
            <div className="section-title">По эмоциям</div>
            <Breakdown rows={[...groupBy(filtered.filter((t) => t.emotion), (t) => t.emotion!)].map(([k, ts]) => ({ key: k, label: k, trades: ts }))} />
          </div>
        </div>

        <div className="grid g2">
          <div className="card">
            <div className="card-head"><h2>По тикерам</h2></div>
            <Breakdown rows={[...groupBy(filtered, (t) => t.symbol)].map(([k, ts]) => ({ key: k, label: <b>{k}</b>, trades: ts }))} limit={12} />
          </div>
          <div className="card">
            <div className="card-head"><h2>По тегам</h2></div>
            <Breakdown rows={[...groupBy(filtered.filter((t) => t.tags.length), (t) => t.tags)].map(([k, ts]) => ({ key: k, label: <span className="tag">{k}</span>, trades: ts }))} limit={12} />
            <div className="section-title">По оценке исполнения</div>
            <Breakdown rows={[...groupBy(filtered.filter((t) => t.rating), (t) => String(t.rating))].sort(([a], [b]) => Number(b) - Number(a)).map(([k, ts]) => ({ key: k, label: <span style={{ color: 'var(--warn)' }}>{'★'.repeat(Number(k))}</span>, trades: ts }))} sort={false} />
          </div>
        </div>
      </>}
    </div>
  )
}

function MetricsGrid({ st }: { st: Stats }) {
  const money = useMoney()
  const items: [string, ReactNode, number?][] = [
    ['Net P&L', money(st.net, { sign: true }), st.net],
    ['Сделок', st.count],
    ['Win rate', pct(st.winRate)],
    ['Profit factor', num(st.profitFactor)],
    ['Матожидание', money(st.expectancy, { sign: true }), st.expectancy],
    ['Средний R', rFmt(st.avgR), st.avgR],
    ['Средняя прибыль', money(st.avgWin), 1],
    ['Средний убыток', money(-st.avgLoss), -1],
    ['Payoff ratio', num(st.payoff)],
    ['Лучшая сделка', money(st.largestWin, { sign: true }), 1],
    ['Худшая сделка', money(st.largestLoss, { sign: true }), -1],
    ['Макс. просадка', `${money(-st.maxDrawdown)} · ${pct(st.maxDrawdownPct)}`, -1],
    ['Серии W / L', `${st.maxWinStreak} / ${st.maxLossStreak}`],
    ['Зелёных дней', `${st.greenDays} из ${st.tradingDays}`],
    ['Ср. удержание', duration(st.avgHoldMin)],
    ['Комиссии', money(-st.fees), st.fees ? -1 : 0],
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
  const data = rows.map((r) => ({ ...r, st: computeStats(sortByExit(r.trades)) }))
  if (sort) data.sort((a, b) => b.st.net - a.st.net)
  const shown = limit ? data.slice(0, limit) : data
  const maxAbs = Math.max(1, ...shown.map((r) => Math.abs(r.st.net)))
  if (!shown.length) return <div className="hint">Нет данных</div>
  return (
    <div className="table-wrap">
      <table className="plain">
        <thead>
          <tr>
            <th></th><th className="r">Сделок</th><th className="r">WR</th><th className="r">PF</th>
            {withR && <th className="r">Ср. R</th>}
            <th className="r">Ср. P&L</th><th className="r">Итого</th><th style={{ width: '22%' }}></th>
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
