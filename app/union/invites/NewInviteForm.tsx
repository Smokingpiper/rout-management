'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Company = { id: string; name: string }

export default function NewInviteForm({ unionId, companyList }: { unionId: string; companyList: Company[] }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'union_admin' | 'company_admin' | 'driver'>('driver')
  const [companyId, setCompanyId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (!email.trim()) {
      setError('メールアドレスを入力してください')
      return
    }
    if (role !== 'union_admin' && !companyId) {
      setError('所属会社を選択してください')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/union/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unionId,
          email: email.trim(),
          invitedRole: role,
          companyId: role === 'union_admin' ? null : companyId,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'failed')
      }
      setEmail('')
      router.refresh()
    } catch (err: any) {
      setError(err.message === 'duplicate' ? 'このメールアドレスは既に招待されています' : '登録に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card">
      <div className="card-title">新規招待</div>
      <div className="grid-cards" style={{ gridTemplateColumns: '1.5fr 1fr 1fr', marginBottom: 12 }}>
        <div className="field">
          <label>メールアドレス</label>
          <input className="text-input" style={{ width: '100%' }} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" />
        </div>
        <div className="field">
          <label>ロール</label>
          <select className="text-input" style={{ width: '100%' }} value={role} onChange={e => setRole(e.target.value as any)}>
            <option value="driver">ドライバー</option>
            <option value="company_admin">会社管理者</option>
            <option value="union_admin">協会管理者</option>
          </select>
        </div>
        <div className="field">
          <label>所属会社</label>
          <select className="text-input" style={{ width: '100%' }} value={companyId} onChange={e => setCompanyId(e.target.value)} disabled={role === 'union_admin'}>
            <option value="">選択してください</option>
            {companyList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>
      {error && <div style={{ color: 'var(--danger)', fontSize: 12.5, marginBottom: 10 }}>{error}</div>}
      <button className="btn primary" disabled={saving} onClick={submit}>招待を送信</button>
    </div>
  )
}
