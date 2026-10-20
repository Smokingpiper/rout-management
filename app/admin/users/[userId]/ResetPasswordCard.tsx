'use client'

import { useState } from 'react'

export default function ResetPasswordCard({ userId, userLabel }: { userId: string; userLabel: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ email: string; password: string } | null>(null)
  const [copied, setCopied] = useState(false)

  async function reset() {
    if (!confirm(`${userLabel} さんの初期パスワードを再発行します。\n今のパスワードは使えなくなり、ログイン中の端末もログアウトされます。よろしいですか？`)) return
    setBusy(true)
    setError('')
    setCopied(false)
    try {
      const res = await fetch(`/api/admin/users/${userId}/reset-password`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error || '再発行に失敗しました'); return }
      setResult({ email: data.email, password: data.temporaryPassword })
    } catch {
      setError('通信に失敗しました。もう一度お試しください')
    } finally {
      setBusy(false)
    }
  }

  async function copy() {
    if (!result) return
    try {
      await navigator.clipboard.writeText(`メールアドレス: ${result.email}\n一時パスワード: ${result.password}`)
      setCopied(true)
    } catch { /* コピーできない環境では手で控えてもらう */ }
  }

  return (
    <div className="card">
      <div className="card-title">初期パスワードの再発行</div>
      <p style={{ fontSize: 12.5, color: 'var(--text-2)', marginBottom: 10 }}>
        パスワードが分からなくなった・招待メッセージを紛失した場合に、新しい一時パスワードを発行します。
        ご本人は次回ログイン時にパスワードの変更を求められます。
      </p>
      <button className="btn" disabled={busy} onClick={reset}>{busy ? '発行中…' : '🔑 初期パスワードを再発行する'}</button>
      {error && <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 10 }}>{error}</p>}

      {result && (
        <div className="card" style={{ background: 'var(--accent-dim)', borderColor: 'var(--accent)', marginTop: 14, marginBottom: 0 }}>
          <b style={{ color: 'var(--accent)' }}>再発行しました</b>
          <p style={{ fontSize: 12.5, marginTop: 8, color: 'var(--text-2)' }}>
            以下の内容をご本人にお伝えください（この画面を離れると再表示できません）。
          </p>
          <table style={{ marginTop: 8 }}>
            <tbody>
              <tr><td style={{ color: 'var(--text-3)', width: 120 }}>メールアドレス</td><td style={{ wordBreak: 'break-all' }}>{result.email}</td></tr>
              <tr><td style={{ color: 'var(--text-3)' }}>一時パスワード</td><td style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 15 }}>{result.password}</td></tr>
            </tbody>
          </table>
          <button className="btn sm" style={{ marginTop: 10 }} onClick={copy}>{copied ? '✓ コピーしました' : '📋 コピー'}</button>
        </div>
      )}
    </div>
  )
}
