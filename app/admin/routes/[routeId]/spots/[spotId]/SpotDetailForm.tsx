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
type Driver = { id: string; name: string | null; email: string | null }

const MAX_ASSIGNEES = 5

export default function SpotDetailForm({
  spot, initialNote, routeId, driverList, initialAssignedUserIds,
}: {
  spot: Spot
  initialNote: string
  routeId: string
  driverList: Driver[]
  initialAssignedUserIds: string[]
}) {
  const [note, setNote] = useState(initialNote)
  const [savingNote, setSavingNote] = useState(false)
  const [noteSaved, setNoteSaved] = useState(false)

  const [isAlertSpot, setIsAlertSpot] = useState(spot.isAlertSpot)
  const [savingAlert, setSavingAlert] = useState(false)

  const [assignedUserIds, setAssignedUserIds] = useState(new Set(initialAssignedUserIds))
  const [savingAssignees, setSavingAssignees] = useState(false)
  const [assigneesSaved, setAssigneesSaved] = useState(false)
  const [assigneesError, setAssigneesError] = useState<string | null>(null)

  async function saveNote() {
    setSavingNote(true)
    setNoteSaved(false)
    try {
      const res = await fetch(`/api/admin/spots/${spot.id}/note`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note }),
      })
      if (res.ok) {
        const json = await res.json()
        setNote(json.note ?? '')
        setNoteSaved(true)
        setTimeout(() => setNoteSaved(false), 2000)
      }
    } finally {
      setSavingNote(false)
    }
  }

  async function toggleAlert() {
    const next = !isAlertSpot
    setIsAlertSpot(next)
    setSavingAlert(true)
    try {
      const res = await fetch(`/api/admin/spots/${spot.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAlertSpot: next }),
      })
      if (!res.ok) setIsAlertSpot(!next)
    } finally {
      setSavingAlert(false)
    }
  }

  async function toggleAssignee(userId: string) {
    const next = new Set(assignedUserIds)
    if (next.has(userId)) {
      next.delete(userId)
    } else {
      if (next.size >= MAX_ASSIGNEES) {
        setAssigneesError(`担当は1スポットにつき最大${MAX_ASSIGNEES}人までです`)
        return
      }
      next.add(userId)
    }
    setAssigneesError(null)
    setAssignedUserIds(next)
    setAssigneesSaved(false)
    setSavingAssignees(true)
    try {
      const res = await fetch(`/api/admin/spots/${spot.id}/assignees`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: [...next] }),
      })
      if (res.ok) {
        setAssigneesSaved(true)
        setTimeout(() => setAssigneesSaved(false), 2000)
      } else {
        const json = await res.json().catch(() => ({}))
        setAssigneesError(json.error ?? '保存に失敗しました')
        setAssignedUserIds(assignedUserIds)
      }
    } finally {
      setSavingAssignees(false)
    }
  }

  return (
    <>
      <div className="card">
        <div className="card-title">住所</div>
        <p style={{ fontSize: 14 }}>{spot.address || <span style={{ color: 'var(--text-3)' }}>（住所未設定）</span>}</p>
        <p style={{ fontSize: 11.5, color: 'var(--text-3)', fontFamily: 'monospace' }}>
          {spot.latitude.toFixed(6)}, {spot.longitude.toFixed(6)}
        </p>
        <p style={{ fontSize: 11.5, color: 'var(--text-3)' }}>住所の修正はスポット一覧の画面から行えます</p>
      </div>

      <div className="card">
        <div className="card-title">要注意スポット設定</div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
          <input type="checkbox" checked={isAlertSpot} disabled={savingAlert} onChange={toggleAlert} />
          このスポットを要注意に設定する
        </label>
      </div>

      <div className="card">
        <div className="card-title">備考</div>
        <textarea
          className="text-input"
          style={{ width: '100%', minHeight: 90, resize: 'vertical' }}
          value={note}
          onChange={e => setNote(e.target.value)}
        />
        <div style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn primary" disabled={savingNote} onClick={saveNote}>保存</button>
          {noteSaved && <span className="pill ok">保存しました</span>}
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          担当ドライバー
          <span className="pill info">{assignedUserIds.size}/{MAX_ASSIGNEES}人</span>
        </div>
        {driverList.length === 0 && (
          <p style={{ fontSize: 12.5, color: 'var(--text-3)' }}>まだユーザーが登録されていません（ユーザー招待管理から作成できます）</p>
        )}
        {driverList.map(d => (
          <label key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, padding: '4px 0' }}>
            <input
              type="checkbox"
              checked={assignedUserIds.has(d.id)}
              disabled={savingAssignees}
              onChange={() => toggleAssignee(d.id)}
            />
            {d.name || d.email}
          </label>
        ))}
        {assigneesError && <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 8 }}>{assigneesError}</p>}
        {assigneesSaved && <span className="pill ok" style={{ marginTop: 8, display: 'inline-block' }}>保存しました</span>}
      </div>

      <a className="btn" href={`/admin/routes/${routeId}`}>← スポット一覧に戻る</a>
    </>
  )
}
