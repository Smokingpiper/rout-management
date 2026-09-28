'use client'

type SpotRow = { id: string; orderInRoute: number; address: string | null; lat: number; lng: number }

export default function SpotPassageList({
  spots, missedIds, overriddenIds, pendingIds, selectedId, onSelect, onClear, onRestore,
}: {
  spots: SpotRow[]
  missedIds: Set<string>
  overriddenIds: Set<string>
  pendingIds: Set<string>
  selectedId: string | null
  onSelect: (spot: SpotRow) => void
  onClear: (spotId: string) => void
  onRestore: (spotId: string) => void
}) {
  return (
    <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
      {spots.map(s => {
        const overridden = overriddenIds.has(s.id)
        const missed = missedIds.has(s.id) && !overridden
        const isSelected = selectedId === s.id
        const pending = pendingIds.has(s.id)
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
            <span>{overridden ? '☑️' : missed ? '⚠️' : '✅'}</span>
            <span style={{ color: 'var(--text-3)', fontFamily: 'monospace', flexShrink: 0 }}>#{s.orderInRoute}</span>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {s.address}
              {overridden && <span style={{ color: 'var(--text-3)', marginLeft: 6 }}>（手動確認）</span>}
            </span>
            {missed && (
              <button
                className="btn sm"
                disabled={pending}
                onClick={e => { e.stopPropagation(); onClear(s.id) }}
                style={{ flexShrink: 0 }}
              >
                クリア
              </button>
            )}
            {overridden && (
              <button
                className="btn sm"
                disabled={pending}
                onClick={e => { e.stopPropagation(); onRestore(s.id) }}
                style={{ flexShrink: 0, color: 'var(--text-3)' }}
              >
                元に戻す
              </button>
            )}
          </div>
        )
      })}
      {spots.length === 0 && (
        <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>スポットがありません</div>
      )}
    </div>
  )
}
