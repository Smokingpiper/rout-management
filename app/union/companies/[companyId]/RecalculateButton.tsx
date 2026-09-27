'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RecalculateButton({ companyId }: { companyId: string }) {
  const router = useRouter()
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function run() {
    setRunning(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/union/companies/${companyId}/recalculate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      if (!res.ok) throw new Error('failed')
      const { results } = await res.json() as { results: { yearMonth: string }[] }
      setMessage(results.length > 0 ? `${results.length}件の月を再計算しました` : '対象となる承認済み日報がありませんでした')
      router.refresh()
    } catch {
      setMessage('再計算に失敗しました')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <button className="btn sm" disabled={running} onClick={run}>{running ? '計算中…' : '🔄 月次集計を再計算する'}</button>
      {message && <span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>{message}</span>}
    </div>
  )
}
