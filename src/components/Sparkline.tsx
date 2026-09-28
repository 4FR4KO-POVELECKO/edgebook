/** Tiny inline chart for stat cards. `undefined` values (no data that period) leave gaps. */
export function Sparkline({ values, bars, color = 'var(--accent)', height = 28 }: {
  values: (number | undefined)[]; bars?: boolean; color?: string; height?: number
}) {
  const nums = values.filter((v): v is number => v != null && Number.isFinite(v))
  if (nums.length < 2) return <div style={{ height }} />
  const W = 100, H = height, pad = 2
  const min = Math.min(...nums, bars ? 0 : Infinity)
  const max = Math.max(...nums, bars ? 0 : -Infinity)
  const span = max - min || 1
  const x = (i: number) => (i / (values.length - 1)) * W
  const y = (v: number) => pad + (1 - (v - min) / span) * (H - pad * 2)

  if (bars) {
    const bw = W / values.length
    return (
      <svg className="spark" width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
        {values.map((v, i) => v == null ? null : (
          <rect key={i} x={i * bw + bw * 0.15} width={bw * 0.7}
            y={Math.min(y(v), y(0))} height={Math.max(1, Math.abs(y(v) - y(0)))}
            rx={0.8} fill={v >= 0 ? 'var(--pos)' : 'var(--neg)'} opacity={0.85} />
        ))}
      </svg>
    )
  }

  // split into segments at gaps so missing weeks don't draw misleading lines
  const segments: string[] = []
  let cur: string[] = []
  values.forEach((v, i) => {
    if (v == null || !Number.isFinite(v)) { if (cur.length) segments.push(cur.join(' ')); cur = []; return }
    cur.push(`${x(i).toFixed(2)},${y(v).toFixed(2)}`)
  })
  if (cur.length) segments.push(cur.join(' '))
  return (
    <svg className="spark" width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      {segments.map((pts, i) => (
        <polyline key={i} points={pts} fill="none" stroke={color} strokeWidth={1.6}
          strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  )
}

/** Change vs previous period; `good` decides the color, not the direction of the arrow. */
export function Delta({ value, text, good, title }: { value: number; text: string; good: boolean; title?: string }) {
  if (!Number.isFinite(value) || Math.abs(value) < 1e-9) return <span className="delta flat" title={title}>— {text}</span>
  return (
    <span className={`delta ${good ? 'good' : 'bad'}`} title={title}>
      {value > 0 ? '▲' : '▼'} {text}
    </span>
  )
}
