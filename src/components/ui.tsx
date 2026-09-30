import type { HugeiconsIconProps } from '@hugeicons/react'
import { useEffect, useState, type ReactNode } from 'react'
import { Cancel01Icon } from '@hugeicons/core-free-icons'
import { useT } from '../i18n'
import { Icon } from './Icon'

export function Modal({ title, onClose, children, narrow }: { title: ReactNode; onClose: () => void; children: ReactNode; narrow?: boolean }) {
  const t = useT()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${narrow ? 'narrow' : ''}`}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="ghost" onClick={onClose} aria-label={t.common.close}><Icon icon={Cancel01Icon} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

/** Side panel: fixed header and footer, scrollable body. */
export function Drawer({ title, header, footer, onClose, children }: {
  title: ReactNode; header?: ReactNode; footer?: ReactNode; onClose: () => void; children: ReactNode
}) {
  const t = useT()
  useEffect(() => {
    // a modal opened on top of the drawer (e.g. the calculator) handles Escape itself
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('.modal')) onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])
  return (
    <div className="overlay drawer-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="drawer" role="dialog" aria-modal="true">
        <div className="drawer-head">
          <div className="modal-head" style={{ marginBottom: header ? 14 : 0 }}>
            <h2>{title}</h2>
            <button className="ghost icon-btn" onClick={onClose} aria-label={t.common.close}><Icon icon={Cancel01Icon} /></button>
          </div>
          {header}
        </div>
        <div className="drawer-body">{children}</div>
        {footer && <div className="drawer-foot">{footer}</div>}
      </aside>
    </div>
  )
}

export function Tabs<T extends string>({ value, tabs, onChange }: { value: T; tabs: { value: T; label: ReactNode; badge?: ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((tab) => (
        <button key={tab.value} type="button" role="tab" aria-selected={value === tab.value}
          className={`tab ${value === tab.value ? 'on' : ''}`} onClick={() => onChange(tab.value)}>
          {tab.label}{tab.badge != null && <span className="tab-badge">{tab.badge}</span>}
        </button>
      ))}
    </div>
  )
}

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: ReactNode; cls?: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button type="button" key={o.value} className={`${value === o.value ? 'on' : ''} ${o.cls ?? ''}`} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Stars({ value, onChange }: { value?: number; onChange?: (v?: number) => void }) {
  return (
    <span className="stars">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={value != null && i <= value ? 'on' : ''} onClick={() => onChange?.(value === i ? undefined : i)}>★</span>
      ))}
    </span>
  )
}

export function ChipPicker({ options, value, onChange, bad, allowAdd, format = (x) => x }: {
  options: string[]; value: string[]; onChange: (v: string[]) => void; bad?: boolean; allowAdd?: boolean; format?: (v: string) => string
}) {
  const t = useT()
  const [draft, setDraft] = useState('')
  const all = [...new Set([...options, ...value])]
  const toggle = (o: string) => onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o])
  const add = () => {
    const v = draft.trim()
    if (v && !value.includes(v)) onChange([...value, v])
    setDraft('')
  }
  return (
    <div className="chips">
      {all.map((o) => (
        <span key={o} className={`chip ${bad ? 'bad' : ''} ${value.includes(o) ? 'on' : ''}`} onClick={() => toggle(o)}>{format(o)}</span>
      ))}
      {allowAdd && (
        <input
          style={{ width: 140, padding: '3px 9px', borderRadius: 999, fontSize: 12 }}
          placeholder={t.form.addChip}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          onBlur={add}
        />
      )}
    </div>
  )
}

export function Empty({ title, icon, children }: { title: string; icon?: HugeiconsIconProps['icon']; children?: ReactNode }) {
  return (
    <div className="empty">
      {icon && <div className="empty-icon"><Icon icon={icon} size={28} /></div>}
      <h2>{title}</h2>
      {children}
    </div>
  )
}

export function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  return <div className="lightbox" onClick={onClose}><img src={src} alt="" /></div>
}
