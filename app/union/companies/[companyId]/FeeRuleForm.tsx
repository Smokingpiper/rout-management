'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function FeeRuleForm({ unionId, companyId }: { unionId: string; companyId: string }) {
  const router = useRouter()
  const [feeType, setFeeType] = useState<'rate_percent' | 'fixed_amount'>('rate_percent')
  const [feeValue, setFeeValue] = useState('')
  const [effectiveFrom, setEffectiveFrom] = useState(todayStr())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (!feeValue) {
      setError('値を入力してください')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/union/fee-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unionId, companyId, feeType, feeValue: Number(feeValue), effectiveFrom }),
      })
      if (!res.ok) throw new Error('failed')
      setFeeValue('')
      router.refresh()
    } catch {
      setError('保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card">
      <div className="card-title">新しい手数料ルールを登録</div>
      <div className="grid-cards" style={{ gridTemplateColumns: '1fr 1fr 1fr', marginBottom: 12 }}>
        <div className="field">
          <label>タイプ</label>
          <select className="text-input" style={{ width: '100%' }} value={feeType} onChange={e => setFeeType(e.target.value as any)}>
            <option value="rate_percent">定率（%）</option>
            <option value="fixed_amount">固定額</option>
          </select>
        </div>
        <div className="field">
          <label>値</label>
          <input className="text-input" style={{ width: '100%' }} type="number" step="0.1" value={feeValue} onChange={e => setFeeValue(e.target.value)} placeholder={feeType === 'rate_percent' ? '例：4.0' : '例：5000'} />
        </div>
        <div className="field">
          <label>適用開始日</label>
          <input className="text-input" style={{ width: '100%' }} type="date" value={effectiveFrom} onChange={e => setEffectiveFrom(e.target.value)} />
        </div>
      </div>
      {error && <div style={{ color: 'var(--danger)', fontSize: 12.5, marginBottom: 10 }}>{error}</div>}
      <button className="btn primary" disabled={saving} onClick={submit}>登録する</button>
    </div>
  )
}
