import { useRef } from 'react'
import { Delete02Icon, Download04Icon, FileDownloadIcon, SparklesIcon, Upload04Icon } from '@hugeicons/core-free-icons'
import { Icon } from '../components/Icon'
import { Seg } from '../components/ui'
import { LANGS, useT } from '../i18n'
import { makeDemo } from '../lib/demo'
import { ymd } from '../lib/format'
import { CSV_COLUMNS, download } from '../lib/io'
import { useStore, type BackupData } from '../store'

export default function SettingsPage() {
  const { settings, setSettings, trades, strategies, dayNotes, restore, reset } = useStore()
  const t = useT()
  const fileRef = useRef<HTMLInputElement>(null)

  const backup = () => {
    const data: BackupData = { trades, strategies, dayNotes, settings }
    download(`trader-journal-backup-${ymd(new Date())}.json`, JSON.stringify(data), 'application/json')
  }

  const onRestore = async (f?: File) => {
    if (!f) return
    try {
      const data = JSON.parse(await f.text()) as BackupData
      if (!Array.isArray(data.trades) || !Array.isArray(data.strategies)) throw new Error('bad format')
      if (confirm(t.settings.restoreConfirm(data.trades.length, data.strategies.length))) restore(data)
    } catch {
      alert(t.settings.restoreError)
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="stack" style={{ maxWidth: 760 }}>
      <div className="page-head"><h1>{t.settings.title}</h1></div>

      <div className="card">
        <h2 style={{ marginBottom: 14 }}>{t.settings.language}</h2>
        <Seg value={settings.lang} onChange={(lang) => setSettings({ lang })} options={LANGS.map((l) => ({ value: l.value, label: l.name }))} />
      </div>

      <div className="card">
        <h2 style={{ marginBottom: 14 }}>{t.settings.account}</h2>
        <div className="grid g3" style={{ gap: 12 }}>
          <label className="field"><span>{t.settings.startingBalance}</span>
            <input inputMode="decimal" defaultValue={settings.startingBalance} onBlur={(e) => { const v = Number(e.target.value.replace(',', '.')); if (Number.isFinite(v)) setSettings({ startingBalance: v }) }} />
          </label>
          <label className="field"><span>{t.settings.currency}</span>
            <input value={settings.currency} maxLength={4} onChange={(e) => setSettings({ currency: e.target.value })} />
          </label>
          <label className="field"><span>{t.settings.risk}</span>
            <input inputMode="decimal" defaultValue={settings.riskPercent} onBlur={(e) => { const v = Number(e.target.value.replace(',', '.')); if (v > 0) setSettings({ riskPercent: v }) }} />
          </label>
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: 6 }}>{t.settings.data}</h2>
        <p className="hint" style={{ marginTop: 0 }}>{t.settings.dataHint}</p>
        <div className="row">
          <button onClick={backup}><Icon icon={Download04Icon} />{t.settings.backup}</button>
          <button onClick={() => fileRef.current?.click()}><Icon icon={Upload04Icon} />{t.settings.restore}</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => onRestore(e.target.files?.[0])} />
        </div>
        <div className="divider" />
        <div className="row">
          <button onClick={() => { if (!trades.length || confirm(t.settings.demoConfirm)) restore({ ...makeDemo(), settings }) }}><Icon icon={SparklesIcon} />{t.settings.loadDemo}</button>
          <button className="danger" onClick={() => { if (confirm(t.settings.clearConfirm)) reset() }}><Icon icon={Delete02Icon} />{t.settings.clearAll}</button>
        </div>
        <div className="hint" style={{ marginTop: 10 }}>{t.settings.counts(trades.length, strategies.length, Object.keys(dayNotes).length)}</div>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: 6 }}>{t.settings.csvTitle}</h2>
        <p className="hint" style={{ marginTop: 0 }}>{t.settings.csvHint}</p>
        <pre className="mono small" style={{ background: 'var(--bg)', padding: 12, borderRadius: 8, overflowX: 'auto', margin: 0 }}>
          {CSV_COLUMNS.join(',')}{'\n'}{t.settings.csvExample}
        </pre>
        <button className="sm" style={{ marginTop: 10 }} onClick={() => download('trades-template.csv', CSV_COLUMNS.join(',') + '\n', 'text/csv')}><Icon icon={FileDownloadIcon} size={14} />{t.settings.template}</button>
      </div>
    </div>
  )
}
