'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const ROLE_OPTIONS = [
  { value: 'driver', label: 'ドライバー' },
  { value: 'company_admin', label: '会社管理者' },
]

export default function UserRolesForm({ userId, initialRoles }: { userId: string; initialRoles: string[] }) {
  const router = useRouter()
  const [roles, setRoles] = useState(new Set(initialRoles))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggle(value: string) {
    setRoles(prev => {
      const next = new Set(prev)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
  }

  async function save() {
    if (roles.size === 0) {
      setError('ロールを1つ以上選択してください')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/users/${userId}/roles`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roles: [...roles] }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setError(json.error ?? '保存に失敗しました')
        return
      }
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card">
      <div className="card-title">ロール設定</div>
      <p style={{ fontSize: 12.5, color: 'var(--text-2)', marginBottom: 10 }}>
        会社管理者とドライバーを兼任させることができます（例：配送もするマネージャー）。両方チェックすると両方の画面にアクセスできます。
      </p>
      <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
        {ROLE_OPTIONS.map(o => (
          <label key={o.value} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 14 }}>
            <input type="checkbox" checked={roles.has(o.value)} onChange={() => toggle(o.value)} />
            {o.label}
          </label>
        ))}
      </div>
      {error && <p style={{ color: 'var(--danger)', fontSize: 12.5, marginBottom: 10 }}>{error}</p>}
      <button className="btn primary" disabled={saving} onClick={save}>保存する</button>
    </div>
  )
}
