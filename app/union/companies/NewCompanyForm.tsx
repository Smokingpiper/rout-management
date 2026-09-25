'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function NewCompanyForm({ unionId }: { unionId: string }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [wasteCategory, setWasteCategory] = useState('')
  const [monthlyFee, setMonthlyFee] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (!name.trim()) {
      setError('会社名を入力してください')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/union/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unionId,
          name: name.trim(),
          wasteCategory: wasteCategory || null,
          monthlyFee: monthlyFee ? Number(monthlyFee) : null,
        }),
      })
      if (!res.ok) throw new Error('failed')
      setName(''); setWasteCategory(''); setMonthlyFee('')
      router.refresh()
    } catch {
      setError('登録に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card">
      <div className="card-title">新規会社登録</div>
      <div className="grid-cards" style={{ gridTemplateColumns: '1fr 1fr 1fr', marginBottom: 12 }}>
        <div className="field">
          <label>会社名</label>
          <input className="text-input" style={{ width: '100%' }} value={name} onChange={e => setName(e.target.value)} placeholder="例：古紙センター" />
        </div>
        <div className="field">
          <label>主な取扱品目</label>
          <input className="text-input" style={{ width: '100%' }} value={wasteCategory} onChange={e => setWasteCategory(e.target.value)} placeholder="例：古紙" />
        </div>
        <div className="field">
          <label>契約月額</label>
          <input className="text-input" style={{ width: '100%' }} type="number" value={monthlyFee} onChange={e => setMonthlyFee(e.target.value)} placeholder="例：48000" />
        </div>
      </div>
      {error && <div style={{ color: 'var(--danger)', fontSize: 12.5, marginBottom: 10 }}>{error}</div>}
      <button className="btn primary" disabled={saving} onClick={submit}>登録する</button>
    </div>
  )
}
