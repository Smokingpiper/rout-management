type TrendPoint = { label: string; value: number }

export default function TrendChart({
  points, formatValue, color = 'var(--accent)',
}: {
  points: TrendPoint[]
  formatValue?: (v: number) => string
  color?: string
}) {
  if (points.length === 0) {
    return <div style={{ fontSize: 13, color: 'var(--text-3)' }}>データがありません</div>
  }
  const fmt = formatValue ?? (v => v.toLocaleString())
  const W = 640
  const H = 160
  const PAD = 24
  const max = Math.max(...points.map(p => p.value), 1)
  const min = Math.min(...points.map(p => p.value), 0)
  const range = max - min || 1
  const stepX = points.length > 1 ? (W - PAD * 2) / (points.length - 1) : 0

  const coords = points.map((p, i) => {
    const x = PAD + i * stepX
    const y = PAD + (H - PAD * 2) * (1 - (p.value - min) / range)
    return { x, y, ...p }
  })
  const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ')

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W, height: H }}>
        <path d={path} fill="none" stroke={color} strokeWidth={2} />
        {coords.map(c => (
          <g key={c.label}>
            <circle cx={c.x} cy={c.y} r={3.5} fill={color} />
            <text x={c.x} y={H - 4} fontSize={10} fill="var(--text-3)" textAnchor="middle">{c.label}</text>
          </g>
        ))}
      </svg>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 4 }}>
        {coords.map(c => (
          <span key={c.label} style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{c.label}: <b style={{ color: 'var(--text-2)' }}>{fmt(c.value)}</b></span>
        ))}
      </div>
    </div>
  )
}
