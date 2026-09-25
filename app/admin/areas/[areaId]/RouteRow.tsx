'use client'

import { useState } from 'react'

type WasteType = { id: string; name: string }
type Route = { id: string; name: string; defaultWasteTypeId: string | null }

export default function RouteRow({
  route, spotCount, wasteTypeList,
}: { route: Route; spotCount: number; wasteTypeList: WasteType[] }) {
  const [wasteTypeId, setWasteTypeId] = useState(route.defaultWasteTypeId ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save(newId: string) {
    setWasteTypeId(newId)
    setSaving(true)
    setSaved(false)
    try {
      const res = await fetch(`/api/admin/routes/${route.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultWasteTypeId: newId || null }),
      })
      if (res.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 1500)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <tr>
      <td><a href={`/admin/routes/${route.id}`} style={{ color: 'var(--accent-2)', textDecoration: 'none', fontWeight: 600 }}>{route.name}</a></td>
      <td>
        <select
          className="text-input"
          value={wasteTypeId}
          onChange={e => save(e.target.value)}
          disabled={saving}
        >
          <option value="">未設定</option>
          {wasteTypeList.map(wt => (
            <option key={wt.id} value={wt.id}>{wt.name}</option>
          ))}
        </select>
        {saved && <span className="pill ok" style={{ marginLeft: 8 }}>保存済み</span>}
      </td>
      <td>{spotCount.toLocaleString()}件</td>
      <td><a href={`/admin/routes/${route.id}`} className="btn">スポットを見る</a></td>
    </tr>
  )
}
