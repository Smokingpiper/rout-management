'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Item = { id: string; plateNumber: string; name: string | null; active: boolean }

export default function VehicleMaster({ items }: { items: Item[] }) {
  const router = useRouter()
  const [plate, setPlate] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function call(url: string, method: string, body: unknown): Promise<boolean> {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error || '保存に失敗しました'); return false }
      router.refresh()
      return true
    } catch {
      setError('通信に失敗しました。もう一度お試しください')
      return false
    } finally {
      setBusy(false)
    }
  }

  async function add() {
    if (!plate.trim()) { setError('ナンバープレートを入力してください'); return }
    if (await call('/api/admin/vehicles', 'POST', { plateNumber: plate, name })) { setPlate(''); setName('') }
  }

  return (
    <>
      <div className="card">
        <div className="card-title">登録済みの車両（{items.length}台）</div>
        {items.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--text-3)' }}>まだ登録されていません。下のフォームから追加してください。</p>
        )}
        {items.map(v => <Row key={v.id} item={v} busy={busy} onCall={call} />)}
        {error && <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 10 }}>{error}</p>}
      </div>

      <div className="card">
        <div className="card-title">車両を追加</div>
        <div className="grid-cards" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 12 }}>
          <div className="field">
            <label>ナンバープレート</label>
            <input className="text-input" style={{ width: '100%' }} value={plate} onChange={e => setPlate(e.target.value)} placeholder="例：品川 800 あ 1234" />
          </div>
          <div className="field">
            <label>呼び名（任意）</label>
            <input className="text-input" style={{ width: '100%' }} value={name} onChange={e => setName(e.target.value)} placeholder="例：2tパッカー車" />
          </div>
        </div>
        <button className="btn primary" disabled={busy} onClick={add}>追加する</button>
      </div>
    </>
  )
}

function Row({ item, busy, onCall }: { item: Item; busy: boolean; onCall: (url: string, method: string, body: unknown) => Promise<boolean> }) {
  const [plate, setPlate] = useState(item.plateNumber)
  const [name, setName] = useState(item.name ?? '')
  const changed = plate.trim() !== item.plateNumber || name.trim() !== (item.name ?? '')

  return (
    <div className="spot-row" style={{ flexWrap: 'wrap', gap: 8, opacity: item.active ? 1 : 0.55 }}>
      <input className="text-input" style={{ flex: '1 1 160px', minWidth: 0 }} value={plate} onChange={e => setPlate(e.target.value)} aria-label="ナンバープレート" />
      <input className="text-input" style={{ flex: '1 1 120px', minWidth: 0 }} value={name} onChange={e => setName(e.target.value)} placeholder="呼び名" aria-label="呼び名" />
      {!item.active && <span className="pill muted">使用停止中</span>}
      {changed && (
        <button className="btn sm primary" disabled={busy} onClick={() => onCall(`/api/admin/vehicles/${item.id}`, 'PATCH', { plateNumber: plate, name })}>保存</button>
      )}
      <button className="btn sm" disabled={busy} onClick={() => onCall(`/api/admin/vehicles/${item.id}`, 'PATCH', { active: !item.active })}>
        {item.active ? '使用停止にする' : '使用を再開する'}
      </button>
    </div>
  )
}
