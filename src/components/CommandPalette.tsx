import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { create } from 'zustand'
import { Add01Icon, LanguageSkillIcon, Moon02Icon, Search01Icon, Sun03Icon } from '@hugeicons/core-free-icons'
import type { HugeiconsIconProps } from '@hugeicons/react'
import { useT, LANGS } from '../i18n'
import { isClosed, netPnl, tradeDay } from '../lib/calc'
import { pnlClass, useMoney } from '../lib/format'
import { useResolvedTheme } from '../lib/theme'
import { NAV } from '../nav'
import { useStore } from '../store'
import { Icon } from './Icon'
import { useTradeModal } from './TradeTable'

export const usePalette = create<{ open: boolean; setOpen: (v: boolean) => void }>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}))

interface Item {
  id: string
  group: string
  label: ReactNode
  icon?: HugeiconsIconProps['icon']
  right?: ReactNode
  keywords: string
  run: () => void
}

export function CommandPalette() {
  const { open, setOpen } = usePalette()
  return open ? <Palette onClose={() => setOpen(false)} /> : null
}

function Palette({ onClose }: { onClose: () => void }) {
  const t = useT()
  const money = useMoney()
  const navigate = useNavigate()
  const trades = useStore((s) => s.trades)
  const lang = useStore((s) => s.settings.lang)
  const setSettings = useStore((s) => s.setSettings)
  const theme = useResolvedTheme()
  const showTrade = useTradeModal((s) => s.show)
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const items = useMemo<Item[]>(() => {
    const go = (fn: () => void) => () => { onClose(); fn() }
    const query = q.trim().toLowerCase()
    const match = (it: Item) => !query || it.keywords.toLowerCase().includes(query)

    const actions: Item[] = [
      { id: 'new', group: t.palette.actions, label: t.palette.newTrade, icon: Add01Icon, keywords: `${t.palette.newTrade} new trade add`, run: go(() => showTrade()) },
      {
        id: 'theme', group: t.palette.actions, label: t.palette.switchTheme, icon: theme === 'dark' ? Sun03Icon : Moon02Icon,
        keywords: `${t.palette.switchTheme} theme dark light`, run: go(() => setSettings({ theme: theme === 'dark' ? 'light' : 'dark' })),
      },
      {
        id: 'lang', group: t.palette.actions, label: t.palette.switchLang, icon: LanguageSkillIcon,
        right: LANGS.find((l) => l.value !== lang)?.name,
        keywords: `${t.palette.switchLang} language ${LANGS.map((l) => l.name).join(' ')}`,
        run: go(() => setSettings({ lang: lang === 'en' ? 'ru' : 'en' })),
      },
    ]
    const pages: Item[] = NAV.map((n) => ({
      id: n.to, group: t.palette.pages, label: t.nav[n.key], icon: n.icon, keywords: `${t.nav[n.key]} ${n.key}`, run: go(() => navigate(n.to)),
    }))
    const sorted = [...trades].sort((a, b) => (b.exitDate ?? b.entryDate).localeCompare(a.exitDate ?? a.entryDate))
    const tradeItems: Item[] = sorted
      .filter((tr) => !query || tr.symbol.toLowerCase().includes(query) || tr.notes.toLowerCase().includes(query))
      .slice(0, query ? 8 : 4)
      .map((tr) => ({
        id: tr.id, group: t.palette.trades,
        label: <><b>{tr.symbol}</b> <span className={`badge ${tr.direction}`}>{tr.direction === 'long' ? 'LONG' : 'SHORT'}</span> <span className="muted small">{tradeDay(tr)}</span></>,
        right: isClosed(tr) ? <span className={`num ${pnlClass(netPnl(tr))}`}>{money(netPnl(tr), { sign: true })}</span> : <span className="badge open">OPEN</span>,
        keywords: tr.symbol, run: go(() => navigate(`/trade/${tr.id}`)),
      }))
    return [...actions.filter(match), ...pages.filter(match), ...tradeItems]
  }, [q, t, trades, lang, theme, money, navigate, onClose, setSettings, showTrade])

  useEffect(() => { setActive(0) }, [q])
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose() }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(items.length - 1, i + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(0, i - 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); items[active]?.run() }
  }

  let lastGroup = ''
  return (
    <div className="overlay palette-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="palette" role="dialog" aria-modal="true" onKeyDown={onKey}>
        <div className="palette-input">
          <Icon icon={Search01Icon} />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.palette.placeholder}
            role="combobox" aria-expanded="true" aria-controls="palette-list" aria-activedescendant={items[active] ? `pi-${active}` : undefined} />
        </div>
        <div className="palette-list" id="palette-list" role="listbox" ref={listRef}>
          {items.length === 0 && <div className="palette-empty">{t.palette.empty}</div>}
          {items.map((it, i) => {
            const header = it.group !== lastGroup ? <div className="palette-group">{it.group}</div> : null
            lastGroup = it.group
            return (
              <div key={it.id}>
                {header}
                <div id={`pi-${i}`} data-i={i} role="option" aria-selected={i === active}
                  className={`palette-item ${i === active ? 'on' : ''}`}
                  onMouseMove={() => setActive(i)} onClick={it.run}>
                  {it.icon && <Icon icon={it.icon} size={17} />}
                  <span className="palette-label">{it.label}</span>
                  {it.right && <span className="palette-right">{it.right}</span>}
                </div>
              </div>
            )
          })}
        </div>
        <div className="palette-foot">{t.palette.hint}</div>
      </div>
    </div>
  )
}
