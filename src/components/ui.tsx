import { useEffect, useState, type ReactNode } from 'react'
import { useT } from '../i18n'
import { pnlClass } from '../lib/format'

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
          <button className="ghost" onClick={onClose} aria-label={t.common.close}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Kpi({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: number }) {
  return (
    <div className="card kpi">
      <div className="label">{label}</div>
      <div className={`value ${tone != null ? pnlClass(tone) : ''}`}>{value}</div>
      {sub != null && <div className="sub">{sub}</div>}
    </div>
  )
}

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string; cls?: string }[]; onChange: (v: T) => void }) {
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

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <h2>{title}</h2>
      {children}
    </div>
  )
}

export function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  return <div className="lightbox" onClick={onClose}><img src={src} alt="" /></div>
}
