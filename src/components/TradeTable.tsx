import { useState } from 'react'
import { create } from 'zustand'
import { holdMinutes, isClosed, netPnl, rMultiple } from '../lib/calc'
import { duration, fmtDateTime, pnlClass, price, rFmt, useMoney } from '../lib/format'
import { useStore } from '../store'
import type { Trade } from '../types'
import { TradeForm, type TradeDraft } from './TradeForm'

/** Global trade editor, so any page can open it. */
export const useTradeModal = create<{
  open: boolean
  trade?: Trade
  defaults?: Partial<TradeDraft>
  show: (trade?: Trade, defaults?: Partial<TradeDraft>) => void
  hide: () => void
}>((set) => ({
  open: false,
  show: (trade, defaults) => set({ open: true, trade, defaults }),
  hide: () => set({ open: false, trade: undefined, defaults: undefined }),
}))

export function TradeModalHost() {
  const { open, trade, defaults, hide } = useTradeModal()
  return open ? <TradeForm key={trade?.id ?? 'new'} trade={trade} defaults={defaults} onClose={hide} /> : null
}

type SortKey = 'date' | 'symbol' | 'pnl' | 'r'

export function TradeTable({ trades, compact, sortable = true }: { trades: Trade[]; compact?: boolean; sortable?: boolean }) {
  const strategies = useStore((s) => s.strategies)
  const show = useTradeModal((s) => s.show)
  const money = useMoney()
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'date', dir: -1 })
  const sMap = new Map(strategies.map((s) => [s.id, s]))

  const val = (t: Trade): string | number => {
    switch (sort.key) {
      case 'symbol': return t.symbol
      case 'pnl': return netPnl(t)
      case 'r': return rMultiple(t) ?? -Infinity
      default: return t.exitDate ?? t.entryDate
    }
  }
  const rows = [...trades].sort((a, b) => {
    const x = val(a), y = val(b)
    return (x < y ? -1 : x > y ? 1 : 0) * sort.dir
  })

  const th = (key: SortKey, label: string, cls = '') => (
    <th className={`${sortable ? 'sortable' : ''} ${cls}`} onClick={() => sortable && setSort((s) => ({ key, dir: s.key === key ? (-s.dir as 1 | -1) : -1 }))}>
      {label}{sortable && sort.key === key ? (sort.dir === 1 ? ' ↑' : ' ↓') : ''}
    </th>
  )

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {th('date', 'Дата')}
            {th('symbol', 'Тикер')}
            <th>Сторона</th>
            {!compact && <th>Стратегия</th>}
            {!compact && <th className="r">Вход</th>}
            {!compact && <th className="r">Выход</th>}
            {!compact && <th className="r">Объём</th>}
            {!compact && <th>Время</th>}
            {th('r', 'R', 'r')}
            {th('pnl', 'P&L', 'r')}
            {!compact && <th>Теги</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => {
            const p = netPnl(t)
            const st = t.strategyId ? sMap.get(t.strategyId) : undefined
            return (
              <tr key={t.id} onClick={() => show(t)}>
                <td className="muted">{fmtDateTime(t.exitDate ?? t.entryDate)}</td>
                <td><b>{t.symbol}</b></td>
                <td>
                  <span className={`badge ${t.direction}`}>{t.direction === 'long' ? 'LONG' : 'SHORT'}</span>{' '}
                  {t.status === 'open' && <span className="badge open">OPEN</span>}
                </td>
                {!compact && (
                  <td>{st ? <span className="row" style={{ gap: 6, flexWrap: 'nowrap' }}><span className="dot" style={{ background: st.color }} />{st.name}</span> : <span className="muted">—</span>}</td>
                )}
                {!compact && <td className="r num">{price(t.entryPrice)}</td>}
                {!compact && <td className="r num">{price(t.exitPrice)}</td>}
                {!compact && <td className="r num">{price(t.quantity)}</td>}
                {!compact && <td className="muted">{duration(holdMinutes(t))}</td>}
                <td className={`r num ${pnlClass(rMultiple(t) ?? 0)}`}>{rFmt(rMultiple(t))}</td>
                <td className={`r num ${pnlClass(p)}`}>{isClosed(t) ? money(p, { sign: true }) : '—'}</td>
                {!compact && (
                  <td>
                    <div className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
                      {t.mistakes.slice(0, 2).map((m) => <span key={m} className="tag bad">{m}</span>)}
                      {t.tags.slice(0, 2).map((m) => <span key={m} className="tag">{m}</span>)}
                      {t.screenshots.length > 0 && <span className="muted" title="Есть скриншоты">🖼</span>}
                    </div>
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
