'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { PatrolDriver, PatrolRow, PatrolSpot, PatrolLevel } from '@/lib/patrolStatus'
import PatrolMap from './PatrolMap'

// ルートごとの色（地図の線・現在地・絞り込みのチップで共通）
const ROUTE_COLORS = ['#4A7CF6', '#E5484D', '#8E4EC6', '#0E9AA7', '#D9730D', '#2F9E44', '#C2255C', '#5C7CFA', '#A16207', '#0B7285', '#E8590C', '#6741D9']

const REFRESH_MS = 60_000

const LEVEL_PILL: Record<PatrolLevel, string> = { danger: 'danger', warn: 'warn', active: 'info', ok: 'ok', idle: 'muted' }
const LEVEL_BORDER: Record<PatrolLevel, string> = {
  danger: 'var(--danger)', warn: 'var(--warn)', active: 'var(--accent-2)', ok: 'var(--border)', idle: 'var(--border)',
}

function hhmm(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' })
}

function telHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, '')}`
}

// 周回漏れ・記録途絶など、すぐ連絡したいときに押せる連絡先ボタン
function ContactButtons({ drivers, urgent, message }: { drivers: PatrolDriver[]; urgent: boolean; message: string }) {
  if (drivers.length === 0) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
      {drivers.map(d => (
        <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 12.5 }}>
          <span style={{ fontWeight: 600 }}>
            {d.name}
            {d.inspected && <span className="pill ok" style={{ marginLeft: 6 }}>点検済</span>}
          </span>
          {d.phone ? (
            <a className={`btn sm ${urgent ? 'primary' : ''}`} href={telHref(d.phone)}>📞 {d.phone}</a>
          ) : (
            <a className="btn sm" href={`/admin/users/${d.id}`}>📞 電話番号を登録</a>
          )}
          {d.email && (
            <a className="btn sm" href={`mailto:${d.email}?subject=${encodeURIComponent('【巡回の確認】')}&body=${encodeURIComponent(message)}`}>✉ メール</a>
          )}
        </div>
      ))}
    </div>
  )
}

// スポット1件分の確認と、要注意の設定・メモ（備考）の編集
function SpotLine({ spot, showAck }: { spot: PatrolSpot; showAck: boolean }) {
  const [isAlert, setIsAlert] = useState(spot.isAlertSpot)
  const [note, setNote] = useState(spot.note ?? '')
  const [savedNote, setSavedNote] = useState(spot.note ?? '')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function toggleAlert() {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/admin/spots/${spot.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAlertSpot: !isAlert }),
      })
      if (!res.ok) throw new Error('failed')
      setIsAlert(a => !a)
    } catch {
      setMessage('要注意の切り替えに失敗しました')
    } finally {
      setBusy(false)
    }
  }

  async function saveNote() {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/admin/spots/${spot.id}/note`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note }),
      })
      if (!res.ok) throw new Error('failed')
      setSavedNote(note.trim())
      setNote(note.trim())
      setMessage('メモを保存しました')
    } catch {
      setMessage('メモの保存に失敗しました')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--text-3)', fontFamily: 'monospace', fontSize: 12 }}>#{spot.orderInRoute}</span>
        <a href={`/admin/routes/${spot.routeId}/spots/${spot.id}`} style={{ flex: 1, minWidth: 140, fontSize: 13, color: 'inherit' }}>
          {spot.address || '（住所未登録）'}
        </a>
        {showAck && isAlert && (spot.acked
          ? <span className="pill ok">ドライバー確認済</span>
          : <span className="pill warn">ドライバー未確認</span>)}
        <button className={`btn sm ${isAlert ? 'primary' : ''}`} disabled={busy} onClick={toggleAlert}>
          {isAlert ? '⚠ 要注意（解除する）' : '要注意にする'}
        </button>
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        <input
          className="text-input"
          style={{ flex: 1, minWidth: 0 }}
          value={note}
          onChange={e => { setNote(e.target.value); setMessage(null) }}
          placeholder="メモ（ドライバーに伝えたいこと・スポットの注意点）"
        />
        <button className="btn sm" disabled={busy || note.trim() === savedNote} onClick={saveNote}>保存</button>
      </div>
      {message && <div style={{ fontSize: 11.5, marginTop: 4, color: message.includes('失敗') ? 'var(--danger)' : 'var(--accent)' }}>{message}</div>}
    </div>
  )
}

function RouteCard({
  row, isToday, color, highlight, onFocus,
}: { row: PatrolRow; isToday: boolean; color: string; highlight: boolean; onFocus: () => void }) {
  const pct = row.total > 0 ? Math.round((row.passed / row.total) * 100) : 0
  const urgent = row.level === 'danger' || row.level === 'warn'
  const driverMessage = `${row.title} について確認です。${row.reasons.join(' ')}`

  return (
    <div
      id={`patrol-${row.key}`}
      className="card"
      style={{ borderLeft: `4px solid ${LEVEL_BORDER[row.level]}`, marginBottom: 10, boxShadow: highlight ? `0 0 0 2px ${color}` : undefined, scrollMarginTop: 12 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}><span style={{ color }}>●</span> {row.title}</div>
        <span className={`pill ${LEVEL_PILL[row.level]}`}>{row.statusText}</span>
      </div>

      {row.kind === 'regular' ? (
        <div style={{ marginTop: 8 }}>
          <div style={{ height: 8, borderRadius: 4, background: 'var(--surface)', overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: row.level === 'danger' ? 'var(--danger)' : 'var(--accent)' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-2)', marginTop: 4 }}>
            <span>通過 {row.passed.toLocaleString()} / {row.total.toLocaleString()}件（{pct}%）</span>
            <span>最終のGPS {hhmm(row.lastPointAt)}　記録点 {row.pointCount.toLocaleString()}</span>
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 6 }}>
          回ったスポット {row.passed}件　最終のGPS {hhmm(row.lastPointAt)}
        </div>
      )}

      {row.reasons.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 12.5, color: row.level === 'danger' ? 'var(--danger)' : 'var(--text)', fontWeight: 600 }}>
          {row.reasons.map((r, i) => <div key={i}>⚠ {r}</div>)}
        </div>
      )}

      <ContactButtons drivers={row.drivers} urgent={urgent} message={driverMessage} />
      {row.drivers.length === 0 && row.kind === 'regular' && (
        <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>この曜日の担当ドライバーが未設定です（ユーザー管理の「スケジュール設定」で設定できます）。</div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
        <button className="btn sm" onClick={onFocus}>🗺 地図で見る</button>
        {row.reportId && <a className="btn sm" href={`/admin/reports/${row.reportId}`}>日報・軌跡を見る</a>}
      </div>

      {row.kind === 'regular' && (
        <>
          {row.unvisitedCount > 0 && (
            <details style={{ marginTop: 10 }} open={row.level === 'danger'}>
              <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                未通過のスポット（{row.unvisitedCount.toLocaleString()}件{row.unvisitedCount > row.unvisited.length ? `・先頭${row.unvisited.length}件を表示` : ''}）
              </summary>
              <div style={{ marginTop: 6 }}>
                {row.unvisited.map(s => <SpotLine key={s.id} spot={s} showAck={false} />)}
              </div>
            </details>
          )}
          <details style={{ marginTop: 8 }}>
            <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              要注意スポット（{row.alertSpots.length}件{isToday && row.alertSpots.length > 0 ? `・ドライバー未確認 ${row.alertSpots.filter(s => !s.acked).length}件` : ''}）
            </summary>
            <div style={{ marginTop: 6 }}>
              {row.alertSpots.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>このルートに要注意スポットはありません。上の「未通過のスポット」や、スポット詳細から追加できます。</div>}
              {row.alertSpots.map(s => <SpotLine key={s.id} spot={s} showAck />)}
            </div>
          </details>
        </>
      )}
    </div>
  )
}

export default function PatrolBoard({
  date, isToday, generatedAt, rows,
}: { date: string; isToday: boolean; generatedAt: string; rows: PatrolRow[] }) {
  const router = useRouter()

  // 今日の分は1分ごとに自動で最新にする（画面が裏に回っている間は止める）
  useEffect(() => {
    if (!isToday) return
    const tick = () => { if (!document.hidden) router.refresh() }
    const id = setInterval(tick, REFRESH_MS)
    document.addEventListener('visibilitychange', tick)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick) }
  }, [isToday, router])

  const count = (lv: PatrolLevel) => rows.filter(r => r.level === lv).length

  // 表示するルートの絞り込み（null＝すべて）。色はルートの並び（名前順）で固定し、更新で入れ替わらないようにする
  const [selected, setSelected] = useState<Set<string> | null>(null)
  const [focusKey, setFocusKey] = useState<string | null>(null)          // 地図をそのルートに合わせる（「地図で見る」）
  const [highlightKey, setHighlightKey] = useState<string | null>(null)  // 一覧で枠を付けるルート（地図の点を押したとき）
  const colorOf = useMemo(() => {
    const keys = [...rows].sort((a, b) => a.title.localeCompare(b.title, 'ja')).map(r => r.key)
    return new Map(keys.map((k, i) => [k, ROUTE_COLORS[i % ROUTE_COLORS.length]]))
  }, [rows])
  const visibleRows = useMemo(() => (selected ? rows.filter(r => selected.has(r.key)) : rows), [rows, selected])
  const chipRows = useMemo(() => [...rows].sort((a, b) => a.title.localeCompare(b.title, 'ja')), [rows])

  function toggle(key: string) {
    setFocusKey(null)
    setSelected(prev => {
      const next = new Set(prev ?? rows.map(r => r.key))
      if (next.has(key)) next.delete(key); else next.add(key)
      return next.size === rows.length ? null : next
    })
  }
  function pick(key: string) {
    // 地図を見ている最中に表示範囲が動かないよう、地図は動かさず一覧だけ移動する
    setHighlightKey(key)
    document.getElementById(`patrol-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  function focusOnMap(key: string) {
    // 絞り込まれていないルートを地図で見たいときは、そのルートも表示に加える
    setSelected(prev => (prev && !prev.has(key) ? new Set([...prev, key]) : prev))
    setFocusKey(key)
    setHighlightKey(key)
    document.getElementById('patrol-map')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <>
      <div className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
        <form method="get" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="hidden" name="view" value="status" />
          <input className="text-input" type="date" name="date" defaultValue={date} />
          <button className="btn primary" type="submit">表示</button>
          {!isToday && <a className="btn" href="/admin/reports?view=status">今日に戻る</a>}
        </form>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
          {isToday ? '1分ごとに自動で更新します　' : ''}最終更新 {hhmm(generatedAt)}
          <button className="btn sm" style={{ marginLeft: 8 }} onClick={() => router.refresh()}>↻ 今すぐ更新</button>
        </span>
      </div>

      <div className="card" style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 13 }}>
        <span><span className="pill danger">周回漏れの恐れ</span> <b>{count('danger')}</b>件</span>
        <span><span className="pill warn">要確認</span> <b>{count('warn')}</b>件</span>
        <span><span className="pill info">巡回中</span> <b>{count('active')}</b>件</span>
        <span><span className="pill ok">完了</span> <b>{count('ok')}</b>件</span>
      </div>

      {rows.length === 0 && (
        <div className="card"><p style={{ fontSize: 13, color: 'var(--text-3)' }}>この日に巡回予定のルートも、日報もありません。</p></div>
      )}

      {rows.length > 0 && (
        <>
          <div className="card">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
              <b style={{ fontSize: 13 }}>表示するルート</b>
              <button className={`btn sm ${selected === null ? 'primary' : ''}`} onClick={() => { setSelected(null); setFocusKey(null) }}>すべて</button>
              <button className="btn sm" onClick={() => { setSelected(new Set(rows.filter(r => r.level === 'danger' || r.level === 'warn').map(r => r.key))); setFocusKey(null) }}>⚠ 注意が必要なルートだけ</button>
              <button className="btn sm" onClick={() => { setSelected(new Set(rows.filter(r => r.level === 'active').map(r => r.key))); setFocusKey(null) }}>巡回中だけ</button>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {chipRows.map(r => {
                const on = selected === null || selected.has(r.key)
                return (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => toggle(r.key)}
                    style={{
                      padding: '4px 10px', borderRadius: 14, fontSize: 12, cursor: 'pointer',
                      border: `1.5px solid ${on ? colorOf.get(r.key) : 'var(--border)'}`,
                      background: on ? 'var(--bg-2)' : 'transparent',
                      color: on ? 'var(--text)' : 'var(--text-3)',
                      opacity: on ? 1 : 0.6,
                    }}
                  >
                    <span style={{ color: colorOf.get(r.key) }}>●</span> {r.title}
                    {(r.level === 'danger' || r.level === 'warn') && <span style={{ color: r.level === 'danger' ? 'var(--danger)' : 'var(--warn)' }}> ⚠</span>}
                  </button>
                )
              })}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 8 }}>
              ルート名を押すと、地図と下の一覧の表示／非表示を切り替えられます。地図の点や線を押すと、そのルートの一覧へ移動します。
            </div>
          </div>

          <div id="patrol-map" style={{ scrollMarginTop: 12 }}>
            <PatrolMap rows={visibleRows} colorOf={colorOf} focusKey={focusKey} onPick={pick} />
          </div>
        </>
      )}

      {visibleRows.map(row => (
        <RouteCard
          key={row.key}
          row={row}
          isToday={isToday}
          color={colorOf.get(row.key) ?? '#4A7CF6'}
          highlight={highlightKey === row.key}
          onFocus={() => focusOnMap(row.key)}
        />
      ))}
    </>
  )
}
