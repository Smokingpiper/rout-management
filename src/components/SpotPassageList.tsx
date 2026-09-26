'use client'

type SpotRow = { id: string; orderInRoute: number; address: string | null; lat: number; lng: number }

export default function SpotPassageList({
  spots, missedIds, selectedId, onSelect,
}: {
  spots: SpotRow[]
  missedIds: Set<string>
  selectedId: string | null
  onSelect: (spot: SpotRow) => void
}) {
  return (
    <div style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
      {spots.map(s => {
        const missed = missedIds.has(s.id)
        const isSelected = selectedId === s.id
        return (
          <div
            key={s.id}
            onClick={() => onSelect(s)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', cursor: 'pointer', fontSize: 12.5,
              borderBottom: '1px solid var(--border)',
              background: isSelected ? 'var(--accent-dim)' : 'transparent',
            }}
          >
            <span>{missed ? '⚠️' : '✅'}</span>
            <span style={{ color: 'var(--text-3)', fontFamily: 'monospace', flexShrink: 0 }}>#{s.orderInRoute}</span>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.address}</span>
          </div>
        )
      })}
      {spots.length === 0 && (
        <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>スポットがありません</div>
      )}
    </div>
  )
}
