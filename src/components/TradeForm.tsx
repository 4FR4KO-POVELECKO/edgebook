import { useMemo, useState, type ClipboardEvent } from 'react'
import { Add01Icon, ArrowDownRight01Icon, ArrowUpRight01Icon, Cancel01Icon, Delete02Icon } from '@hugeicons/core-free-icons'
import { isClosed, netPnl, plannedRR, returnPct, riskAmount, rMultiple, sum } from '../lib/calc'
import { label, useT } from '../i18n'
import { localDateTime, num, pnlClass, rFmt, useMoney } from '../lib/format'
import { compressImage } from '../lib/io'
import { useStore } from '../store'
import { DEFAULT_MISTAKES, EMOTIONS, MARKETS, type Direction, type Trade } from '../types'
import { Icon } from './Icon'
import { ChipPicker, Lightbox, Modal, Seg, Stars } from './ui'

export type TradeDraft = {
  symbol: string
  market: string
  direction: Direction
  status: 'open' | 'closed'
  entryDate: string
  exitDate: string
  entryPrice: string
  exitPrice: string
  quantity: string
  multiplier: string
  fees: string
  stopLoss: string
  takeProfit: string
  strategyId: string
  checklist: Record<string, boolean>
  tags: string[]
  mistakes: string[]
  emotion: string
  rating?: number
  notes: string
  screenshots: string[]
}

const s = (v?: number) => (v == null ? '' : String(v))
const n = (v: string) => {
  const x = Number(v.replace(',', '.').replace(/\s/g, ''))
  return v.trim() === '' || !Number.isFinite(x) ? undefined : x
}

function toDraft(t?: Trade, defaults?: Partial<TradeDraft>): TradeDraft {
  if (!t) {
    return {
      symbol: '', market: 'stocks', direction: 'long', status: 'closed',
      entryDate: localDateTime(), exitDate: localDateTime(),
      entryPrice: '', exitPrice: '', quantity: '', multiplier: '1', fees: '0',
      stopLoss: '', takeProfit: '', strategyId: '', checklist: {}, tags: [], mistakes: [],
      emotion: '', notes: '', screenshots: [], ...defaults,
    }
  }
  return {
    symbol: t.symbol, market: t.market, direction: t.direction, status: t.status,
    entryDate: t.entryDate, exitDate: t.exitDate ?? localDateTime(),
    entryPrice: s(t.entryPrice), exitPrice: s(t.exitPrice), quantity: s(t.quantity),
    multiplier: s(t.multiplier), fees: s(t.fees), stopLoss: s(t.stopLoss), takeProfit: s(t.takeProfit),
    strategyId: t.strategyId ?? '', checklist: t.checklist ?? {}, tags: t.tags, mistakes: t.mistakes,
    emotion: t.emotion ?? '', rating: t.rating, notes: t.notes, screenshots: t.screenshots,
  }
}

function fromDraft(d: TradeDraft): Omit<Trade, 'id' | 'createdAt'> {
  const closed = d.status === 'closed'
  return {
    symbol: d.symbol.trim().toUpperCase(),
    market: d.market,
    direction: d.direction,
    status: d.status,
    entryDate: d.entryDate,
    exitDate: closed ? d.exitDate : undefined,
    entryPrice: n(d.entryPrice) ?? 0,
    exitPrice: closed ? n(d.exitPrice) : undefined,
    quantity: n(d.quantity) ?? 0,
    multiplier: n(d.multiplier) || 1,
    fees: n(d.fees) ?? 0,
    stopLoss: n(d.stopLoss),
    takeProfit: n(d.takeProfit),
    strategyId: d.strategyId || undefined,
    checklist: d.checklist,
    tags: d.tags,
    mistakes: d.mistakes,
    emotion: d.emotion || undefined,
    rating: d.rating,
    notes: d.notes,
    screenshots: d.screenshots,
  }
}

export function TradeForm({ trade, defaults, onClose }: { trade?: Trade; defaults?: Partial<TradeDraft>; onClose: () => void }) {
  const { strategies, trades, settings, addTrade, updateTrade, deleteTrade } = useStore()
  const money = useMoney()
  const t = useT()
  const [d, setD] = useState<TradeDraft>(() => toDraft(trade, defaults))
  const [lightbox, setLightbox] = useState<string>()
  const set = <K extends keyof TradeDraft>(k: K, v: TradeDraft[K]) => setD((p) => ({ ...p, [k]: v }))

  const strategy = strategies.find((x) => x.id === d.strategyId)
  const activeStrategies = strategies.filter((x) => !x.archived || x.id === d.strategyId)

  const knownTags = useMemo(() => [...new Set(trades.flatMap((x) => x.tags))], [trades])
  const knownMistakes = useMemo(() => [...new Set([...DEFAULT_MISTAKES, ...trades.flatMap((x) => x.mistakes)])], [trades])
  const knownSymbols = useMemo(() => [...new Set(trades.map((x) => x.symbol))], [trades])

  const preview = fromDraft(d) as Trade
  const valid = preview.symbol && preview.entryPrice > 0 && preview.quantity > 0 &&
    (d.status === 'open' || (preview.exitPrice != null && d.exitDate >= d.entryDate))
  const closedPreview = isClosed(preview) && preview.exitPrice! > 0 && preview.quantity > 0
  const net = closedPreview ? netPnl(preview) : 0
  const r = closedPreview ? rMultiple(preview) : undefined
  const risk = riskAmount(preview)
  const rr = plannedRR(preview)

  // position sizing: balance * risk% / (|entry - stop| * multiplier)
  const balance = settings.startingBalance + sum(trades.filter((x) => x.id !== trade?.id).map(netPnl))
  const perUnit = preview.stopLoss ? Math.abs(preview.entryPrice - preview.stopLoss) * (preview.multiplier || 1) : 0
  const suggestedQty = perUnit > 0 && preview.entryPrice > 0 ? (balance * settings.riskPercent) / 100 / perUnit : undefined

  const save = () => {
    if (!valid) return
    const data = fromDraft(d)
    if (trade) updateTrade(trade.id, data)
    else addTrade(data)
    onClose()
  }

  const onFiles = async (files: FileList | null) => {
    if (!files) return
    const urls = await Promise.all([...files].filter((f) => f.type.startsWith('image/')).map((f) => compressImage(f)))
    set('screenshots', [...d.screenshots, ...urls])
  }

  const onPaste = (e: ClipboardEvent) => {
    const files = e.clipboardData.files
    if (files.length) { e.preventDefault(); onFiles(files) }
  }

  return (
    <Modal title={trade ? t.form.editTitle(trade.symbol) : t.form.newTitle} onClose={onClose}>
      <div onPaste={onPaste}>
        <div className="row" style={{ marginBottom: 14, justifyContent: 'space-between' }}>
          <Seg value={d.direction} onChange={(v) => set('direction', v)} options={[{ value: 'long', label: <><Icon icon={ArrowUpRight01Icon} size={16} />Long</>, cls: 'long' }, { value: 'short', label: <><Icon icon={ArrowDownRight01Icon} size={16} />Short</>, cls: 'short' }]} />
          <Seg value={d.status} onChange={(v) => set('status', v)} options={[{ value: 'closed', label: t.form.closed }, { value: 'open', label: t.form.open }]} />
        </div>

        <div className="form-grid">
          <label className="field">
            <span>{t.form.symbol}</span>
            <input list="symbols" autoFocus value={d.symbol} onChange={(e) => set('symbol', e.target.value)} placeholder="AAPL" />
            <datalist id="symbols">{knownSymbols.map((x) => <option key={x} value={x} />)}</datalist>
          </label>
          <label className="field">
            <span>{t.form.market}</span>
            <select value={d.market} onChange={(e) => set('market', e.target.value)}>{MARKETS.map((m) => <option key={m} value={m}>{label(t.markets, m)}</option>)}</select>
          </label>
          <label className="field half">
            <span>{t.form.strategy}</span>
            <select value={d.strategyId} onChange={(e) => setD((p) => ({ ...p, strategyId: e.target.value, checklist: {} }))}>
              <option value="">{t.form.noStrategy}</option>
              {activeStrategies.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </label>

          <label className="field half"><span>{t.form.entryTime}</span><input type="datetime-local" value={d.entryDate} onChange={(e) => set('entryDate', e.target.value)} /></label>
          <label className="field half">
            <span>{t.form.exitTime} {d.status === 'closed' && '*'}</span>
            <input type="datetime-local" disabled={d.status === 'open'} value={d.exitDate} onChange={(e) => set('exitDate', e.target.value)} />
          </label>

          <label className="field"><span>{t.form.entryPrice}</span><input inputMode="decimal" value={d.entryPrice} onChange={(e) => set('entryPrice', e.target.value)} /></label>
          <label className="field"><span>{t.form.exitPrice} {d.status === 'closed' && '*'}</span><input inputMode="decimal" disabled={d.status === 'open'} value={d.exitPrice} onChange={(e) => set('exitPrice', e.target.value)} /></label>
          <label className="field"><span>{t.form.qty}</span><input inputMode="decimal" value={d.quantity} onChange={(e) => set('quantity', e.target.value)} /></label>
          <label className="field"><span>{t.form.fees}</span><input inputMode="decimal" value={d.fees} onChange={(e) => set('fees', e.target.value)} /></label>

          <label className="field"><span>{t.form.stopLoss}</span><input inputMode="decimal" value={d.stopLoss} onChange={(e) => set('stopLoss', e.target.value)} /></label>
          <label className="field"><span>{t.form.takeProfit}</span><input inputMode="decimal" value={d.takeProfit} onChange={(e) => set('takeProfit', e.target.value)} /></label>
          <label className="field"><span>{t.form.multiplier}</span><input inputMode="decimal" value={d.multiplier} onChange={(e) => set('multiplier', e.target.value)} /></label>
          <div className="field" style={{ justifyContent: 'flex-end' }}>
            {suggestedQty != null && (
              <button type="button" className="sm" title={t.form.sizeByRiskTitle(settings.riskPercent, money(balance))}
                onClick={() => set('quantity', String(preview.market === 'crypto' ? +suggestedQty.toFixed(4) : Math.floor(suggestedQty)))}>
                {t.form.sizeByRisk(settings.riskPercent, num(suggestedQty, suggestedQty < 10 ? 3 : 0))}
              </button>
            )}
          </div>
        </div>

        <div className="preview">
          <div><div className="label">{t.form.netPnl}</div><div className={`value ${pnlClass(net)}`}>{closedPreview ? money(net, { sign: true }) : '—'}</div></div>
          <div><div className="label">{t.form.rMultiple}</div><div className={`value ${pnlClass(r ?? 0)}`}>{rFmt(r)}</div></div>
          <div><div className="label">{t.form.riskToStop}</div><div className="value">{risk ? money(risk) : '—'}</div></div>
          <div><div className="label">{t.form.plannedRR}</div><div className="value">{rr ? `1:${num(rr, 1)}` : '—'} <span className={`small ${pnlClass(net)}`}>{closedPreview ? `${num(returnPct(preview), 2)}%` : ''}</span></div></div>
        </div>

        {strategy && strategy.rules.length > 0 && (
          <>
            <div className="section-title">{t.form.checklist(strategy.name)}</div>
            {strategy.rules.map((rule) => (
              <label key={rule} className="rule">
                <input type="checkbox" checked={!!d.checklist[rule]} onChange={(e) => set('checklist', { ...d.checklist, [rule]: e.target.checked })} />
                {rule}
              </label>
            ))}
          </>
        )}

        <div className="section-title">{t.form.psychology}</div>
        <div className="form-grid">
          <label className="field half">
            <span>{t.form.emotion}</span>
            <select value={d.emotion} onChange={(e) => set('emotion', e.target.value)}>
              <option value="">—</option>
              {EMOTIONS.map((x) => <option key={x} value={x}>{label(t.emotions, x)}</option>)}
              {d.emotion && !EMOTIONS.includes(d.emotion) && <option value={d.emotion}>{d.emotion}</option>}
            </select>
          </label>
          <div className="field half"><span>{t.form.rating}</span><Stars value={d.rating} onChange={(v) => set('rating', v)} /></div>
          <div className="field full"><span>{t.form.tags}</span><ChipPicker options={knownTags} value={d.tags} onChange={(v) => set('tags', v)} allowAdd /></div>
          <div className="field full"><span>{t.form.mistakes}</span><ChipPicker options={knownMistakes} value={d.mistakes} onChange={(v) => set('mistakes', v)} format={(m) => label(t.mistakes, m)} bad allowAdd /></div>
          <label className="field full"><span>{t.form.notes}</span><textarea value={d.notes} onChange={(e) => set('notes', e.target.value)} placeholder={t.form.notesPlaceholder} /></label>
          <div className="field full">
            <span>{t.form.screenshots}</span>
            <div className="shots">
              {d.screenshots.map((src, i) => (
                <div className="shot" key={i}>
                  <img src={src} alt="" onClick={() => setLightbox(src)} />
                  <button type="button" className="sm" onClick={() => set('screenshots', d.screenshots.filter((_, j) => j !== i))}><Icon icon={Cancel01Icon} size={14} /></button>
                </div>
              ))}
              <label className="shot shot-add">
                <Icon icon={Add01Icon} size={16} />{t.form.addFile}
                <input type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
              </label>
            </div>
          </div>
        </div>

        <div className="modal-foot">
          <div>
            {trade && (
              <button type="button" className="danger" onClick={() => { if (confirm(t.form.confirmDelete)) { deleteTrade(trade.id); onClose() } }}><Icon icon={Delete02Icon} size={16} />{t.common.delete}</button>
            )}
          </div>
          <div className="row">
            <button type="button" onClick={onClose}>{t.common.cancel}</button>
            <button type="button" className="primary" disabled={!valid} onClick={save}>{trade ? t.common.save : t.form.add}</button>
          </div>
        </div>
      </div>
      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(undefined)} />}
    </Modal>
  )
}
