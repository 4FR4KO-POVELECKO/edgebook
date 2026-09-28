import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Alert02Icon, ArrowDownRight01Icon, ArrowLeft01Icon, ArrowLeft02Icon, ArrowRight01Icon, ArrowUpRight01Icon,
  CheckmarkCircle02Icon, PencilEdit02Icon, Search01Icon,
} from '@hugeicons/core-free-icons'
import { Icon } from '../components/Icon'
import { useTradeModal } from '../components/TradeTable'
import { Empty, Lightbox, Stars } from '../components/ui'
import { holdMinutes, isClosed, leverageOf, liquidationPrice, marginUsed, netPnl, plannedRR, returnPct, riskAmount, rMultiple, roePct } from '../lib/calc'
import { duration, fmtDateTime, num, pnlClass, price, rFmt, useMoney } from '../lib/format'
import { label, useT } from '../i18n'
import { MOBILE, useMedia } from '../lib/useMedia'
import { useStore } from '../store'
import type { Trade } from '../types'

const byTime = (a: Trade, b: Trade) => (a.exitDate ?? a.entryDate).localeCompare(b.exitDate ?? b.entryDate)

export default function TradePage() {
  const { id } = useParams()
  const t = useT()
  const money = useMoney()
  const navigate = useNavigate()
  const show = useTradeModal((s) => s.show)
  const { trades, strategies } = useStore()
  const [lightbox, setLightbox] = useState<string>()

  const trade = trades.find((x) => x.id === id)
  if (!trade) {
    return (
      <div className="card">
        <Empty title={t.tradePage.notFound} icon={Search01Icon}>
          <p>{t.tradePage.notFoundText}</p>
          <Link to="/trades" className="btn" style={{ marginTop: 12 }}>{t.tradePage.toTrades}</Link>
        </Empty>
      </div>
    )
  }

  const ordered = [...trades].sort(byTime)
  const idx = ordered.findIndex((x) => x.id === trade.id)
  const prev = ordered[idx - 1]
  const next = ordered[idx + 1]
  const strategy = strategies.find((s) => s.id === trade.strategyId)
  const closed = isClosed(trade)
  const pnl = netPnl(trade)
  const r = rMultiple(trade)
  const rules = strategy?.rules.filter((rule) => rule in (trade.checklist ?? {})) ?? []
  const lev = leverageOf(trade)

  return (
    <div className="stack">
      <div className="page-head" style={{ alignItems: 'flex-start' }}>
        <div>
          <button className="ghost sm back-btn" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/trades'))}>
            <Icon icon={ArrowLeft02Icon} size={14} />{t.tradePage.back}
          </button>
          <div className="row" style={{ gap: 10, marginTop: 6 }}>
            <h1>{trade.symbol}</h1>
            <span className={`badge ${trade.direction}`}>
              <Icon icon={trade.direction === 'long' ? ArrowUpRight01Icon : ArrowDownRight01Icon} size={12} strokeWidth={2.2} />
              {trade.direction === 'long' ? 'LONG' : 'SHORT'}
            </span>
            {lev > 1 && <span className="badge lev">{num(lev, lev % 1 ? 1 : 0)}×</span>}
            {!closed && <span className="badge open">OPEN</span>}
          </div>
          <div className="row muted small" style={{ marginTop: 6, gap: 8 }}>
            <span>{label(t.markets, trade.market)}</span>
            {strategy && <><span>·</span><span className="row" style={{ gap: 6 }}><span className="dot" style={{ background: strategy.color }} />{strategy.name}</span></>}
            <span>·</span>
            <span>{fmtDateTime(trade.entryDate)}{trade.exitDate ? ` → ${fmtDateTime(trade.exitDate)}` : ''}</span>
          </div>
        </div>
        <div className="row">
          <button className="icon-btn" disabled={!prev} title={t.tradePage.prev} aria-label={t.tradePage.prev} onClick={() => prev && navigate(`/trade/${prev.id}`, { replace: true })}>
            <Icon icon={ArrowLeft01Icon} />
          </button>
          <button className="icon-btn" disabled={!next} title={t.tradePage.next} aria-label={t.tradePage.next} onClick={() => next && navigate(`/trade/${next.id}`, { replace: true })}>
            <Icon icon={ArrowRight01Icon} />
          </button>
          <button className="primary" onClick={() => show(trade)}><Icon icon={PencilEdit02Icon} size={16} />{t.tradePage.edit}</button>
        </div>
      </div>

      <div className="card flush trade-stats">
        <TStat label={t.form.netPnl} value={closed ? money(pnl, { sign: true }) : t.tradePage.open} tone={closed ? pnl : undefined} big />
        <TStat label={t.form.rMultiple} value={rFmt(r)} tone={r} />
        {lev > 1
          ? <TStat label={t.tradePage.roe} value={closed ? `${num(roePct(trade), 1)}%` : '—'} tone={closed ? pnl : undefined}
              sub={closed ? `${t.tradePage.ret} ${num(returnPct(trade), 2)}%` : undefined} />
          : <TStat label={t.tradePage.ret} value={closed ? `${num(returnPct(trade), 2)}%` : '—'} tone={closed ? pnl : undefined} />}
        <TStat label={t.tradePage.hold} value={duration(holdMinutes(trade))} />
        <TStat label={t.tradePage.risk} value={riskAmount(trade) ? money(riskAmount(trade)!) : '—'} />
        <TStat label={t.tradePage.fees} value={money(trade.fees)} />
      </div>

      <div className="trade-grid">
        <div className="card">
          <div className="card-head">
            <h2>{t.tradePage.map}</h2>
            <span className="muted small">
              {[
                plannedRR(trade) && `R:R 1:${num(plannedRR(trade)!, 1)}`,
                lev > 1 && `${t.tradePage.leverage} ${num(lev, lev % 1 ? 1 : 0)}× · ${t.tradePage.margin} ${money(marginUsed(trade))}`,
              ].filter(Boolean).join(' · ')}
            </span>
          </div>
          <TradeMap trade={trade} />
        </div>

        <div className="card">
          <div className="card-head"><h2>{t.tradePage.review}</h2></div>
          {strategy && rules.length > 0 && (
            <div className="review-block">
              <div className="section-title" style={{ marginTop: 0 }}>{t.form.checklist(strategy.name)}</div>
              {rules.map((rule) => (
                <div key={rule} className="rule">
                  <Icon icon={trade.checklist[rule] ? CheckmarkCircle02Icon : Alert02Icon} size={16}
                    style={{ color: trade.checklist[rule] ? 'var(--pos)' : 'var(--warn)' }} />
                  <span className={trade.checklist[rule] ? '' : 'muted'}>{rule}</span>
                </div>
              ))}
            </div>
          )}
          <div className="review-pairs">
            <div><div className="hint">{t.form.emotion}</div><div>{trade.emotion ? label(t.emotions, trade.emotion) : '—'}</div></div>
            <div><div className="hint">{t.form.rating}</div>{trade.rating ? <Stars value={trade.rating} /> : '—'}</div>
          </div>
          {trade.mistakes.length > 0 && (
            <div className="review-block">
              <div className="hint">{t.form.mistakes}</div>
              <div className="chips" style={{ marginTop: 6 }}>{trade.mistakes.map((m) => <span key={m} className="tag bad">{label(t.mistakes, m)}</span>)}</div>
            </div>
          )}
          {trade.tags.length > 0 && (
            <div className="review-block">
              <div className="hint">{t.form.tags}</div>
              <div className="chips" style={{ marginTop: 6 }}>{trade.tags.map((m) => <span key={m} className="tag">{m}</span>)}</div>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h2>{t.form.notes}</h2></div>
        {trade.notes ? <p className="notes">{trade.notes}</p> : <div className="hint">{t.tradePage.noNotes}</div>}
      </div>

      <div className="card">
        <div className="card-head"><h2>{t.tradePage.screenshots}</h2>{trade.screenshots.length > 0 && <span className="count-pill">{trade.screenshots.length}</span>}</div>
        {trade.screenshots.length ? (
          <div className="gallery">
            {trade.screenshots.map((src, i) => <img key={i} src={src} alt="" onClick={() => setLightbox(src)} />)}
          </div>
        ) : <div className="hint">{t.tradePage.noShots}</div>}
      </div>

      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(undefined)} />}
    </div>
  )
}

function TStat({ label, value, tone, big, sub }: { label: string; value: ReactNode; tone?: number; big?: boolean; sub?: ReactNode }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className={`value ${big ? 'big' : ''} ${tone != null ? pnlClass(tone) : ''}`}>{value}</div>
      {sub != null && <div className="sub">{sub}</div>}
    </div>
  )
}

/** Price levels of the trade (stop, entry, target, exit) and the path from entry to exit. */
function TradeMap({ trade }: { trade: Trade }) {
  const t = useT()
  const mobile = useMedia(MOBILE)
  const closed = isClosed(trade)
  const levels = [
    { key: 'target', value: trade.takeProfit, color: 'var(--pos)', dashed: true, label: t.tradePage.target },
    { key: 'stop', value: trade.stopLoss, color: 'var(--neg)', dashed: true, label: t.tradePage.stop },
    { key: 'entry', value: trade.entryPrice, color: 'var(--muted)', dashed: false, label: t.tradePage.entry },
    { key: 'exit', value: closed ? trade.exitPrice : undefined, color: netPnl(trade) >= 0 ? 'var(--pos)' : 'var(--neg)', dashed: false, label: t.tradePage.exit },
  ].filter((l): l is typeof l & { value: number } => l.value != null && l.value > 0)

  // liquidation is shown only when it's near the other levels, otherwise it would squash the map
  const liq = liquidationPrice(trade)
  const spread = Math.max(...levels.map((l) => Math.abs(l.value - trade.entryPrice)), 0)
  if (liq != null && liq > 0 && spread > 0 && Math.abs(liq - trade.entryPrice) <= spread * 3) {
    levels.push({ key: 'liq', value: +liq.toPrecision(6), color: 'var(--warn)', dashed: true, label: t.tradePage.liquidation })
  }

  if (levels.length < 2) return <div className="hint">{t.tradePage.noLevels}</div>

  // a narrower drawing on phones keeps the labels readable once the SVG is scaled down
  const W = mobile ? 380 : 640, H = mobile ? 240 : 260, left = 8, right = mobile ? 118 : 150, top = 20, bottom = 20
  const vals = levels.map((l) => l.value)
  const lo = Math.min(...vals), hi = Math.max(...vals)
  const padV = (hi - lo) * 0.12 || hi * 0.01
  const y = (v: number) => top + (1 - (v - (lo - padV)) / (hi - lo + padV * 2)) * (H - top - bottom)
  const x1 = left + (mobile ? 24 : 40), x2 = W - right - (mobile ? 18 : 30)
  const yEntry = y(trade.entryPrice)
  const exit = levels.find((l) => l.key === 'exit')
  const stop = levels.find((l) => l.key === 'stop')
  const target = levels.find((l) => l.key === 'target')

  // keep labels from overlapping when levels are close
  const labelYs = new Map<string, number>()
  ;[...levels].sort((a, b) => y(a.value) - y(b.value)).reduce((prevY, l) => {
    const ly = Math.max(y(l.value), prevY + 16)
    labelYs.set(l.key, ly)
    return ly
  }, -Infinity)

  return (
    <svg className="trade-map" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t.tradePage.map}>
      {stop && <rect x={left} width={W - right - left} y={Math.min(yEntry, y(stop.value))} height={Math.abs(yEntry - y(stop.value))} fill="var(--neg)" opacity={0.08} />}
      {target && <rect x={left} width={W - right - left} y={Math.min(yEntry, y(target.value))} height={Math.abs(yEntry - y(target.value))} fill="var(--pos)" opacity={0.08} />}
      {levels.map((l) => (
        <g key={l.key}>
          <line x1={left} x2={W - right} y1={y(l.value)} y2={y(l.value)} stroke={l.color} strokeWidth={l.key === 'entry' ? 1.5 : 1.2}
            strokeDasharray={l.dashed ? '5 5' : undefined} opacity={0.9} />
          <text x={W - right + 10} y={labelYs.get(l.key)! + 4} fill={l.color} fontSize={mobile ? 11 : 12} fontWeight={600}>
            {l.label} <tspan fill="var(--muted)" fontWeight={400} fontFamily="var(--mono)">{price(l.value)}</tspan>
          </text>
        </g>
      ))}
      {exit ? (
        <>
          <line x1={x1} y1={yEntry} x2={x2} y2={y(exit.value)} stroke={exit.color} strokeWidth={2.5} strokeLinecap="round" />
          <circle cx={x2} cy={y(exit.value)} r={5} fill={exit.color} stroke="var(--panel)" strokeWidth={2} />
        </>
      ) : (
        <line x1={x1} y1={yEntry} x2={W - right} y2={yEntry} stroke="var(--warn)" strokeWidth={2} strokeDasharray="2 6" strokeLinecap="round" />
      )}
      <circle cx={x1} cy={yEntry} r={5} fill="var(--text)" stroke="var(--panel)" strokeWidth={2} />
    </svg>
  )
}
