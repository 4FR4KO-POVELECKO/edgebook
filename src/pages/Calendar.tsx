import { useMemo, useState } from 'react'
import { TradeTable, useTradeModal } from '../components/TradeTable'
import { Stars } from '../components/ui'
import { computeStats, groupBy, isClosed, netPnl, sum, tradeDay } from '../lib/calc'
import { pct, pnlClass, useMoney, ymd } from '../lib/format'
import { useStore } from '../store'

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']

function cellBg(v: number, max: number) {
  if (!v || !max) return undefined
  const a = 0.12 + 0.5 * Math.min(1, Math.abs(v) / max)
  return v > 0 ? `rgba(34,195,166,${a})` : `rgba(240,97,109,${a})`
}

export default function CalendarPage() {
  const { trades, dayNotes } = useStore()
  const money = useMoney()
  const today = ymd(new Date())
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [selected, setSelected] = useState<string>(today)

  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const byDay = useMemo(() => groupBy(trades, tradeDay), [trades])
  const dayPnl = (d: string) => sum((byDay.get(d) ?? []).filter(isClosed).map(netPnl))

  // 6x7 grid starting on Monday
  const first = new Date(year, month, 1)
  const start = new Date(first)
  start.setDate(1 - ((first.getDay() + 6) % 7))
  const days = Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d })
  const weeks = Array.from({ length: 6 }, (_, w) => days.slice(w * 7, w * 7 + 7)).filter((w) => w.some((d) => d.getMonth() === month))

  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`
  const monthTrades = trades.filter((t) => tradeDay(t).startsWith(monthKey))
  const mStats = computeStats(monthTrades)
  const maxAbs = Math.max(0, ...days.filter((d) => d.getMonth() === month).map((d) => Math.abs(dayPnl(ymd(d)))))

  const yearMonths = MONTHS.map((_, i) => {
    const k = `${year}-${String(i + 1).padStart(2, '0')}`
    const ts = trades.filter((t) => isClosed(t) && tradeDay(t).startsWith(k))
    return { i, pnl: sum(ts.map(netPnl)), n: ts.length }
  })
  const yearMax = Math.max(0, ...yearMonths.map((m) => Math.abs(m.pnl)))
  const yearTotal = sum(yearMonths.map((m) => m.pnl))

  const move = (k: number) => setCursor(new Date(year, month + k, 1))

  return (
    <div className="stack">
      <div className="page-head">
        <h1>Календарь</h1>
        <div className="row">
          <button onClick={() => move(-1)}>←</button>
          <h2 style={{ minWidth: 150, textAlign: 'center' }}>{MONTHS[month]} {year}</h2>
          <button onClick={() => move(1)}>→</button>
          <button className="ghost" onClick={() => { const d = new Date(); setCursor(new Date(d.getFullYear(), d.getMonth(), 1)); setSelected(today) }}>Сегодня</button>
        </div>
      </div>

      <div className="kpis">
        <div className="card kpi"><div className="label">P&L за месяц</div><div className={`value ${pnlClass(mStats.net)}`}>{money(mStats.net, { sign: true })}</div></div>
        <div className="card kpi"><div className="label">Торговых дней</div><div className="value">{mStats.tradingDays}</div><div className="sub"><span className="pos">{mStats.greenDays} в плюс</span> · <span className="neg">{mStats.tradingDays - mStats.greenDays} в минус</span></div></div>
        <div className="card kpi"><div className="label">Сделок</div><div className="value">{mStats.count}</div><div className="sub">Win rate {pct(mStats.winRate)}</div></div>
        <div className="card kpi"><div className="label">Лучший / худший день</div><div className="value small" style={{ fontSize: 15 }}>
          {(() => {
            const vals = [...new Set(monthTrades.map(tradeDay))].map(dayPnl)
            return vals.length ? <><span className="pos">{money(Math.max(...vals), { sign: true })}</span> / <span className="neg">{money(Math.min(...vals), { sign: true })}</span></> : '—'
          })()}
        </div></div>
      </div>

      <div className="card">
        <div className="cal">
          {WEEKDAYS.map((w) => <div key={w} className="cal-h">{w}</div>)}
          <div className="cal-h">Неделя</div>
          {weeks.map((week, wi) => {
            const wTrades = week.flatMap((d) => (byDay.get(ymd(d)) ?? []).filter(isClosed))
            const wPnl = sum(wTrades.map(netPnl))
            return [
              ...week.map((d) => {
                const key = ymd(d)
                const ts = byDay.get(key) ?? []
                const p = dayPnl(key)
                const closedN = ts.filter(isClosed).length
                const wr = closedN ? (ts.filter((t) => isClosed(t) && netPnl(t) > 0).length / closedN) * 100 : 0
                return (
                  <div key={key}
                    className={`cal-cell ${d.getMonth() !== month ? 'out' : ''} ${key === today ? 'today' : ''} ${key === selected ? 'sel' : ''}`}
                    style={{ background: cellBg(p, maxAbs) }}
                    onClick={() => setSelected(key)}>
                    <div className="d"><span>{d.getDate()}</span>{dayNotes[key] && <span className="note-mark" title="Есть заметка" />}</div>
                    {ts.length > 0 && (
                      <>
                        <div className="p">{closedN ? money(p, { sign: true, compact: true }) : ''}</div>
                        <div className="c">{ts.length} сд.{closedN ? ` · ${Math.round(wr)}%` : ''}</div>
                      </>
                    )}
                  </div>
                )
              }),
              <div key={`w${wi}`} className="cal-week">
                <div className="muted">Нед. {wi + 1}</div>
                <div className={`p ${pnlClass(wPnl)}`}>{wTrades.length ? money(wPnl, { sign: true, compact: true }) : '—'}</div>
                <div className="muted">{wTrades.length} сд.</div>
              </div>,
            ]
          })}
        </div>
      </div>

      <DayPanel date={selected} />

      <div className="card">
        <div className="card-head"><h2>{year} по месяцам</h2><span className={`num ${pnlClass(yearTotal)}`}>{money(yearTotal, { sign: true })}</span></div>
        <div className="months">
          {yearMonths.map((m) => (
            <div key={m.i} className="month-cell" style={{ background: cellBg(m.pnl, yearMax), outline: m.i === month ? '1px solid var(--accent)' : undefined }}
              onClick={() => setCursor(new Date(year, m.i, 1))}>
              <div className="m">{MONTHS[m.i]}</div>
              <div className={`p ${m.n ? '' : 'muted'}`}>{m.n ? money(m.pnl, { sign: true, compact: true }) : '—'}</div>
              <div className="hint">{m.n} сделок</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function DayPanel({ date }: { date: string }) {
  const { trades, dayNotes, setDayNote } = useStore()
  const show = useTradeModal((s) => s.show)
  const money = useMoney()
  const note = dayNotes[date] ?? { date, plan: '', review: '' }
  const ts = trades.filter((t) => tradeDay(t) === date)
  const pnl = sum(ts.filter(isClosed).map(netPnl))
  const label = new Date(date + 'T12:00').toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="grid g2">
      <div className="card">
        <div className="card-head">
          <h2 style={{ textTransform: 'capitalize' }}>{label}</h2>
          <div className="row">
            {ts.length > 0 && <span className={`num ${pnlClass(pnl)}`}>{money(pnl, { sign: true })}</span>}
            <button className="sm" onClick={() => show(undefined, { entryDate: `${date}T10:00`, exitDate: `${date}T11:00` })}>+ Сделка</button>
          </div>
        </div>
        {ts.length ? <TradeTable trades={ts} compact sortable={false} /> : <div className="hint">В этот день сделок нет</div>}
      </div>
      <div className="card">
        <div className="card-head"><h2>Дневник дня</h2><div className="row small muted">Настроение <Stars value={note.mood} onChange={(mood) => setDayNote({ ...note, mood })} /></div></div>
        <div className="stack" style={{ gap: 10 }}>
          <label className="field"><span>План на день: сетапы, уровни, лимиты</span>
            <textarea value={note.plan} onChange={(e) => setDayNote({ ...note, plan: e.target.value })} placeholder="Что смотрю сегодня, максимальный дневной убыток, какие правила соблюдаю…" />
          </label>
          <label className="field"><span>Итоги дня: что получилось, что нет</span>
            <textarea value={note.review} onChange={(e) => setDayNote({ ...note, review: e.target.value })} placeholder="Следовал ли плану? Что сделать иначе завтра?" />
          </label>
        </div>
      </div>
    </div>
  )
}
