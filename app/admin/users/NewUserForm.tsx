'use client'

import { useState } from 'react'

const ROLE_OPTIONS = [
  { value: 'driver', label: 'ドライバー' },
  { value: 'company_admin', label: '会社管理者' },
]

export default function NewUserForm() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState('driver')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ email: string; password: string } | null>(null)

  async function submit() {
    setSubmitting(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, role }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? '登録に失敗しました')
        return
      }
      setResult({ email, password: json.temporaryPassword })
      setEmail('')
      setName('')
      setRole('driver')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="card">
      <div className="card-title">新しいユーザーを招待</div>

      <div className="field">
        <label>メールアドレス</label>
        <input className="text-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="driver@example.com" />
      </div>
      <div className="field">
        <label>氏名（任意）</label>
        <input className="text-input" value={name} onChange={e => setName(e.target.value)} />
      </div>
      <div className="field">
        <label>ロール</label>
        <select className="text-input" value={role} onChange={e => setRole(e.target.value)}>
          {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {error && <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 10 }}>{error}</p>}
      <button className="btn primary" disabled={submitting || !email} onClick={submit}>招待する</button>

      {result && (
        <div className="card" style={{ background: 'var(--accent-dim)', borderColor: 'var(--accent)', marginTop: 14 }}>
          <b style={{ color: 'var(--accent)' }}>登録が完了しました</b>
          <p style={{ fontSize: 12.5, marginTop: 8, color: 'var(--text-2)' }}>
            以下の内容をご本人にお伝えください（この画面を離れると再表示できません）。
          </p>
          <table style={{ marginTop: 8 }}>
            <tbody>
              <tr><td style={{ color: 'var(--text-3)', width: 120 }}>メールアドレス</td><td>{result.email}</td></tr>
              <tr><td style={{ color: 'var(--text-3)' }}>一時パスワード</td><td style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 15 }}>{result.password}</td></tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
