'use client'

import { useState, type FormEvent } from 'react'

export default function ChangePasswordForm({ requireCurrent }: { requireCurrent: boolean }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (newPassword !== confirmPassword) {
      setError('新しいパスワードが一致しません')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? '変更に失敗しました')
        return
      }
      setDone(true)
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return <span className="pill ok">パスワードを変更しました</span>
  }

  return (
    <form className="card" onSubmit={submit}>
      {requireCurrent && (
        <div className="field">
          <label>現在のパスワード</label>
          <input className="text-input" type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required />
        </div>
      )}
      <div className="field">
        <label>新しいパスワード（8文字以上）</label>
        <input className="text-input" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} minLength={8} required />
      </div>
      <div className="field">
        <label>新しいパスワード（確認）</label>
        <input className="text-input" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} minLength={8} required />
      </div>
      {error && <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 10 }}>{error}</p>}
      <button className="btn primary" type="submit" disabled={submitting} style={{ width: '100%' }}>変更する</button>
    </form>
  )
}
