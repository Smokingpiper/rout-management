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

export default function SpotRow({ spot, note, routeId }: { spot: Spot; note: string; routeId: string }) {
  const [address, setAddress] = useState(spot.address ?? '')
  const [editingAddress, setEditingAddress] = useState(false)
  const [savingAddress, setSavingAddress] = useState(false)

  const [noteValue, setNoteValue] = useState(note)
  const [editingNote, setEditingNote] = useState(false)
  const [savingNote, setSavingNote] = useState(false)

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
    setSavingAddress(true)
    try {
      if (await patch({ address })) setEditingAddress(false)
    } finally {
      setSavingAddress(false)
    }
  }

  async function saveNote() {
    setSavingNote(true)
    try {
      const res = await fetch(`/api/admin/spots/${spot.id}/note`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: noteValue }),
      })
      if (res.ok) {
        const json = await res.json()
        setNoteValue(json.note ?? '')
        setEditingNote(false)
      }
    } finally {
      setSavingNote(false)
    }
  }

  async function toggleAlert() {
    const next = !isAlertSpot
    setIsAlertSpot(next)
    const ok = await patch({ isAlertSpot: next })
    if (!ok) setIsAlertSpot(!next)
  }

  return (
    <>
      <td style={{ color: 'var(--text-3)', fontFamily: 'monospace' }}>{spot.orderInRoute}</td>
      <td>
        {editingAddress ? (
          <div style={{ display: 'flex', gap: 6 }}>
            <input className="text-input" style={{ flex: 1 }} value={address} onChange={e => setAddress(e.target.value)} />
            <button className="btn primary" disabled={savingAddress} onClick={saveAddress}>保存</button>
            <button className="btn" onClick={() => { setEditingAddress(false); setAddress(spot.address ?? '') }}>戻す</button>
          </div>
        ) : (
          <span onClick={() => setEditingAddress(true)} style={{ cursor: 'pointer' }} title="クリックして編集">
            {address || <span style={{ color: 'var(--text-3)' }}>（住所未設定）</span>}
          </span>
        )}
      </td>
      <td style={{ fontFamily: 'monospace', fontSize: 11.5, color: 'var(--text-3)' }}>
        {spot.latitude.toFixed(6)}, {spot.longitude.toFixed(6)}
      </td>
      <td style={{ fontSize: 12, color: 'var(--text-2)' }}>
        {editingNote ? (
          <div style={{ display: 'flex', gap: 6 }}>
            <input className="text-input" style={{ flex: 1 }} value={noteValue} onChange={e => setNoteValue(e.target.value)} />
            <button className="btn primary" disabled={savingNote} onClick={saveNote}>保存</button>
            <button className="btn" onClick={() => { setEditingNote(false); setNoteValue(note) }}>戻す</button>
          </div>
        ) : (
          <span onClick={() => setEditingNote(true)} style={{ cursor: 'pointer' }} title="クリックして編集">
            {noteValue || <span style={{ color: 'var(--text-3)' }}>（備考なし）</span>}
          </span>
        )}
      </td>
      <td className="checkbox-cell">
        <input type="checkbox" checked={isAlertSpot} disabled={saving} onChange={toggleAlert} />
      </td>
      <td>
        <a className="btn sm" href={`/admin/routes/${routeId}/spots/${spot.id}`}>詳細</a>
      </td>
    </>
  )
}
