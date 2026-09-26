'use client'

import { useState } from 'react'

const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']

type RouteRow = { id: string; name: string; areaName: string; daysOfWeek: number[] }

export default function ScheduleForm({ userId, routes }: { userId: string; routes: RouteRow[] }) {
  const [schedule, setSchedule] = useState<Record<string, Set<number>>>(
    () => Object.fromEntries(routes.map(r => [r.id, new Set(r.daysOfWeek)])),
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  function toggleDay(routeId: string, day: number) {
    setSaved(false)
    setSchedule(prev => {
      const next = new Set(prev[routeId])
      if (next.has(day)) next.delete(day)
      else next.add(day)
      return { ...prev, [routeId]: next }
    })
  }

  async function save() {
    setSaving(true)
    try {
      const assignments = routes
        .map(r => ({ routeId: r.id, daysOfWeek: [...(schedule[r.id] ?? [])].sort() }))
        .filter(a => a.daysOfWeek.length > 0)

      const res = await fetch(`/api/admin/users/${userId}/routes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignments }),
      })
      if (res.ok) setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card">
      <table>
        <thead>
          <tr>
            <th>ルート</th>
            {DAY_LABELS.map((label, day) => (
              <th key={day} className="checkbox-cell">{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {routes.map(r => (
            <tr key={r.id}>
              <td>{r.areaName} — {r.name}</td>
              {DAY_LABELS.map((_, day) => (
                <td key={day} className="checkbox-cell">
                  <input
                    type="checkbox"
                    checked={schedule[r.id]?.has(day) ?? false}
                    onChange={() => toggleDay(r.id, day)}
                  />
                </td>
              ))}
            </tr>
          ))}
          {routes.length === 0 && (
            <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-3)', padding: '20px 0' }}>ルートがありません</td></tr>
          )}
        </tbody>
      </table>

      <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'center' }}>
        <button className="btn primary" disabled={saving} onClick={save}>保存</button>
        {saved && <span className="pill ok">保存しました</span>}
      </div>
    </div>
  )
}
