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
  const [photoStatus, setPhotoStatus] = useState<Record<'report' | 'receipt', 'idle' | 'uploading' | 'done' | 'error' | 'unavailable'>>({ report: 'idle', receipt: 'idle' })

  async function uploadPhoto(type: 'report' | 'receipt', file: File) {
    setPhotoStatus(s => ({ ...s, [type]: 'uploading' }))
    const form = new FormData()
    form.append('file', file)
    form.append('dailyReportId', report.id)
    form.append('type', type)
    try {
      const res = await fetch('/api/driver/upload-photo', { method: 'POST', body: form })
      if (res.status === 503) {
        setPhotoStatus(s => ({ ...s, [type]: 'unavailable' }))
        return
      }
      if (!res.ok) throw new Error('failed')
      setPhotoStatus(s => ({ ...s, [type]: 'done' }))
    } catch {
      setPhotoStatus(s => ({ ...s, [type]: 'error' }))
    }
  }

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
        <label>日報の写真</label>
        <input type="file" accept="image/*" capture="environment" onChange={e => e.target.files?.[0] && uploadPhoto('report', e.target.files[0])} />
        <PhotoStatusLine status={photoStatus.report} />
      </div>
      <div className="field">
        <label>回収レシートの写真</label>
        <input type="file" accept="image/*" capture="environment" onChange={e => e.target.files?.[0] && uploadPhoto('receipt', e.target.files[0])} />
        <PhotoStatusLine status={photoStatus.receipt} />
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

function PhotoStatusLine({ status }: { status: 'idle' | 'uploading' | 'done' | 'error' | 'unavailable' }) {
  if (status === 'idle') return <div className="hint">任意。自動でストレージに保存されます</div>
  if (status === 'uploading') return <div className="hint">アップロード中…</div>
  if (status === 'done') return <div className="hint" style={{ color: 'var(--accent)' }}>✓ アップロード完了</div>
  if (status === 'unavailable') return <div className="hint" style={{ color: 'var(--warn)' }}>写真ストレージが未設定のため、今はアップロードできません</div>
  return <div className="hint" style={{ color: 'var(--danger)' }}>アップロードに失敗しました</div>
}
