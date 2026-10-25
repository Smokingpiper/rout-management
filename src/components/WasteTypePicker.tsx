'use client'

import { useState } from 'react'

type Option = { id: string; name: string }

// 今回の収集物（古紙・ビン・缶など＝大分類）を選ぶ。選ぶとその日の日報に保存される。
// 内訳（古紙の中の新聞・雑誌・段ボール）ごとの重さは、日報の提出時に入力する
export default function WasteTypePicker({
  reportId, options, initialId, disabled = false,
}: { reportId: string; options: Option[]; initialId: string | null; disabled?: boolean }) {
  const [selected, setSelected] = useState(initialId)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (options.length === 0) return null

  async function choose(id: string) {
    if (disabled || saving || id === selected) return
    const prev = selected
    setSelected(id)
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/driver/daily-reports/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wasteTypeId: id }),
      })
      if (!res.ok) throw new Error('failed')
    } catch {
      setSelected(prev)
      setError('保存できませんでした。電波状況を確認してもう一度お試しください')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card">
      <div className="card-title">
        今回の収集物
        {selected
          ? <span className="pill ok">{options.find(o => o.id === selected)?.name ?? '選択済み'}</span>
          : <span className="pill warn">選んでください</span>}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {options.map(o => {
          const on = o.id === selected
          return (
            <button
              key={o.id}
              type="button"
              disabled={disabled || saving}
              onClick={() => choose(o.id)}
              style={{
                minHeight: 44, padding: '0 18px', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer',
                border: `1.5px solid ${on ? 'var(--accent-2)' : 'var(--border)'}`,
                background: on ? 'var(--accent-2)' : 'var(--bg-2)',
                color: on ? '#fff' : 'var(--text-2)',
              }}
            >
              {o.name}
            </button>
          )
        })}
      </div>
      {error && <p style={{ color: 'var(--danger)', fontSize: 12.5, marginTop: 8 }}>{error}</p>}
      <p style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 8 }}>
        種類の内訳（新聞・雑誌・段ボールなど）ごとの重さは、日報を提出するときに入力します。
      </p>
    </div>
  )
}
