'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ApproveActions({ reportId, status }: { reportId: string; status: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function setStatus(next: 'approved' | 'in_progress') {
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/daily-reports/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      if (res.ok) router.refresh()
    } finally {
      setBusy(false)
    }
  }

  if (status === 'approved') {
    return (
      <div className="card">
        <span className="pill ok">承認済みです</span>
        <div style={{ marginTop: 10 }}>
          <button className="btn" disabled={busy} onClick={() => setStatus('in_progress')}>承認を取り消す</button>
        </div>
      </div>
    )
  }

  return (
    <div className="card" style={{ display: 'flex', gap: 10 }}>
      <button className="btn" disabled={busy} onClick={() => setStatus('in_progress')}>差し戻す</button>
      <button className="btn primary" disabled={busy} onClick={() => setStatus('approved')}>日報を承認する</button>
    </div>
  )
}
