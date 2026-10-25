'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Item = { id: string; name: string; parentId: string | null; depth: 0 | 1 }

export default function WasteTypeMaster({ companyId, items }: { companyId: string; items: Item[] }) {
  const router = useRouter()
  const topLevel = items.filter(i => i.depth === 0)
  const [newName, setNewName] = useState('')
  const [newParent, setNewParent] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function call(url: string, method: string, body?: unknown): Promise<boolean> {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
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
    if (!newName.trim()) { setError('名前を入力してください'); return }
    if (await call('/api/union/waste-types', 'POST', { companyId, name: newName.trim(), parentId: newParent || null })) setNewName('')
  }

  return (
    <>
      <div className="card">
        <div className="card-title">登録済みの収集物（{items.length}件）</div>
        {items.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--text-3)' }}>まだ登録されていません。下のフォームから、古紙・ビン・缶などを追加してください。</p>
        )}
        {items.map(item => (
          <Row key={item.id} item={item} topLevel={topLevel} busy={busy} onCall={call} />
        ))}
        {error && <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 10 }}>{error}</p>}
      </div>

      <div className="card">
        <div className="card-title">収集物を追加</div>
        <div className="grid-cards" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 12 }}>
          <div className="field">
            <label>名前</label>
            <input className="text-input" style={{ width: '100%' }} value={newName} onChange={e => setNewName(e.target.value)} placeholder="例：古紙 ／ 新聞" />
          </div>
          <div className="field">
            <label>区分</label>
            <select className="text-input" style={{ width: '100%' }} value={newParent} onChange={e => setNewParent(e.target.value)}>
              <option value="">大分類として追加（古紙・ビン・缶 など）</option>
              {topLevel.map(t => <option key={t.id} value={t.id}>「{t.name}」の内訳として追加</option>)}
            </select>
          </div>
        </div>
        <button className="btn primary" disabled={busy} onClick={add}>追加する</button>
      </div>
    </>
  )
}

function Row({
  item, topLevel, busy, onCall,
}: {
  item: Item
  topLevel: Item[]
  busy: boolean
  onCall: (url: string, method: string, body?: unknown) => Promise<boolean>
}) {
  const [name, setName] = useState(item.name)
  const changed = name.trim() !== item.name

  return (
    <div className="spot-row" style={{ flexWrap: 'wrap', gap: 8, paddingLeft: item.depth ? 22 : 0 }}>
      <span style={{ color: 'var(--text-3)' }}>{item.depth ? '└' : '■'}</span>
      <input className="text-input" style={{ flex: '1 1 140px', minWidth: 0 }} value={name} onChange={e => setName(e.target.value)} />
      <select
        className="text-input"
        style={{ flex: '0 1 170px' }}
        value={item.parentId ?? ''}
        disabled={busy}
        onChange={e => onCall(`/api/union/waste-types/${item.id}`, 'PATCH', { parentId: e.target.value || null })}
        aria-label="区分"
      >
        <option value="">大分類</option>
        {topLevel.filter(t => t.id !== item.id).map(t => <option key={t.id} value={t.id}>「{t.name}」の内訳</option>)}
      </select>
      {changed && (
        <button className="btn sm primary" disabled={busy} onClick={() => onCall(`/api/union/waste-types/${item.id}`, 'PATCH', { name })}>名前を保存</button>
      )}
      <button
        className="btn sm"
        disabled={busy}
        style={{ color: 'var(--danger)' }}
        onClick={() => { if (confirm(`「${item.name}」を削除します。よろしいですか？\n（日報や単価で使われているものは削除できません）`)) onCall(`/api/union/waste-types/${item.id}`, 'DELETE') }}
      >
        削除
      </button>
    </div>
  )
}
