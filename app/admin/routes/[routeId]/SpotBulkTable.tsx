'use client'

import { useState } from 'react'
import SpotRow from './SpotRow'

type Spot = {
  id: string
  orderInRoute: number
  address: string | null
  latitude: number
  longitude: number
  isAlertSpot: boolean
}

export default function SpotBulkTable({
  routeId, spotList, noteBySpot,
}: {
  routeId: string
  spotList: Spot[]
  noteBySpot: Record<string, string>
}) {
  const [selected, setSelected] = useState(new Set<string>())
  const [appendNoteText, setAppendNoteText] = useState('')
  const [applying, setApplying] = useState(false)

  const allSelected = spotList.length > 0 && spotList.every(s => selected.has(s.id))

  function toggleOne(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(spotList.map(s => s.id)))
  }

  async function bulkPatch(body: Record<string, unknown>) {
    setApplying(true)
    try {
      const res = await fetch('/api/admin/spots/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spotIds: [...selected], ...body }),
      })
      if (res.ok) {
        setSelected(new Set())
        setAppendNoteText('')
        window.location.reload()
      }
    } finally {
      setApplying(false)
    }
  }

  return (
    <>
      {selected.size > 0 && (
        <div className="card" style={{ background: 'var(--accent-dim)', borderColor: 'var(--accent)', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <b style={{ color: 'var(--accent)' }}>{selected.size}件選択中</b>
          <button className="btn sm primary" disabled={applying} onClick={() => bulkPatch({ isAlertSpot: true })}>要注意に設定</button>
          <button className="btn sm" disabled={applying} onClick={() => bulkPatch({ isAlertSpot: false })}>要注意を解除</button>
          <input
            className="text-input"
            style={{ flex: '1 1 200px' }}
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

      <div className="card">
        <table>
          <thead>
            <tr>
              <th className="checkbox-cell"><input type="checkbox" checked={allSelected} onChange={toggleAll} /></th>
              <th>No.</th>
              <th>住所</th>
              <th>緯度・経度</th>
              <th>備考</th>
              <th className="checkbox-cell">要注意</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {spotList.map(spot => (
              <tr key={spot.id}>
                <td className="checkbox-cell">
                  <input type="checkbox" checked={selected.has(spot.id)} onChange={() => toggleOne(spot.id)} />
                </td>
                <SpotRow spot={spot} note={noteBySpot[spot.id] ?? ''} routeId={routeId} />
              </tr>
            ))}
            {spotList.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-3)', padding: '20px 0' }}>該当するスポットがありません</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
