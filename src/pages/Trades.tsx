import { useMemo, useRef, useState } from 'react'
import { TradeTable, useTradeModal } from '../components/TradeTable'
import { Empty } from '../components/ui'
import { computeStats, netPnl, tradeDay } from '../lib/calc'
import { num, pct, pnlClass, useMoney, ymd } from '../lib/format'
import { csvToTrades, download, tradesToCsv } from '../lib/io'
import { useStore } from '../store'

export default function Trades() {
  const { trades, strategies, importTrades } = useStore()
  const show = useTradeModal((s) => s.show)
  const money = useMoney()
  const fileRef = useRef<HTMLInputElement>(null)
  const [q, setQ] = useState('')
  const [strategy, setStrategy] = useState('')
  const [dir, setDir] = useState('')
  const [result, setResult] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [tag, setTag] = useState('')

  const allTags = useMemo(() => [...new Set(trades.flatMap((t) => [...t.tags, ...t.mistakes]))].sort(), [trades])

  const filtered = trades.filter((t) => {
    if (q && !t.symbol.includes(q.toUpperCase()) && !t.notes.toLowerCase().includes(q.toLowerCase())) return false
    if (strategy && (strategy === '-' ? t.strategyId : t.strategyId !== strategy)) return false
    if (dir && t.direction !== dir) return false
    if (result === 'open' && t.status !== 'open') return false
    if (result === 'win' && !(t.status === 'closed' && netPnl(t) > 0)) return false
    if (result === 'loss' && !(t.status === 'closed' && netPnl(t) < 0)) return false
    if (from && tradeDay(t) < from) return false
    if (to && tradeDay(t) > to) return false
    if (tag && !t.tags.includes(tag) && !t.mistakes.includes(tag)) return false
    return true
  })
  const st = computeStats(filtered)
  const anyFilter = q || strategy || dir || result || from || to || tag

  const onImport = async (f?: File) => {
    if (!f) return
    const text = await f.text()
    const { trades: parsed, errors, newStrategies } = csvToTrades(text, strategies)
    if (newStrategies.length) useStore.setState((s) => ({ strategies: [...s.strategies, ...newStrategies] }))
    importTrades(parsed)
    alert(`Импортировано сделок: ${parsed.length}${errors.length ? `\n\nОшибки:\n${errors.slice(0, 10).join('\n')}` : ''}`)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="stack">
      <div className="page-head">
        <h1>Сделки</h1>
        <div className="row">
          <button onClick={() => fileRef.current?.click()}>Импорт CSV</button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => onImport(e.target.files?.[0])} />
          <button disabled={!filtered.length} onClick={() => download(`trades-${ymd(new Date())}.csv`, tradesToCsv(filtered, strategies), 'text/csv')}>Экспорт CSV</button>
          <button className="primary" onClick={() => show()}>+ Сделка</button>
        </div>
      </div>

      <div className="card">
        <div className="row">
          <input style={{ width: 200 }} placeholder="Поиск: тикер или заметка" value={q} onChange={(e) => setQ(e.target.value)} />
          <select style={{ width: 170 }} value={strategy} onChange={(e) => setStrategy(e.target.value)}>
            <option value="">Все стратегии</option>
            <option value="-">Без стратегии</option>
            {strategies.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select style={{ width: 120 }} value={dir} onChange={(e) => setDir(e.target.value)}>
            <option value="">Long + Short</option>
            <option value="long">Long</option>
            <option value="short">Short</option>
          </select>
          <select style={{ width: 130 }} value={result} onChange={(e) => setResult(e.target.value)}>
            <option value="">Все результаты</option>
            <option value="win">Прибыльные</option>
            <option value="loss">Убыточные</option>
            <option value="open">Открытые</option>
          </select>
          <select style={{ width: 160 }} value={tag} onChange={(e) => setTag(e.target.value)}>
            <option value="">Любой тег / ошибка</option>
            {allTags.map((t) => <option key={t}>{t}</option>)}
          </select>
          <input type="date" style={{ width: 150 }} value={from} onChange={(e) => setFrom(e.target.value)} title="С" />
          <input type="date" style={{ width: 150 }} value={to} onChange={(e) => setTo(e.target.value)} title="По" />
          {anyFilter && <button className="ghost" onClick={() => { setQ(''); setStrategy(''); setDir(''); setResult(''); setFrom(''); setTo(''); setTag('') }}>Сбросить</button>}
        </div>
        <div className="row" style={{ marginTop: 12, gap: 20 }}>
          <span className="muted">Найдено: <b style={{ color: 'var(--text)' }}>{filtered.length}</b></span>
          <span className="muted">P&L: <b className={`num ${pnlClass(st.net)}`}>{money(st.net, { sign: true })}</b></span>
          <span className="muted">Win rate: <b style={{ color: 'var(--text)' }}>{pct(st.winRate)}</b></span>
          <span className="muted">PF: <b style={{ color: 'var(--text)' }}>{num(st.profitFactor)}</b></span>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {filtered.length ? <TradeTable trades={filtered} /> : (
          <Empty title={trades.length ? 'Ничего не найдено' : 'Сделок пока нет'}>
            {!trades.length && <p>Нажми «+ Сделка» или импортируй CSV. Формат колонок — в Настройках.</p>}
          </Empty>
        )}
      </div>
    </div>
  )
}
