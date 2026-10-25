'use client'

import { useState } from 'react'

export default function ContactCard({ userId, initialPhone }: { userId: string; initialPhone: string | null }) {
  const [phone, setPhone] = useState(initialPhone ?? '')
  const [saved, setSaved] = useState(initialPhone ?? '')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)

  async function save() {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/admin/users/${userId}/contact`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: phone }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setMessage({ text: data.error || '保存に失敗しました', error: true }); return }
      setSaved(data.phoneNumber ?? '')
      setPhone(data.phoneNumber ?? '')
      setMessage({ text: '保存しました', error: false })
    } catch {
      setMessage({ text: '通信に失敗しました。もう一度お試しください', error: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <div className="card-title">連絡先（電話番号）</div>
      <p style={{ fontSize: 12.5, color: 'var(--text-2)', marginBottom: 10 }}>
        登録すると、日報一覧の「巡回状況」で周回漏れの恐れがあるときに、ここからワンタップで電話をかけられます。
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          className="text-input" style={{ flex: '1 1 200px' }} type="tel" inputMode="tel"
          value={phone} onChange={e => { setPhone(e.target.value); setMessage(null) }} placeholder="例：090-1234-5678"
        />
        <button className="btn primary" disabled={busy || phone.trim() === saved} onClick={save}>保存</button>
      </div>
      {message && <p style={{ fontSize: 12.5, marginTop: 8, color: message.error ? 'var(--danger)' : 'var(--accent)' }}>{message.text}</p>}
    </div>
  )
}
