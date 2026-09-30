import { useEffect, useState } from 'react'
import { HashRouter, Link, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { Add01Icon, Calculator01Icon, Moon02Icon, Search01Icon, Sun03Icon } from '@hugeicons/core-free-icons'
import { CommandPalette, usePalette } from './components/CommandPalette'
import { Icon } from './components/Icon'
import { Logo } from './components/Logo'
import { TradeModalHost, useTradeModal } from './components/TradeTable'
import { useResolvedTheme } from './lib/theme'
import { NAV, NAV_GROUPS } from './nav'
import Analytics from './pages/Analytics'
import CalculatorPage from './pages/Calculator'
import CalendarPage from './pages/Calendar'
import Dashboard from './pages/Dashboard'
import SettingsPage from './pages/Settings'
import Strategies from './pages/Strategies'
import TradePage from './pages/Trade'
import Trades from './pages/Trades'
import { LANGS, useT } from './i18n'
import { useStore } from './store'

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

/** Keyed by path so the fade-in replays on every navigation. */
function Pages() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return (
    <div className="page" key={pathname}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/trades" element={<Trades />} />
        <Route path="/trade/:id" element={<TradePage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/calculator" element={<CalculatorPage />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/strategies" element={<Strategies />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </div>
  )
}

function useHydrated() {
  const [ok, setOk] = useState(useStore.persist.hasHydrated())
  useEffect(() => useStore.persist.onFinishHydration(() => setOk(true)), [])
  return ok
}

/** A trade page belongs to the Trades section. */
function useSectionActive() {
  const { pathname } = useLocation()
  return (to: string, isActive: boolean) => isActive || (to === '/trades' && pathname.startsWith('/trade/'))
}

function SideLink({ item }: { item: (typeof NAV)[number] }) {
  const t = useT()
  const active = useSectionActive()
  return (
    <NavLink to={item.to} end className={({ isActive }) => `nav-link ${active(item.to, isActive) ? 'active' : ''}`}>
      <Icon icon={item.icon} />{t.nav[item.key]}
    </NavLink>
  )
}

function TabBar() {
  const t = useT()
  const active = useSectionActive()
  return (
    <nav className="tabbar">
      {NAV.filter((n) => n.group !== 'tools').map((n) => (
        <NavLink key={n.to} to={n.to} end className={({ isActive }) => `tab-link ${active(n.to, isActive) ? 'active' : ''}`}>
          <span className="tab-icon"><Icon icon={n.icon} size={20} /></span>
          <span className="tab-label">{t.nav[n.key]}</span>
        </NavLink>
      ))}
    </nav>
  )
}

function ThemeButton() {
  const theme = useResolvedTheme()
  const setSettings = useStore((s) => s.setSettings)
  const t = useT()
  return (
    <button className="icon-btn" title={t.palette.switchTheme} aria-label={t.palette.switchTheme}
      onClick={() => setSettings({ theme: theme === 'dark' ? 'light' : 'dark' })}>
      <Icon icon={theme === 'dark' ? Sun03Icon : Moon02Icon} size={16} />
    </button>
  )
}

export default function App() {
  const hydrated = useHydrated()
  const show = useTradeModal((s) => s.show)
  const setPalette = usePalette((s) => s.setOpen)
  const t = useT()
  const lang = useStore((s) => s.settings.lang)
  const setSettings = useStore((s) => s.setSettings)

  useEffect(() => {
    document.documentElement.lang = lang
    document.title = t.appName
  }, [lang, t])

  // ⌘K / Ctrl+K opens the command palette; "N" opens a new trade
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setPalette(!usePalette.getState().open)
        return
      }
      const el = e.target as HTMLElement
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)
      if (e.key.toLowerCase() === 'n' && !e.metaKey && !e.ctrlKey && !typing && !useTradeModal.getState().open && !usePalette.getState().open) {
        e.preventDefault()
        show()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [show, setPalette])

  if (!hydrated) return null

  return (
    <HashRouter>
      <div className="app">
        <header className="topbar">
          <Link to="/" className="brand"><Logo />{t.appName}</Link>
          <div className="row" style={{ gap: 6 }}>
            <button className="icon-btn" onClick={() => setPalette(true)} aria-label={t.nav.search}><Icon icon={Search01Icon} size={18} /></button>
            <Link to="/calculator" className="btn icon-btn" aria-label={t.nav.calculator}><Icon icon={Calculator01Icon} size={18} /></Link>
            <button className="primary icon-btn" onClick={() => show()} aria-label={t.nav.newTrade}><Icon icon={Add01Icon} size={18} /></button>
          </div>
        </header>

        <aside className="sidebar">
          <Link to="/" className="brand"><Logo />{t.appName}</Link>
          <button className="search-btn" onClick={() => setPalette(true)}>
            <Icon icon={Search01Icon} size={16} />
            <span>{t.nav.search}</span>
            <kbd>{isMac ? '⌘' : 'Ctrl'} K</kbd>
          </button>
          {NAV_GROUPS.map((g) => (
            <div key={g} className="nav-section">
              <div className="nav-group">{t.nav.groups[g]}</div>
              {NAV.filter((n) => n.group === g).map((n) => <SideLink key={n.to} item={n} />)}
            </div>
          ))}
          <div className="sidebar-foot">
            <button className="primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => show()}><Icon icon={Add01Icon} />{t.nav.newTrade}</button>
            <div className="hint" style={{ textAlign: 'center', marginTop: 6 }}>{t.nav.hotkey}</div>
            <div className="sidebar-sep" />
            {NAV.filter((n) => n.group === 'footer').map((n) => <SideLink key={n.to} item={n} />)}
            <div className="row" style={{ marginTop: 10, gap: 6, flexWrap: 'nowrap' }}>
              <div className="seg lang-switch">
                {LANGS.map((l) => (
                  <button key={l.value} className={lang === l.value ? 'on' : ''} onClick={() => setSettings({ lang: l.value })}>{l.label}</button>
                ))}
              </div>
              <ThemeButton />
            </div>
          </div>
        </aside>

        <main className="main">
          <Pages />
        </main>

        <TabBar />
      </div>
      <TradeModalHost />
      <CommandPalette />
    </HashRouter>
  )
}
