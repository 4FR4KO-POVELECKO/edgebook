import { useEffect, useState } from 'react'
import { HashRouter, NavLink, Route, Routes } from 'react-router-dom'
import { TradeModalHost, useTradeModal } from './components/TradeTable'
import Analytics from './pages/Analytics'
import CalendarPage from './pages/Calendar'
import Dashboard from './pages/Dashboard'
import SettingsPage from './pages/Settings'
import Strategies from './pages/Strategies'
import Trades from './pages/Trades'
import { LANGS, useT } from './i18n'
import { useStore } from './store'

const NAV = [
  { to: '/', icon: '◧', key: 'dashboard' },
  { to: '/trades', icon: '☰', key: 'trades' },
  { to: '/calendar', icon: '▦', key: 'calendar' },
  { to: '/analytics', icon: '◔', key: 'analytics' },
  { to: '/strategies', icon: '◈', key: 'strategies' },
  { to: '/settings', icon: '⚙', key: 'settings' },
] as const

function useHydrated() {
  const [ok, setOk] = useState(useStore.persist.hasHydrated())
  useEffect(() => useStore.persist.onFinishHydration(() => setOk(true)), [])
  return ok
}

export default function App() {
  const hydrated = useHydrated()
  const show = useTradeModal((s) => s.show)
  const t = useT()
  const lang = useStore((s) => s.settings.lang)
  const setSettings = useStore((s) => s.setSettings)

  useEffect(() => {
    document.documentElement.lang = lang
    document.title = t.appName
  }, [lang, t])

  // "N" opens a new trade from anywhere
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (e.key.toLowerCase() === 'n' && !e.metaKey && !e.ctrlKey && !['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) && !useTradeModal.getState().open) {
        e.preventDefault()
        show()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [show])

  if (!hydrated) return null

  return (
    <HashRouter>
      <div className="app">
        <aside className="sidebar">
          <div className="brand"><span className="brand-dot" />{t.appName}</div>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <span className="nav-icon">{n.icon}</span>{t.nav[n.key]}
            </NavLink>
          ))}
          <div className="sidebar-foot">
            <button className="primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => show()}>{t.nav.newTrade}</button>
            <div className="hint" style={{ textAlign: 'center', marginTop: 6 }}>{t.nav.hotkey}</div>
            <div className="seg lang-switch">
              {LANGS.map((l) => (
                <button key={l.value} className={lang === l.value ? 'on' : ''} onClick={() => setSettings({ lang: l.value })}>{l.label}</button>
              ))}
            </div>
          </div>
        </aside>
        <main className="main">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/trades" element={<Trades />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/strategies" element={<Strategies />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
      <TradeModalHost />
    </HashRouter>
  )
}
