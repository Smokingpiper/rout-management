'use client'

import { isRollCallAnswered, rollCallAlerts, type RollCall } from '@/lib/inspection'

export function formatTime(iso?: string) {
  if (!iso) return null
  return new Date(iso).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' })
}

export const TONE = {
  ok: { bg: 'var(--accent)', fg: '#fff', border: 'var(--accent)' },
  ng: { bg: 'var(--danger)', fg: '#fff', border: 'var(--danger)' },
  neutral: { bg: 'var(--accent-2)', fg: '#fff', border: 'var(--accent-2)' },
} as const

export function Choice({
  label, selected, tone, onClick,
}: { label: string; selected: boolean; tone: keyof typeof TONE; onClick: () => void }) {
  const t = TONE[tone]
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        minWidth: 56, minHeight: 40, padding: '0 14px', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: 'pointer',
        border: `1.5px solid ${selected ? t.border : 'var(--border)'}`,
        background: selected ? t.bg : 'var(--bg-2)',
        color: selected ? t.fg : 'var(--text-2)',
      }}
    >
      {label}
    </button>
  )
}

// 「有／無」「使用／不使用」のような2択。bad側を選ぶと赤で表示して異常が目に入るようにする
export function TriRow({
  label, value, yesLabel, noLabel, yesIsBad, noIsBad, onChange,
}: {
  label: string
  value: boolean | null
  yesLabel: string
  noLabel: string
  yesIsBad?: boolean
  noIsBad?: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 14 }}>{label}</span>
      <span style={{ display: 'flex', gap: 8 }}>
        <Choice label={yesLabel} selected={value === true} tone={yesIsBad ? 'ng' : 'ok'} onClick={() => onChange(true)} />
        <Choice label={noLabel} selected={value === false} tone={noIsBad ? 'ng' : 'ok'} onClick={() => onChange(false)} />
      </span>
    </div>
  )
}

export function RollCallCard({
  title, scheduleHint, value, onChange,
}: { title: string; scheduleHint: string; value: RollCall; onChange: (rc: RollCall) => void }) {
  const set = (patch: Partial<RollCall>) => onChange({ ...value, ...patch })
  const alerts = rollCallAlerts(value)
  const answered = isRollCallAnswered(value)
  return (
    <div className="card">
      <div className="card-title">
        {title}
        <span className={`pill ${answered ? 'ok' : 'muted'}`}>
          {answered ? `記録済${formatTime(value.at) ? ` ${formatTime(value.at)}` : ''}` : scheduleHint}
        </span>
      </div>

      <div className="field">
        <label>点呼者</label>
        <input className="text-input" value={value.caller} onChange={e => set({ caller: e.target.value })} placeholder="点呼を行った人の名前" />
      </div>

      <TriRow label="点呼（対面）" value={value.faceToFace} yesLabel="有" noLabel="無" noIsBad onChange={v => set({ faceToFace: v })} />
      <TriRow label="アルコール検知器" value={value.alcoholDeviceUsed} yesLabel="使用" noLabel="不使用" noIsBad onChange={v => set({ alcoholDeviceUsed: v })} />
      <TriRow label="酒気帯び" value={value.drunk} yesLabel="有" noLabel="無" yesIsBad onChange={v => set({ drunk: v })} />
      <TriRow label="疾病・疲労・睡眠不足 など" value={value.unwell} yesLabel="有" noLabel="無" yesIsBad onChange={v => set({ unwell: v })} />

      <button
        type="button"
        className="btn sm"
        style={{ marginTop: 10, width: '100%' }}
        onClick={() => set({ faceToFace: true, alcoholDeviceUsed: true, drunk: false, unwell: false })}
      >
        ✓ 問題なし（対面あり・検知器使用・酒気帯びなし・体調不良なし）をまとめて入力
      </button>

      {alerts.length > 0 && (
        <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--danger)', fontWeight: 600 }}>
          ⚠️ {alerts.join('・')}（会社管理者が記録を確認できます。必要なら連絡事項に状況を書いてください）
        </div>
      )}

      <div className="field" style={{ marginTop: 12, marginBottom: 0 }}>
        <label>連絡事項</label>
        <textarea className="text-input" rows={2} style={{ width: '100%' }} value={value.note} onChange={e => set({ note: e.target.value })} />
      </div>
    </div>
  )
}

