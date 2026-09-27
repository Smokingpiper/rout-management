type BarItem = { label: string; value: number }

const PALETTE = ['var(--accent)', 'var(--accent-2)', 'var(--warn)', 'var(--danger)', 'var(--text-3)']

export default function BarChart({
  items, formatValue, height = 160,
}: {
  items: BarItem[]
  formatValue?: (v: number) => string
  height?: number
}) {
  if (items.length === 0) {
    return <div style={{ fontSize: 13, color: 'var(--text-3)' }}>データがありません</div>
  }
  const max = Math.max(...items.map(i => i.value), 1)
  const fmt = formatValue ?? (v => v.toLocaleString())

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, height: height + 48, padding: '8px 4px 0' }}>
      {items.map((item, i) => {
        const barHeight = Math.max((item.value / max) * height, item.value > 0 ? 3 : 0)
        return (
          <div key={item.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '1 1 0', minWidth: 0 }}>
            <div style={{ fontSize: 12, marginBottom: 4, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>{fmt(item.value)}</div>
            <div
              style={{
                width: '100%', maxWidth: 48, height: barHeight,
                background: PALETTE[i % PALETTE.length],
                borderRadius: '4px 4px 0 0',
              }}
              title={`${item.label}: ${fmt(item.value)}`}
            />
            <div style={{
              fontSize: 11.5, color: 'var(--text-3)', marginTop: 6, textAlign: 'center',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%',
            }}>
              {item.label}
            </div>
          </div>
        )
      })}
    </div>
  )
}
