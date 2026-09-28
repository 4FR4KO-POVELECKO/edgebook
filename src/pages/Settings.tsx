import { useRef } from 'react'
import { makeDemo } from '../lib/demo'
import { ymd } from '../lib/format'
import { CSV_COLUMNS, download } from '../lib/io'
import { useStore, type BackupData } from '../store'

export default function SettingsPage() {
  const { settings, setSettings, trades, strategies, dayNotes, restore, reset } = useStore()
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
      if (confirm(`Заменить текущие данные бэкапом? (${data.trades.length} сделок, ${data.strategies.length} стратегий)`)) restore(data)
    } catch {
      alert('Не удалось прочитать файл бэкапа')
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="stack" style={{ maxWidth: 760 }}>
      <div className="page-head"><h1>Настройки</h1></div>

      <div className="card">
        <h2 style={{ marginBottom: 14 }}>Счёт</h2>
        <div className="grid g3" style={{ gap: 12 }}>
          <label className="field"><span>Стартовый баланс</span>
            <input inputMode="decimal" defaultValue={settings.startingBalance} onBlur={(e) => { const v = Number(e.target.value.replace(',', '.')); if (Number.isFinite(v)) setSettings({ startingBalance: v }) }} />
          </label>
          <label className="field"><span>Символ валюты</span>
            <input value={settings.currency} maxLength={4} onChange={(e) => setSettings({ currency: e.target.value })} />
          </label>
          <label className="field"><span>Риск на сделку, % (для калькулятора объёма)</span>
            <input inputMode="decimal" defaultValue={settings.riskPercent} onBlur={(e) => { const v = Number(e.target.value.replace(',', '.')); if (v > 0) setSettings({ riskPercent: v }) }} />
          </label>
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: 6 }}>Данные</h2>
        <p className="hint" style={{ marginTop: 0 }}>
          Всё хранится локально в браузере (IndexedDB) — никуда не отправляется. Делай бэкапы: очистка данных сайта удалит дневник.
        </p>
        <div className="row">
          <button onClick={backup}>Скачать бэкап (JSON)</button>
          <button onClick={() => fileRef.current?.click()}>Восстановить из бэкапа</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => onRestore(e.target.files?.[0])} />
        </div>
        <div className="divider" />
        <div className="row">
          <button onClick={() => { if (!trades.length || confirm('Заменить текущие данные демо-данными?')) restore({ ...makeDemo(), settings }) }}>Загрузить демо-данные</button>
          <button className="danger" onClick={() => { if (confirm('Удалить ВСЕ сделки, стратегии и заметки? Это необратимо.')) reset() }}>Очистить всё</button>
        </div>
        <div className="hint" style={{ marginTop: 10 }}>{trades.length} сделок · {strategies.length} стратегий · {Object.keys(dayNotes).length} заметок дня</div>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: 6 }}>Формат CSV для импорта</h2>
        <p className="hint" style={{ marginTop: 0 }}>
          Первая строка — заголовки. Обязательные: <code>symbol, entryDate, entryPrice, quantity</code>. Разделитель — запятая или точка с запятой.
          Даты: <code>2026-09-28 14:30</code>. <code>direction</code>: long/short. Теги и ошибки — через <code>|</code>. Неизвестные стратегии создаются автоматически.
        </p>
        <pre className="mono small" style={{ background: 'var(--bg)', padding: 12, borderRadius: 8, overflowX: 'auto', margin: 0 }}>
{CSV_COLUMNS.join(',')}
{'\n'}AAPL,Акции,long,closed,2026-09-01 10:15,2026-09-01 11:40,190.5,193.2,100,1,2,189,195,Пробой уровня,утро|A+ сетап,,Спокойствие,4,Хороший вход
        </pre>
        <button className="sm" style={{ marginTop: 10 }} onClick={() => download('trades-template.csv', CSV_COLUMNS.join(',') + '\n', 'text/csv')}>Скачать шаблон</button>
      </div>
    </div>
  )
}
