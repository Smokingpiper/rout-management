'use client'

import { useEffect, useRef, useState } from 'react'
import {
  CHECK_GROUPS, ALL_CHECK_ITEMS, SHIFT_TYPES, emptyRollCall, isRollCallAnswered, isUntouchedRollCall,
  type Checks, type CheckResult, type RollCall, type ShiftType,
} from '@/lib/inspection'
import { Choice, RollCallCard, formatTime } from '@/components/RollCallCard'

type Initial = {
  vehicleNumber: string
  checks: Checks
  startRollCall: RollCall | null
  nearMissNote: string
}

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

export default function InspectionForm({
  today, shiftType, nextHref, driverName, initial,
}: { today: string; shiftType: ShiftType; nextHref: string | null; driverName: string; initial: Initial }) {
  const [vehicleNumber, setVehicleNumber] = useState(initial.vehicleNumber)
  const [checks, setChecks] = useState<Checks>(initial.checks)
  const [startRollCall, setStartRollCall] = useState<RollCall>(initial.startRollCall ?? emptyRollCall())
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
          // 終業点呼は日報の提出時に入力する（ここでは送らない＝サーバー側の既存の記録を保つ）
          startRollCall: isUntouchedRollCall(startRollCall) ? null : startRollCall,
          nearMissNote,
        }),
      })
      if (!res.ok) throw new Error('save failed')
      const json = await res.json() as { updatedAt: string; startRollCall: RollCall | null }
      // 点呼の記録時刻（サーバー付与）だけを反映する。入力途中の内容を上書きしないため他の項目は触らない
      setStartRollCall(prev => (json.startRollCall?.at ? { ...prev, at: json.startRollCall.at } : prev))
      dirty.current = false
      setSavedAt(formatTime(json.updatedAt))
      setSaveState('saved')
      return true
    } catch {
      setSaveState('error')
      return false
    }
  }

  // 区分を切り替えるときは、入力途中の内容を保存してから別の点検表を開く
  async function switchShift(next: ShiftType) {
    if (next === shiftType) return
    if (dirty.current && !(await save())) return
    const qs = new URLSearchParams({ type: next })
    if (nextHref) qs.set('next', nextHref)
    window.location.href = `/driver/inspection?${qs}`
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
  }, [vehicleNumber, checks, startRollCall, nearMissNote])

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
          <label>区分（通常回収と早朝回収は別々に記録します）</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {SHIFT_TYPES.map(s => (
              <Choice key={s.value} label={s.label} selected={shiftType === s.value} tone="neutral" onClick={() => switchShift(s.value)} />
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
      <div className="card" style={{ fontSize: 12.5, color: 'var(--text-2)' }}>
        終業点呼は、作業が終わったあとの<b>日報の提出画面</b>で入力します。
      </div>

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
            {going ? "保存しています…" : shiftType === 'early' ? "点検を完了して早朝回収を開始する →" : "点検を完了してルートを開始する →"}
          </button>
          <p style={{ fontSize: 12, color: startReady ? "var(--accent)" : "var(--text-3)", marginTop: 8 }}>
            {startReady
              ? (shiftType === 'early' ? "早朝回収の画面に進み、GPS記録が自動でONになります。" : "ルート画面に進み、GPS記録が自動でONになります。")
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
