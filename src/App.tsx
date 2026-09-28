import { useEffect, useState } from 'react'
import { HashRouter, NavLink, Route, Routes } from 'react-router-dom'
import { TradeModalHost, useTradeModal } from './components/TradeTable'
import Analytics from './pages/Analytics'
import CalendarPage from './pages/Calendar'
import Dashboard from './pages/Dashboard'
import SettingsPage from './pages/Settings'
import Strategies from './pages/Strategies'
import Trades from './pages/Trades'
import { useStore } from './store'

const NAV = [
  { to: '/', icon: '◧', label: 'Обзор' },
  { to: '/trades', icon: '☰', label: 'Сделки' },
  { to: '/calendar', icon: '▦', label: 'Календарь' },
  { to: '/analytics', icon: '◔', label: 'Аналитика' },
  { to: '/strategies', icon: '◈', label: 'Стратегии' },
  { to: '/settings', icon: '⚙', label: 'Настройки' },
]

function useHydrated() {
  const [ok, setOk] = useState(useStore.persist.hasHydrated())
  useEffect(() => useStore.persist.onFinishHydration(() => setOk(true)), [])
  return ok
}

export default function App() {
  const hydrated = useHydrated()
  const show = useTradeModal((s) => s.show)

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
          <div className="brand"><span className="brand-dot" />Дневник трейдера</div>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <span className="nav-icon">{n.icon}</span>{n.label}
            </NavLink>
          ))}
          <div className="sidebar-foot">
            <button className="primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => show()}>+ Сделка</button>
            <div className="hint" style={{ textAlign: 'center', marginTop: 6 }}>или клавиша N</div>
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
