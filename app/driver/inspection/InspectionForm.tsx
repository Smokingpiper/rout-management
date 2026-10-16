'use client'

import { useEffect, useRef, useState } from 'react'
import {
  CHECK_GROUPS, ALL_CHECK_ITEMS, SHIFT_TYPES, emptyRollCall, isRollCallAnswered, rollCallAlerts,
  type Checks, type CheckResult, type RollCall, type ShiftType,
} from '@/lib/inspection'

type Initial = {
  shiftType: ShiftType
  vehicleNumber: string
  checks: Checks
  startRollCall: RollCall | null
  endRollCall: RollCall | null
  nearMissNote: string
}

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

function isUntouched(rc: RollCall) {
  return !rc.caller && !rc.note && rc.faceToFace === null && rc.alcoholDeviceUsed === null && rc.drunk === null && rc.unwell === null
}

function formatTime(iso?: string) {
  if (!iso) return null
  return new Date(iso).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' })
}

const TONE = {
  ok: { bg: 'var(--accent)', fg: '#fff', border: 'var(--accent)' },
  ng: { bg: 'var(--danger)', fg: '#fff', border: 'var(--danger)' },
  neutral: { bg: 'var(--accent-2)', fg: '#fff', border: 'var(--accent-2)' },
} as const

function Choice({
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
function TriRow({
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

function RollCallCard({
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

export default function InspectionForm({
  today, nextHref, driverName, initial,
}: { today: string; nextHref: string | null; driverName: string; initial: Initial }) {
  const [shiftType, setShiftType] = useState<ShiftType>(initial.shiftType)
  const [vehicleNumber, setVehicleNumber] = useState(initial.vehicleNumber)
  const [checks, setChecks] = useState<Checks>(initial.checks)
  const [startRollCall, setStartRollCall] = useState<RollCall>(initial.startRollCall ?? emptyRollCall())
  const [endRollCall, setEndRollCall] = useState<RollCall>(initial.endRollCall ?? emptyRollCall())
  const [nearMissNote, setNearMissNote] = useState(initial.nearMissNote)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const dirty = useRef(false)

  function touch() {
    dirty.current = true
    setSaveState('dirty')
  }

  function setCheck(key: string, result: CheckResult) {
    setChecks(prev => ({ ...prev, [key]: { ...prev[key], result } }))
    touch()
  }
  function setAction(key: string, action: string) {
    setChecks(prev => ({ ...prev, [key]: { ...prev[key], action } }))
    touch()
  }
  function allOk(keys: string[]) {
    setChecks(prev => {
      const next = { ...prev }
      for (const k of keys) if (next[k]?.result !== 'ng') next[k] = { result: 'ok' }
      return next
    })
    touch()
  }

  async function save(): Promise<boolean> {
    setSaveState('saving')
    try {
      const res = await fetch('/api/driver/inspection', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shiftType,
          vehicleNumber,
          checks,
          startRollCall: isUntouched(startRollCall) ? null : startRollCall,
          endRollCall: isUntouched(endRollCall) ? null : endRollCall,
          nearMissNote,
        }),
      })
      if (!res.ok) throw new Error('save failed')
      const json = await res.json() as { updatedAt: string; startRollCall: RollCall | null; endRollCall: RollCall | null }
      // 点呼の記録時刻（サーバー付与）だけを反映する。入力途中の内容を上書きしないため他の項目は触らない
      setStartRollCall(prev => (json.startRollCall?.at ? { ...prev, at: json.startRollCall.at } : prev))
      setEndRollCall(prev => (json.endRollCall?.at ? { ...prev, at: json.endRollCall.at } : prev))
      dirty.current = false
      setSavedAt(formatTime(json.updatedAt))
      setSaveState('saved')
      return true
    } catch {
      setSaveState('error')
      return false
    }
  }

  const [going, setGoing] = useState(false)
  async function saveAndGo() {
    if (!nextHref) return
    setGoing(true)
    const ok = await save()
    if (ok) window.location.href = nextHref
    else setGoing(false)
  }

  // 入力のたびに少し待ってから自動保存する（途中で画面を閉じても入力が消えないように）
  useEffect(() => {
    if (!dirty.current) return
    const t = setTimeout(save, 1200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shiftType, vehicleNumber, checks, startRollCall, endRollCall, nearMissNote])

  const answered = ALL_CHECK_ITEMS.filter(i => checks[i.key]?.result).length
  const ngCount = ALL_CHECK_ITEMS.filter(i => checks[i.key]?.result === 'ng').length
  const startReady = answered === ALL_CHECK_ITEMS.length && isRollCallAnswered(startRollCall)
  const missing: string[] = []
  if (answered < ALL_CHECK_ITEMS.length) missing.push(`点検項目（あと${ALL_CHECK_ITEMS.length - answered}項目）`)
  if (!isRollCallAnswered(startRollCall)) missing.push('始業点呼')

  return (
    <>
      <div className="card">
        <div className="card-title">
          {today}
          <span className={`pill ${answered === ALL_CHECK_ITEMS.length ? 'ok' : 'warn'}`}>
            点検 {answered}/{ALL_CHECK_ITEMS.length}項目
          </span>
        </div>
        <div className="field">
          <label>点検者・運転者</label>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{driverName}</div>
        </div>
        <div className="field">
          <label>車両番号</label>
          <input
            className="text-input"
            style={{ width: '100%' }}
            value={vehicleNumber}
            onChange={e => { setVehicleNumber(e.target.value); touch() }}
            placeholder="例：品川 800 あ 1234"
          />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>区分</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {SHIFT_TYPES.map(s => (
              <Choice key={s.value} label={s.label} selected={shiftType === s.value} tone="neutral" onClick={() => { setShiftType(s.value); touch() }} />
            ))}
          </div>
        </div>
      </div>

      {ngCount > 0 && (
        <div className="card" style={{ background: 'var(--danger-dim)', borderColor: 'var(--danger)' }}>
          <b style={{ color: 'var(--danger)' }}>⚠️ ×の項目が{ngCount}件あります。</b>
          <span style={{ fontSize: 12.5, color: 'var(--text-2)' }}> ×の項目には対応内容を入力してください。</span>
        </div>
      )}

      {CHECK_GROUPS.map(group => {
        const keys = group.items.map(i => i.key)
        const done = keys.filter(k => checks[k]?.result).length
        return (
          <div className="card" key={group.key}>
            <div className="card-title">
              {group.title}
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className={`pill ${done === keys.length ? 'ok' : 'muted'}`}>{done}/{keys.length}</span>
                <button type="button" className="btn sm" onClick={() => allOk(keys)}>すべて○</button>
              </span>
            </div>
            {group.items.map(item => {
              const entry = checks[item.key]
              return (
                <div key={item.key} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 14 }}>
                      {item.label}
                      {item.hint && <span style={{ fontSize: 11.5, color: 'var(--text-3)', marginLeft: 6 }}>{item.hint}</span>}
                    </span>
                    <span style={{ display: 'flex', gap: 8 }}>
                      <Choice label="○" selected={entry?.result === 'ok'} tone="ok" onClick={() => setCheck(item.key, 'ok')} />
                      <Choice label="×" selected={entry?.result === 'ng'} tone="ng" onClick={() => setCheck(item.key, 'ng')} />
                    </span>
                  </div>
                  {entry?.result === 'ng' && (
                    <input
                      className="text-input"
                      style={{ width: '100%', marginTop: 8, borderColor: 'var(--danger)' }}
                      value={entry.action ?? ''}
                      onChange={e => setAction(item.key, e.target.value)}
                      placeholder="×の場合の対応（例：空気圧を補充した／整備に連絡した）"
                    />
                  )}
                </div>
              )
            })}
          </div>
        )
      })}

      <RollCallCard title="始業点呼" scheduleHint="作業開始前に実施" value={startRollCall} onChange={rc => { setStartRollCall(rc); touch() }} />
      <RollCallCard title="終業点呼" scheduleHint="作業終了後に実施" value={endRollCall} onChange={rc => { setEndRollCall(rc); touch() }} />

      <div className="card">
        <div className="card-title">ヒヤリハット共有</div>
        <textarea
          className="text-input"
          rows={3}
          style={{ width: '100%' }}
          value={nearMissNote}
          onChange={e => { setNearMissNote(e.target.value); touch() }}
          placeholder="ヒヤリとした・ハッとした出来事があれば記入（なければ空欄でOK）"
        />
      </div>

      {nextHref && (
        <div className="card" style={startReady ? { background: "var(--accent-dim)", borderColor: "var(--accent)" } : undefined}>
          <button className="btn primary" style={{ width: "100%", minHeight: 48, fontSize: 15 }} disabled={!startReady || going} onClick={saveAndGo}>
            {going ? "保存しています…" : "点検を完了してルートを開始する →"}
          </button>
          <p style={{ fontSize: 12, color: startReady ? "var(--accent)" : "var(--text-3)", marginTop: 8 }}>
            {startReady
              ? "ルート画面に進み、GPS記録が自動でONになります。"
              : `未入力: ${missing.join("・")}。入力するとルートを開始できます。`}
          </p>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        <button className="btn primary" disabled={saveState === 'saving'} onClick={() => save()}>今すぐ保存</button>
        <span style={{ fontSize: 12.5, color: saveState === 'error' ? 'var(--danger)' : 'var(--text-3)' }}>
          {saveState === 'saving' && '保存しています…'}
          {saveState === 'dirty' && '入力中…（自動で保存されます）'}
          {saveState === 'saved' && `✓ 保存しました${savedAt ? `（${savedAt}）` : ''}`}
          {saveState === 'error' && '保存に失敗しました。通信状況を確認して「今すぐ保存」を押してください'}
        </span>
        <a className="btn" href="/driver">今日のルートへ →</a>
      </div>
    </>
  )
}
