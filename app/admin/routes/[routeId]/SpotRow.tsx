'use client'

import { useState } from 'react'

type Spot = {
  id: string
  orderInRoute: number
  address: string | null
  latitude: number
  longitude: number
  isAlertSpot: boolean
}

export default function SpotRow({ spot, notes }: { spot: Spot; notes: string[] }) {
  const [address, setAddress] = useState(spot.address ?? '')
  const [editing, setEditing] = useState(false)
  const [isAlertSpot, setIsAlertSpot] = useState(spot.isAlertSpot)
  const [saving, setSaving] = useState(false)

  async function patch(body: Record<string, unknown>) {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/spots/${spot.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      return res.ok
    } finally {
      setSaving(false)
    }
  }

  async function saveAddress() {
    if (await patch({ address })) setEditing(false)
  }

  async function toggleAlert() {
    const next = !isAlertSpot
    setIsAlertSpot(next)
    const ok = await patch({ isAlertSpot: next })
    if (!ok) setIsAlertSpot(!next)
  }

  return (
    <tr>
      <td style={{ color: 'var(--text-3)', fontFamily: 'monospace' }}>{spot.orderInRoute}</td>
      <td>
        {editing ? (
          <div style={{ display: 'flex', gap: 6 }}>
            <input className="text-input" style={{ flex: 1 }} value={address} onChange={e => setAddress(e.target.value)} />
            <button className="btn primary" disabled={saving} onClick={saveAddress}>保存</button>
            <button className="btn" onClick={() => { setEditing(false); setAddress(spot.address ?? '') }}>戻す</button>
          </div>
        ) : (
          <span onClick={() => setEditing(true)} style={{ cursor: 'pointer' }} title="クリックして編集">
            {address || <span style={{ color: 'var(--text-3)' }}>（住所未設定）</span>}
          </span>
        )}
      </td>
      <td style={{ fontFamily: 'monospace', fontSize: 11.5, color: 'var(--text-3)' }}>
        {spot.latitude.toFixed(6)}, {spot.longitude.toFixed(6)}
      </td>
      <td style={{ fontSize: 12, color: 'var(--text-2)' }}>
        {notes.length > 0 ? notes.join(' / ') : ''}
      </td>
      <td className="checkbox-cell">
        <input type="checkbox" checked={isAlertSpot} disabled={saving} onChange={toggleAlert} />
      </td>
    </tr>
  )
}
