import { useState } from 'react'
import { Add01Icon, Archive01Icon, ArchiveArrowUpIcon, Delete02Icon, PencilEdit02Icon, Target02Icon } from '@hugeicons/core-free-icons'
import { EquityChart } from '../components/charts'
import { Icon } from '../components/Icon'
import { Empty, Modal } from '../components/ui'
import { computeStats, equityCurve, isClosed } from '../lib/calc'
import { num, pct, pnlClass, rFmt, useMoney } from '../lib/format'
import { label, useT } from '../i18n'
import { useStore } from '../store'
import { MARKETS, STRATEGY_COLORS, type Strategy } from '../types'

export default function Strategies() {
  const { strategies, trades } = useStore()
  const money = useMoney()
  const t = useT()
  const [editing, setEditing] = useState<Strategy | 'new'>()
  const [showArchived, setShowArchived] = useState(false)
  const list = strategies.filter((s) => showArchived || !s.archived)

  return (
    <div className="stack">
      <div className="page-head">
        <h1>{t.strategies.title}</h1>
        <div className="row">
          {strategies.some((s) => s.archived) && (
            <label className="row small muted"><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />{t.strategies.showArchived}</label>
          )}
          <button className="primary" onClick={() => setEditing('new')}><Icon icon={Add01Icon} />{t.strategies.add}</button>
        </div>
      </div>

      {list.length === 0 && (
        <div className="card">
          <Empty title={t.strategies.emptyTitle} icon={Target02Icon}>
            <p>{t.strategies.emptyText}</p>
            <button className="primary" style={{ marginTop: 10 }} onClick={() => setEditing('new')}><Icon icon={Add01Icon} />{t.strategies.create}</button>
          </Empty>
        </div>
      )}

      <div className="grid g2">
        {list.map((s) => {
          const ts = trades.filter((t) => t.strategyId === s.id)
          const closed = ts.filter(isClosed)
          const st = computeStats(closed)
          const withCl = closed.filter((t) => Object.keys(t.checklist ?? {}).length)
          const adherence = withCl.length ? (withCl.filter((t) => Object.values(t.checklist).every(Boolean)).length / withCl.length) * 100 : undefined
          return (
            <div key={s.id} className="card" style={{ borderTop: `3px solid ${s.color}`, opacity: s.archived ? 0.6 : 1 }}>
              <div className="card-head">
                <div>
                  <h2>{s.name} {s.archived && <span className="tag">{t.strategies.archived}</span>}</h2>
                  <div className="hint">{[s.market && label(t.markets, s.market), s.timeframe].filter(Boolean).join(' · ')}</div>
                </div>
                <button className="sm" onClick={() => setEditing(s)}><Icon icon={PencilEdit02Icon} size={14} />{t.common.edit}</button>
              </div>
              {s.description && <p className="muted" style={{ marginTop: 0 }}>{s.description}</p>}

              <div className="kpis" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, margin: '10px 0' }}>
                <div><div className="hint">{t.strategies.pnl}</div><div className={`num ${pnlClass(st.net)}`}><b>{money(st.net, { sign: true })}</b></div></div>
                <div><div className="hint">{t.strategies.trades}</div><div className="num"><b>{st.count}</b></div></div>
                <div><div className="hint">{t.strategies.winRate}</div><div className="num"><b>{pct(st.winRate, 0)}</b></div></div>
                <div><div className="hint">{t.strategies.pf}</div><div className="num"><b>{num(st.profitFactor)}</b></div></div>
                <div><div className="hint">{t.strategies.expectancy}</div><div className={`num ${pnlClass(st.expectancy)}`}>{money(st.expectancy, { sign: true })}</div></div>
                <div><div className="hint">{t.strategies.avgR}</div><div className={`num ${pnlClass(st.avgR ?? 0)}`}>{rFmt(st.avgR)}</div></div>
                <div><div className="hint">{t.strategies.drawdown}</div><div className="num neg">{money(-st.maxDrawdown)}</div></div>
                <div><div className="hint">{t.strategies.discipline}</div><div className="num">{adherence == null ? '—' : pct(adherence, 0)}</div></div>
              </div>

              {closed.length > 1 && <EquityChart data={equityCurve(closed, 0)} height={140} />}

              {s.rules.length > 0 && (
                <>
                  <div className="section-title">{t.strategies.rules}</div>
                  <ol style={{ margin: 0, paddingLeft: 18 }} className="small">
                    {s.rules.map((r) => {
                      const tracked = closed.filter((t) => r in (t.checklist ?? {}))
                      const ok = tracked.filter((t) => t.checklist[r]).length
                      return (
                        <li key={r} style={{ padding: '2px 0' }}>
                          {r}{tracked.length > 0 && <span className="muted">{t.strategies.followed(ok, tracked.length)}</span>}
                        </li>
                      )
                    })}
                  </ol>
                </>
              )}
            </div>
          )
        })}
      </div>

      {editing && <StrategyForm strategy={editing === 'new' ? undefined : editing} onClose={() => setEditing(undefined)} />}
    </div>
  )
}

function StrategyForm({ strategy, onClose }: { strategy?: Strategy; onClose: () => void }) {
  const { addStrategy, updateStrategy, deleteStrategy, strategies, trades } = useStore()
  const [name, setName] = useState(strategy?.name ?? '')
  const [description, setDescription] = useState(strategy?.description ?? '')
  const [color, setColor] = useState(strategy?.color ?? STRATEGY_COLORS[strategies.length % STRATEGY_COLORS.length])
  const [market, setMarket] = useState(strategy?.market ?? '')
  const [timeframe, setTimeframe] = useState(strategy?.timeframe ?? '')
  const [rules, setRules] = useState((strategy?.rules ?? []).join('\n'))
  const t = useT()
  const used = strategy ? trades.filter((t) => t.strategyId === strategy.id).length : 0

  const save = () => {
    const data = { name: name.trim(), description, color, market, timeframe, rules: rules.split('\n').map((r) => r.trim()).filter(Boolean) }
    if (!data.name) return
    if (strategy) updateStrategy(strategy.id, data)
    else addStrategy(data)
    onClose()
  }

  return (
    <Modal title={strategy ? t.strategies.formTitle : t.strategies.formNew} onClose={onClose} narrow>
      <div className="stack" style={{ gap: 12 }}>
        <label className="field"><span>{t.strategies.name}</span><input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={t.strategies.namePlaceholder} /></label>
        <div className="grid g2" style={{ gap: 12 }}>
          <label className="field"><span>{t.strategies.market}</span>
            <select value={market} onChange={(e) => setMarket(e.target.value)}><option value="">—</option>{MARKETS.map((m) => <option key={m} value={m}>{label(t.markets, m)}</option>)}</select>
          </label>
          <label className="field"><span>{t.strategies.timeframe}</span><input value={timeframe} onChange={(e) => setTimeframe(e.target.value)} placeholder="5m, 1H, 1D…" /></label>
        </div>
        <label className="field"><span>{t.strategies.description}</span><textarea value={description} onChange={(e) => setDescription(e.target.value)} /></label>
        <label className="field"><span>{t.strategies.rulesLabel}</span>
          <textarea rows={5} value={rules} onChange={(e) => setRules(e.target.value)} placeholder={t.strategies.rulesPlaceholder} />
        </label>
        <div className="field"><span>{t.strategies.color}</span>
          <div className="row">
            {STRATEGY_COLORS.map((c) => (
              <span key={c} onClick={() => setColor(c)} style={{ width: 24, height: 24, borderRadius: 6, background: c, cursor: 'pointer', outline: c === color ? '2px solid white' : 'none', outlineOffset: 2 }} />
            ))}
          </div>
        </div>
      </div>
      <div className="modal-foot">
        <div className="row">
          {strategy && (
            <>
              <button onClick={() => { updateStrategy(strategy.id, { archived: !strategy.archived }); onClose() }}><Icon icon={strategy.archived ? ArchiveArrowUpIcon : Archive01Icon} size={16} />{strategy.archived ? t.strategies.unarchive : t.strategies.archive}</button>
              <button className="danger" onClick={() => {
                if (confirm(used ? t.strategies.confirmDeleteUsed(used) : t.strategies.confirmDelete)) { deleteStrategy(strategy.id); onClose() }
              }}><Icon icon={Delete02Icon} size={16} />{t.common.delete}</button>
            </>
          )}
        </div>
        <div className="row">
          <button onClick={onClose}>{t.common.cancel}</button>
          <button className="primary" disabled={!name.trim()} onClick={save}>{t.common.save}</button>
        </div>
      </div>
    </Modal>
  )
}
