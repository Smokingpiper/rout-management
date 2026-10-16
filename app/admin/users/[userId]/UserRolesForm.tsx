'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import SealStamp from '@/components/SealStamp'
import { ADMIN_RANKS, sealTextFor } from '@/lib/seal'

const ROLE_OPTIONS = [
  { value: 'driver', label: 'ドライバー' },
  { value: 'company_admin', label: '会社管理者' },
]

export default function UserRolesForm({
  userId, initialRoles, initialRank, initialSealName, userName, userEmail,
}: {
  userId: string
  initialRoles: string[]
  initialRank: string | null
  initialSealName: string | null
  userName: string | null
  userEmail: string | null
}) {
  const router = useRouter()
  const [roles, setRoles] = useState(new Set(initialRoles))
  const [rank, setRank] = useState(initialRank ?? '')
  const [sealName, setSealName] = useState(initialSealName ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const isAdmin = roles.has('company_admin')
  const sealPreview = sealTextFor({ sealName, name: userName, email: userEmail })

  function toggle(value: string) {
    setRoles(prev => {
      const next = new Set(prev)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
    setSaved(false)
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
        body: JSON.stringify({ roles: [...roles], adminRank: isAdmin ? rank || null : null, sealName }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setError(json.error ?? '保存に失敗しました')
        return
      }
      setSaved(true)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card">
      <div className="card-title">ロール・ランク・印鑑の設定</div>
      <p style={{ fontSize: 12.5, color: 'var(--text-2)', marginBottom: 10 }}>
        会社管理者とドライバーを兼任させることができます。会社管理者にはランク（課長／係長）を設定でき、日報の押印欄に電子印鑑が押されます。
      </p>

      <div className="field">
        <label>ロール</label>
        <div style={{ display: 'flex', gap: 16 }}>
          {ROLE_OPTIONS.map(o => (
            <label key={o.value} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 14 }}>
              <input type="checkbox" checked={roles.has(o.value)} onChange={() => toggle(o.value)} />
              {o.label}
            </label>
          ))}
        </div>
      </div>

      {isAdmin && (
        <div className="field">
          <label>会社管理者のランク</label>
          <select className="text-input" value={rank} onChange={e => { setRank(e.target.value); setSaved(false) }}>
            <option value="">未設定（従来どおり承認でき、課長欄に押印されます）</option>
            {ADMIN_RANKS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <div className="hint">
            課長＝日報を承認（課長欄に押印）できます。係長＝係長欄に押印できますが、承認はできません。
          </div>
        </div>
      )}

      <div className="field">
        <label>電子印鑑の文字（最大4文字・空欄なら氏名の姓から自動で作成）</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <input
            className="text-input" style={{ width: 140 }} maxLength={4} value={sealName}
            onChange={e => { setSealName(e.target.value); setSaved(false) }} placeholder={sealPreview}
          />
          {sealPreview ? <SealStamp text={sealPreview} size={52} /> : <span style={{ fontSize: 12, color: 'var(--text-3)' }}>氏名が未設定です</span>}
        </div>
      </div>

      {error && <p style={{ color: 'var(--danger)', fontSize: 12.5, marginBottom: 10 }}>{error}</p>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="btn primary" disabled={saving} onClick={save}>保存する</button>
        {saved && <span className="pill ok">保存しました</span>}
      </div>
    </div>
  )
}
