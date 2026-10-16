'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Action = 'chief_stamp' | 'chief_unstamp' | 'approve' | 'return'

// rank: ログイン中の管理者のランク（'chief'=係長 / 'manager'=課長 / null=未設定）
// chiefStamped: 係長欄にすでに押印があるか / chiefStampedByMe: それが自分の押印か
export default function ApproveActions({
  reportId, status, rank, chiefStamped, chiefStampedByMe,
}: {
  reportId: string
  status: string
  rank: 'chief' | 'manager' | null
  chiefStamped: boolean
  chiefStampedByMe: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isChief = rank === 'chief'

  async function run(action: Action) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/daily-reports/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setError(json.error ?? '操作に失敗しました')
        return
      }
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  const errorLine = error && <p style={{ color: 'var(--danger)', fontSize: 12.5, marginTop: 8 }}>{error}</p>

  if (status === 'approved') {
    return (
      <div className="card">
        <span className="pill ok">承認済みです</span>
        {!isChief && (
          <div style={{ marginTop: 10 }}>
            <button className="btn" disabled={busy} onClick={() => run('return')}>承認を取り消す（差し戻す）</button>
          </div>
        )}
        {errorLine}
      </div>
    )
  }

  if (status !== 'pending_approval') {
    return (
      <div className="card">
        <span className="pill muted">ドライバーの提出待ちです（提出後に押印・承認できます）</span>
      </div>
    )
  }

  return (
    <div className="card">
      <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginBottom: 10 }}>
        {isChief
          ? '係長として確認し、押印してください。承認（課長欄の押印）は課長が行います。'
          : chiefStamped
            ? '係長の押印があります。内容を確認して承認（課長欄に押印）してください。'
            : '係長の押印はまだありません。'}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="btn" disabled={busy} onClick={() => run('return')}>差し戻す</button>
        {isChief && !chiefStamped && (
          <button className="btn primary" disabled={busy} onClick={() => run('chief_stamp')}>係長として押印する</button>
        )}
        {chiefStamped && (!isChief || chiefStampedByMe) && (
          <button className="btn" disabled={busy} onClick={() => run('chief_unstamp')}>係長の押印を取り消す</button>
        )}
        {!isChief && (
          <button className="btn primary" disabled={busy} onClick={() => run('approve')}>
            {rank === 'manager' ? '課長として承認・押印する' : '日報を承認する（課長欄に押印）'}
          </button>
        )}
      </div>
      {errorLine}
    </div>
  )
}
