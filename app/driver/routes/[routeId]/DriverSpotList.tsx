'use client'

import { useMemo, useState } from 'react'

type Spot = { id: string; orderInRoute: number; address: string | null; isAlertSpot: boolean; hasNote?: boolean }

export default function DriverSpotList({ routeId, spots: initialSpots }: { routeId: string; spots: Spot[] }) {
  const [spots, setSpots] = useState(initialSpots)
  const [query, setQuery] = useState('')
  const [noteOnly, setNoteOnly] = useState(false)
  const [alertOnly, setAlertOnly] = useState(false)
  const [selected, setSelected] = useState(new Set<string>())
  const [appendNoteText, setAppendNoteText] = useState('')
  const [applying, setApplying] = useState(false)

  const filtered = useMemo(() => spots.filter(s => {
    if (noteOnly && !s.hasNote) return false
    if (alertOnly && !s.isAlertSpot) return false
    if (query && !(s.address ?? '').includes(query)) return false
    return true
  }), [spots, query, noteOnly, alertOnly])

  const allSelected = filtered.length > 0 && filtered.every(s => selected.has(s.id))

  function toggleOne(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(filtered.map(s => s.id)))
  }

  async function bulkPatch(body: { isAlertSpot?: boolean; appendNote?: string }) {
    setApplying(true)
    try {
      const res = await fetch('/api/admin/spots/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spotIds: [...selected], ...body }),
      })
      if (res.ok) {
        setSpots(prev => prev.map(s => {
          if (!selected.has(s.id)) return s
          return {
            ...s,
            isAlertSpot: body.isAlertSpot !== undefined ? body.isAlertSpot : s.isAlertSpot,
            hasNote: body.appendNote ? true : s.hasNote,
          }
        }))
        setSelected(new Set())
        setAppendNoteText('')
      }
    } finally {
      setApplying(false)
    }
  }

  return (
    <details className="card" open>
      <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
        スポット一覧（{filtered.length === spots.length ? `全${spots.length}件` : `${filtered.length}/${spots.length}件`}・タップで折りたたみ）
      </summary>

      <div style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          <input
            className="text-input"
            style={{ flex: '1 1 160px' }}
            placeholder="住所で検索"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={noteOnly} onChange={e => setNoteOnly(e.target.checked)} />
            備考ありのみ
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={alertOnly} onChange={e => setAlertOnly(e.target.checked)} />
            要注意のみ
          </label>
        </div>

        {selected.size > 0 && (
          <div className="card" style={{ background: 'var(--accent-dim)', borderColor: 'var(--accent)', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 10 }}>
            <b style={{ color: 'var(--accent)' }}>{selected.size}件選択中</b>
            <button className="btn sm primary" disabled={applying} onClick={() => bulkPatch({ isAlertSpot: true })}>要注意に設定</button>
            <button className="btn sm" disabled={applying} onClick={() => bulkPatch({ isAlertSpot: false })}>要注意を解除</button>
            <input
              className="text-input"
              style={{ flex: '1 1 160px' }}
              placeholder="追記する備考を入力"
              value={appendNoteText}
              onChange={e => setAppendNoteText(e.target.value)}
            />
            <button
              className="btn sm primary"
              disabled={applying || !appendNoteText.trim()}
              onClick={() => bulkPatch({ appendNote: appendNoteText.trim() })}
            >
              備考を追記
            </button>
          </div>
        )}

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, padding: '4px 0 10px', color: 'var(--text-2)' }}>
          <input type="checkbox" checked={allSelected} onChange={toggleAll} />
          このリストを全選択
        </label>

        {filtered.map(spot => (
          <div className="spot-row" key={spot.id}>
            <input type="checkbox" checked={selected.has(spot.id)} onChange={() => toggleOne(spot.id)} />
            <a
              href={`/driver/routes/${routeId}/spots/${spot.id}`}
              style={{ display: 'flex', gap: 10, flex: 1, alignItems: 'center', textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}
            >
              <span className="spot-order">{spot.orderInRoute}</span>
              <span className="spot-address">{spot.address}</span>
              {spot.hasNote && <span title="備考あり">📝</span>}
              {spot.isAlertSpot && <span className="pill warn">要注意</span>}
            </a>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-3)', padding: '20px 0', fontSize: 13 }}>該当するスポットがありません</div>
        )}
      </div>
    </details>
  )
}
