import { useState } from 'react'
import { ArrowDownRight01Icon, ArrowUpRight01Icon, Image01Icon } from '@hugeicons/core-free-icons'
import { useNavigate } from 'react-router-dom'
import { MOBILE, useMedia } from '../lib/useMedia'
import { create } from 'zustand'
import { holdMinutes, isClosed, netPnl, rMultiple } from '../lib/calc'
import { label, useT } from '../i18n'
import { duration, fmtDateTime, pnlClass, price, rFmt, useMoney } from '../lib/format'
import { useStore } from '../store'
import type { Trade } from '../types'
import { Icon } from './Icon'
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
  const navigate = useNavigate()
  const money = useMoney()
  const t = useT()
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'date', dir: -1 })
  const mobile = useMedia(MOBILE)
  const sMap = new Map(strategies.map((s) => [s.id, s]))

  const val = (x: Trade): string | number => {
    switch (sort.key) {
      case 'symbol': return x.symbol
      case 'pnl': return netPnl(x)
      case 'r': return rMultiple(x) ?? -Infinity
      default: return x.exitDate ?? x.entryDate
    }
  }
  const rows = [...trades].sort((a, b) => {
    const x = val(a), y = val(b)
    return (x < y ? -1 : x > y ? 1 : 0) * sort.dir
  })

  if (mobile) {
    return (
      <div className="trade-cards">
        {rows.map((tr) => {
          const p = netPnl(tr)
          const st = tr.strategyId ? sMap.get(tr.strategyId) : undefined
          return (
            <button key={tr.id} className="trade-card" onClick={() => navigate(`/trade/${tr.id}`)}>
              <span className="trade-card-main">
                <span className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                  <b>{tr.symbol}</b>
                  <span className={`badge ${tr.direction}`}>{tr.direction === 'long' ? 'L' : 'S'}</span>
                  {(tr.leverage ?? 1) > 1 && <span className="badge lev">{tr.leverage}×</span>}
                  {tr.status === 'open' && <span className="badge open">OPEN</span>}
                </span>
                <span className="hint">
                  {fmtDateTime(tr.exitDate ?? tr.entryDate)}{st ? ` · ${st.name}` : ''}
                </span>
              </span>
              <span className="trade-card-side">
                <span className={`num ${pnlClass(p)}`}>{isClosed(tr) ? money(p, { sign: true }) : '—'}</span>
                <span className={`hint num ${pnlClass(rMultiple(tr) ?? 0)}`}>{rFmt(rMultiple(tr))}</span>
              </span>
            </button>
          )
        })}
      </div>
    )
  }

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
            {th('date', t.table.date)}
            {th('symbol', t.table.symbol)}
            <th>{t.table.side}</th>
            {!compact && <th>{t.table.strategy}</th>}
            {!compact && <th className="r">{t.table.entry}</th>}
            {!compact && <th className="r">{t.table.exit}</th>}
            {!compact && <th className="r">{t.table.qty}</th>}
            {!compact && <th>{t.table.duration}</th>}
            {th('r', 'R', 'r')}
            {th('pnl', 'P&L', 'r')}
            {!compact && <th>{t.table.tags}</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((tr) => {
            const p = netPnl(tr)
            const st = tr.strategyId ? sMap.get(tr.strategyId) : undefined
            return (
              <tr key={tr.id} onClick={() => navigate(`/trade/${tr.id}`)}>
                <td className="muted">{fmtDateTime(tr.exitDate ?? tr.entryDate)}</td>
                <td><b>{tr.symbol}</b></td>
                <td>
                  <span className={`badge ${tr.direction}`}><Icon icon={tr.direction === 'long' ? ArrowUpRight01Icon : ArrowDownRight01Icon} size={12} strokeWidth={2.2} />{tr.direction === 'long' ? 'LONG' : 'SHORT'}</span>{' '}
                  {(tr.leverage ?? 1) > 1 && <span className="badge lev">{tr.leverage}×</span>}{' '}
                  {tr.status === 'open' && <span className="badge open">OPEN</span>}
                </td>
                {!compact && (
                  <td>{st ? <span className="row" style={{ gap: 6, flexWrap: 'nowrap' }}><span className="dot" style={{ background: st.color }} />{st.name}</span> : <span className="muted">—</span>}</td>
                )}
                {!compact && <td className="r num">{price(tr.entryPrice)}</td>}
                {!compact && <td className="r num">{price(tr.exitPrice)}</td>}
                {!compact && <td className="r num">{price(tr.quantity)}</td>}
                {!compact && <td className="muted">{duration(holdMinutes(tr))}</td>}
                <td className={`r num ${pnlClass(rMultiple(tr) ?? 0)}`}>{rFmt(rMultiple(tr))}</td>
                <td className={`r num ${pnlClass(p)}`}>{isClosed(tr) ? money(p, { sign: true }) : '—'}</td>
                {!compact && (
                  <td>
                    <div className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
                      {tr.mistakes.slice(0, 2).map((m) => <span key={m} className="tag bad">{label(t.mistakes, m)}</span>)}
                      {tr.tags.slice(0, 2).map((m) => <span key={m} className="tag">{m}</span>)}
                      {tr.screenshots.length > 0 && <span className="muted row" title={t.table.hasScreenshots}><Icon icon={Image01Icon} size={15} /></span>}
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
