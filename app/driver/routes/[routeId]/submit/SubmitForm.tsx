'use client'

import { useState } from 'react'

type WasteType = { id: string; name: string }
type Report = { id: string; wasteTypeId: string | null; totalWeightKg: number | null; memo: string | null; status: string }

export default function SubmitForm({
  routeId, report, wasteTypeList, spotCount,
}: { routeId: string; report: Report; wasteTypeList: WasteType[]; spotCount: number }) {
  const [wasteTypeId, setWasteTypeId] = useState(report.wasteTypeId ?? '')
  const [weight, setWeight] = useState(report.totalWeightKg?.toString() ?? '')
  const [memo, setMemo] = useState(report.memo ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(report.status !== 'in_progress')

  async function submit() {
    if (!weight) {
      setError('総重量を入力してください')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/driver/daily-reports/${report.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wasteTypeId: wasteTypeId || null,
          totalWeightKg: Number(weight),
          memo,
          submit: true,
        }),
      })
      if (!res.ok) throw new Error('failed')
      setDone(true)
    } catch {
      setError('提出に失敗しました。電波状況を確認してもう一度お試しください。')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="card">
        <span className="pill ok">日報を提出しました</span>
        <p style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 10 }}>お疲れ様でした。会社管理者の承認をお待ちください。</p>
        <a className="btn" href="/driver" style={{ marginTop: 14 }}>ルート一覧に戻る</a>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="field">
        <label>スポット到達状況</label>
        <div style={{ fontSize: 13, color: 'var(--text-2)' }}>全{spotCount}件（軌跡は「軌跡マップ」で確認できます）</div>
      </div>
      <div className="field">
        <label>ゴミ種別（本日のルート全体で1種類）</label>
        <select value={wasteTypeId} onChange={e => setWasteTypeId(e.target.value)}>
          <option value="">未設定</option>
          {wasteTypeList.map(wt => <option key={wt.id} value={wt.id}>{wt.name}</option>)}
        </select>
      </div>
      <div className="field">
        <label>総重量（kg）必須</label>
        <input type="number" step="0.1" value={weight} onChange={e => setWeight(e.target.value)} placeholder="例：142.5" />
        <div className="hint">ごみ収集車の計量器に表示された値をそのまま入力する</div>
      </div>
      <div className="field">
        <label>日報・回収レシートの写真</label>
        <div className="hint">写真アップロードは準備中です（ストレージ設定後に対応）</div>
      </div>
      <div className="field">
        <label>メモ</label>
        <textarea rows={2} value={memo} onChange={e => setMemo(e.target.value)} placeholder="特記事項など" />
      </div>
      {error && <div style={{ color: 'var(--danger)', fontSize: 12.5, marginBottom: 10 }}>{error}</div>}
      <button className="btn primary" disabled={submitting} onClick={submit}>
        {submitting ? '送信中…' : '日報を提出する'}
      </button>
    </div>
  )
}
