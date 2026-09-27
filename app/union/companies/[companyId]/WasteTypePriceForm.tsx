'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const NEW_WASTE_TYPE = '__new__'

export default function WasteTypePriceForm({
  companyId, wasteTypeOptions,
}: {
  companyId: string
  wasteTypeOptions: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [wasteTypeId, setWasteTypeId] = useState(wasteTypeOptions[0]?.id ?? NEW_WASTE_TYPE)
  const [newName, setNewName] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const [effectiveFrom, setEffectiveFrom] = useState(todayStr())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isNew = wasteTypeId === NEW_WASTE_TYPE

  async function submit() {
    if (isNew && !newName.trim()) {
      setError('品目名を入力してください')
      return
    }
    if (!unitPrice) {
      setError('単価を入力してください')
      return
    }
    setSaving(true)
    setError(null)
    try {
      let targetWasteTypeId = wasteTypeId
      if (isNew) {
        const res = await fetch('/api/union/waste-types', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyId, name: newName.trim() }),
        })
        if (!res.ok) throw new Error('failed')
        const created = await res.json()
        targetWasteTypeId = created.id
      }
      const res = await fetch('/api/union/waste-type-prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wasteTypeId: targetWasteTypeId, unitPrice: Number(unitPrice), effectiveFrom }),
      })
      if (!res.ok) throw new Error('failed')
      setUnitPrice('')
      setNewName('')
      router.refresh()
    } catch {
      setError('保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card">
      <div className="card-title">品目マスタ・単価を登録</div>
      <div className="grid-cards" style={{ gridTemplateColumns: '1fr 1fr 1fr', marginBottom: 12 }}>
        <div className="field">
          <label>品目</label>
          <select className="text-input" style={{ width: '100%' }} value={wasteTypeId} onChange={e => setWasteTypeId(e.target.value)}>
            {wasteTypeOptions.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            <option value={NEW_WASTE_TYPE}>＋ 新しい品目を追加</option>
          </select>
          {isNew && (
            <input
              className="text-input" style={{ width: '100%', marginTop: 6 }}
              value={newName} onChange={e => setNewName(e.target.value)} placeholder="品目名（例：古紙）"
            />
          )}
        </div>
        <div className="field">
          <label>単価（円 / kg）</label>
          <input className="text-input" style={{ width: '100%' }} type="number" step="0.1" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} placeholder="例：15" />
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
