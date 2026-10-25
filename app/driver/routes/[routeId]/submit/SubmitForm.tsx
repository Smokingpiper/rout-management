'use client'

import { useState } from 'react'
import { emptyRollCall, isRollCallAnswered, type RollCall } from '@/lib/inspection'
import { RollCallCard } from '@/components/RollCallCard'
import { topLevelTypes, weightTargets } from '@/lib/wasteTypes'

type WasteType = { id: string; name: string; parentId: string | null }
type InitialWeight = { wasteTypeId: string; weightKg: number }
type Report = { id: string; wasteTypeId: string | null; totalWeightKg: number | null; memo: string | null; status: string }

export default function SubmitForm({
  report, wasteTypeList, spotCount, early = false, initialEndRollCall = null, initialWeights = [],
}: {
  routeId?: string; report: Report; wasteTypeList: WasteType[]; spotCount: number; early?: boolean
  initialEndRollCall?: RollCall | null; initialWeights?: InitialWeight[]
}) {
  const [endRollCall, setEndRollCall] = useState<RollCall>(initialEndRollCall ?? emptyRollCall())
  // 収集物は大分類（古紙・ビン・缶…）を選ぶ。内訳がある大分類は、内訳ごとの重さを入力する
  const initialCategory = (() => {
    const w = wasteTypeList.find(x => x.id === report.wasteTypeId)
    return w?.parentId ?? w?.id ?? ''
  })()
  const [wasteTypeId, setWasteTypeId] = useState(initialCategory)
  const [weights, setWeights] = useState<Record<string, string>>(() => Object.fromEntries(initialWeights.map(w => [w.wasteTypeId, String(w.weightKg)])))
  const categories = topLevelTypes(wasteTypeList)
  const targets = wasteTypeId ? weightTargets(wasteTypeList, wasteTypeId) : []
  const hasBreakdown = targets.length > 0 && targets[0].id !== wasteTypeId // 内訳ごとに入力するか
  const breakdownTotal = targets.reduce((s, t) => s + (Number(weights[t.id]) || 0), 0)
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
    // 収集物を選んでいれば内訳（または大分類自体）の重さ、未選択なら従来どおり総重量だけを送る
    const weightRows = wasteTypeId ? targets.map(t => ({ wasteTypeId: t.id, weightKg: Number(weights[t.id]) || 0 })).filter(r => r.weightKg > 0) : null
    if (weightRows ? weightRows.length === 0 : !weight) {
      setError(hasBreakdown ? '内訳ごとの重さを1つ以上入力してください' : '総重量を入力してください')
      return
    }
    if (!isRollCallAnswered(endRollCall)) {
      setError('終業点呼の4項目（対面・検知器・酒気帯び・体調）をすべて入力してください')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      // 終業点呼を先に保存する（日報の提出は、点呼の記録が残ってから）
      const callRes = await fetch('/api/driver/inspection/end', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shiftType: early ? 'early' : 'normal', endRollCall }),
      })
      if (!callRes.ok) throw new Error('failed')
      const res = await fetch(`/api/driver/daily-reports/${report.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wasteTypeId: wasteTypeId || null,
          ...(weightRows ? { weights: weightRows } : { totalWeightKg: Number(weight) }),
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
        <label>{early ? '回ったスポット' : 'スポット到達状況'}</label>
        <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
          {early ? `${spotCount}件（上の一覧が日報に載ります。間違いがあれば早朝回収の画面で修正してください）` : `全${spotCount}件（上の軌跡・通過確認で周り損ないがないかご確認ください）`}
        </div>
      </div>
      <div className="field">
        <label>{early ? '収集物' : '収集物（本日のルート全体で1種類）'}</label>
        <select value={wasteTypeId} onChange={e => setWasteTypeId(e.target.value)}>
          <option value="">未設定</option>
          {categories.map(wt => <option key={wt.id} value={wt.id}>{wt.name}</option>)}
        </select>
      </div>
      {wasteTypeId && hasBreakdown ? (
        <div className="field">
          <label>内訳ごとの重さ（kg）合計 {breakdownTotal.toLocaleString(undefined, { maximumFractionDigits: 1 })}kg</label>
          {targets.map(t => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ width: 90, fontSize: 14 }}>{t.name}</span>
              <input type="number" inputMode="decimal" step="0.1" min="0" style={{ flex: 1 }} value={weights[t.id] ?? ''} onChange={e => setWeights(w => ({ ...w, [t.id]: e.target.value }))} placeholder="0" />
            </div>
          ))}
          <div className="hint">計量器の値を、種類ごとに分けて入力する。入力した分の合計が日報の総重量になります</div>
        </div>
      ) : wasteTypeId ? (
        <div className="field">
          <label>総重量（kg）必須</label>
          <input type="number" inputMode="decimal" step="0.1" min="0" value={weights[wasteTypeId] ?? ''} onChange={e => setWeights(w => ({ ...w, [wasteTypeId]: e.target.value }))} placeholder="例：142.5" />
          <div className="hint">ごみ収集車の計量器に表示された値をそのまま入力する</div>
        </div>
      ) : (
        <div className="field">
          <label>総重量（kg）必須</label>
          <input type="number" step="0.1" value={weight} onChange={e => setWeight(e.target.value)} placeholder="例：142.5" />
          <div className="hint">収集物を選ぶと、内訳ごとに入力できる場合があります</div>
        </div>
      )}
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
      <RollCallCard title="終業点呼" scheduleHint="作業終了後に実施（必須）" value={endRollCall} onChange={setEndRollCall} />
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
