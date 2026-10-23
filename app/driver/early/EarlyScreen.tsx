'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import LeafletMap, { type MapMarker } from '@/components/LeafletMap'
import { useGpsTracking } from '@/lib/useGpsTracking'
import { useGpsRecordingToggle } from '@/lib/gpsRecordingToggle'
import { distanceMeters, MISSED_SPOT_THRESHOLD_M } from '@/lib/missedSpots'
import { unlockSpotSound, playSpotSound, isSpotSoundUnlocked } from '@/lib/spotSound'

type VisitedSpot = { id: string; address: string | null; latitude: number; longitude: number; source: string; visitedAt: string }
type NearbySpot = { id: string; address: string | null; latitude: number; longitude: number }
type Incident = { vehicleNumber: string; company: string; time: string }

const NEARBY_REFETCH_METERS = 250

function nowHHMM() {
  return new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' })
}

export default function EarlyScreen({
  report, initialVisited, initialExcludedIds, initialIncidents, trackPointCount, autoStart,
}: {
  report: { id: string; status: string; reportDate: string }
  initialVisited: VisitedSpot[]
  initialExcludedIds: string[]
  initialIncidents: Incident[]
  trackPointCount: number
  autoStart: boolean
}) {
  const reportOpen = report.status === 'in_progress'
  const { on: recordingOn, toggle: toggleRecording, turnOn: turnOnRecording } = useGpsRecordingToggle(report.id)
  const { gpsActive, gpsError, pointCount, currentLocation, backgrounded } = useGpsTracking(report.id, reportOpen && recordingOn, trackPointCount)

  const [visited, setVisited] = useState<VisitedSpot[]>(initialVisited)
  const [excludedIds, setExcludedIds] = useState(new Set(initialExcludedIds))
  const [nearby, setNearby] = useState<NearbySpot[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [incidents, setIncidents] = useState<Incident[]>(initialIncidents)
  const [incidentState, setIncidentState] = useState<'idle' | 'dirty' | 'saving' | 'saved' | 'error'>('idle')
  const [soundEnabled, setSoundEnabled] = useState(() => isSpotSoundUnlocked())
  const inFlight = useRef(new Set<string>())
  const lastFetchLocation = useRef<{ lat: number; lng: number } | null>(null)
  const incidentsDirty = useRef(false)

  // 「今日のルート」の［早朝回収］から来たときはGPS記録を自動でONにし、URLの?start=1は消す
  useEffect(() => {
    if (!autoStart) return
    if (reportOpen) turnOnRecording()
    window.history.replaceState(null, '', window.location.pathname)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 現在地が250m以上動いたら、周辺のスポット（全ルート分）を取り直す
  useEffect(() => {
    if (!currentLocation) return
    const last = lastFetchLocation.current
    if (last && distanceMeters(last, currentLocation) < NEARBY_REFETCH_METERS) return
    lastFetchLocation.current = currentLocation
    fetch(`/api/driver/spots-nearby?lat=${currentLocation.lat}&lng=${currentLocation.lng}&radius=1000`)
      .then(res => (res.ok ? res.json() : null))
      .then(json => { if (json?.spots) setNearby(json.spots as NearbySpot[]) })
      .catch(() => {})
  }, [currentLocation])

  async function addVisit(spotId: string, source: 'gps' | 'manual') {
    if (inFlight.current.has(spotId)) return
    inFlight.current.add(spotId)
    try {
      const res = await fetch('/api/driver/early/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dailyReportId: report.id, spotId, source }),
      })
      if (!res.ok) return
      const json = await res.json() as { visited: boolean; spot: NearbySpot; source: string; visitedAt: string }
      if (json.visited) {
        setVisited(prev => prev.some(v => v.id === spotId) ? prev : [...prev, { ...json.spot, source: json.source, visitedAt: json.visitedAt }])
        setExcludedIds(prev => { const next = new Set(prev); next.delete(spotId); return next })
        if (source === 'gps') playSpotSound()
      } else {
        setExcludedIds(prev => new Set(prev).add(spotId))
      }
    } finally {
      inFlight.current.delete(spotId)
    }
  }

  async function removeVisit(spotId: string) {
    const res = await fetch('/api/driver/early/visits', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dailyReportId: report.id, spotId }),
    })
    if (res.ok) {
      setVisited(prev => prev.filter(v => v.id !== spotId))
      setExcludedIds(prev => new Set(prev).add(spotId))
    }
  }

  // GPSで20m以内に近づいたスポットを自動で「回った」に追加する（外したスポットは再追加しない）
  useEffect(() => {
    if (!currentLocation || !reportOpen || !recordingOn) return
    const visitedIds = new Set(visited.map(v => v.id))
    for (const s of nearby) {
      if (visitedIds.has(s.id) || excludedIds.has(s.id) || inFlight.current.has(s.id)) continue
      if (distanceMeters({ lat: s.latitude, lng: s.longitude }, currentLocation) <= MISSED_SPOT_THRESHOLD_M) {
        addVisit(s.id, 'gps')
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLocation, nearby])

  // 持ち去り車両の記録は入力のたびに少し待って自動保存する
  useEffect(() => {
    if (!incidentsDirty.current) return
    const t = setTimeout(async () => {
      setIncidentState('saving')
      try {
        const res = await fetch('/api/driver/early/incidents', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dailyReportId: report.id, incidents }),
        })
        if (!res.ok) throw new Error('failed')
        incidentsDirty.current = false
        setIncidentState('saved')
      } catch {
        setIncidentState('error')
      }
    }, 1000)
    return () => clearTimeout(t)
  }, [incidents, report.id])

  function editIncidents(next: Incident[]) {
    incidentsDirty.current = true
    setIncidentState('dirty')
    setIncidents(next)
  }

  const visitedIds = useMemo(() => new Set(visited.map(v => v.id)), [visited])
  const markers = useMemo(() => {
    const byId = new Map<string, MapMarker>()
    for (const s of nearby) {
      byId.set(s.id, { id: s.id, lat: s.latitude, lng: s.longitude, unvisited: !visitedIds.has(s.id), target: s.id === selectedId })
    }
    for (const v of visited) {
      byId.set(v.id, { id: v.id, lat: v.latitude, lng: v.longitude, unvisited: false, target: v.id === selectedId })
    }
    return [...byId.values()]
  }, [nearby, visited, visitedIds, selectedId])

  const selected = selectedId
    ? (nearby.find(s => s.id === selectedId) ?? visited.find(v => v.id === selectedId) ?? null)
    : null

  const nearestUnvisited = useMemo(() => {
    if (!currentLocation) return []
    return nearby
      .filter(s => !visitedIds.has(s.id))
      .map(s => ({ ...s, distance: Math.round(distanceMeters({ lat: s.latitude, lng: s.longitude }, currentLocation)) }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 8)
  }, [nearby, visitedIds, currentLocation])

  const sortedVisited = [...visited].sort((a, b) => a.visitedAt.localeCompare(b.visitedAt))

  return (
    <>
      <div className="breadcrumb">ドライバー向け</div>
      <div className="page-title">早朝回収</div>
      <div className="page-desc">{report.reportDate} ・ ルートはありません。回ったスポットは日報に一覧で載ります。</div>

      {!reportOpen && (
        <div className="card"><span className="pill ok">この日の早朝回収の日報は提出済みです</span></div>
      )}

      {reportOpen && (
        <div className="card">
          <div className="gps-status">
            <span className={`gps-dot ${gpsActive && !backgrounded ? 'active' : ''}`} />
            {recordingOn
              ? (backgrounded ? 'ナビアプリ表示中はGPS記録が一時停止します' : gpsError ? `GPS取得エラー: ${gpsError}` : gpsActive ? 'GPS記録中' : 'GPS位置情報を取得しています…')
              : 'GPS記録は停止中です（自動記録も止まっています）'}
            <span style={{ marginLeft: 'auto', color: 'var(--text-3)' }}>記録点数: {pointCount}</span>
          </div>
          <button className={`btn sm ${recordingOn ? '' : 'primary'}`} style={{ marginTop: 8, width: '100%' }} onClick={toggleRecording}>
            {recordingOn ? '⏸ 収集終了' : '▶ 収集開始'}
          </button>
          <button
            className="btn sm" style={{ marginTop: 8, width: '100%' }}
            onClick={async () => { await unlockSpotSound(); setSoundEnabled(true) }}
          >
            {soundEnabled ? '🔔 通知音は有効です（タップでテスト再生）' : '🔕 通知音を有効にする（スポットを記録したときに鳴らす）'}
          </button>
        </div>
      )}

      <div className="card">
        <div className="card-title">
          マップ
          <span className="pill info">回った {visited.length}件</span>
        </div>
        <LeafletMap
          markers={markers}
          currentLocation={currentLocation}
          height={320}
          onMarkerClick={reportOpen ? setSelectedId : undefined}
        />
        <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 6 }}>
          🔴 近くのスポット（未記録）・🟢 回った・🔵 選択中。{currentLocation ? 'スポットの20m以内に近づくと自動で「回った」に記録されます。地図のスポットをタップして手動で追加・取り消しもできます。' : '📡 現在地を取得しています…（取得できると周辺のスポットが表示されます）'}
        </div>

        {selected && reportOpen && (
          <div style={{ marginTop: 10, padding: 10, border: '1px solid var(--accent-2)', borderRadius: 10, background: 'var(--accent-2-dim)' }}>
            <div style={{ fontSize: 13, marginBottom: 8 }}>{selected.address || '（住所未登録）'}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {visitedIds.has(selected.id)
                ? <button className="btn sm" onClick={() => removeVisit(selected.id)}>回ったスポットから外す</button>
                : <button className="btn sm primary" onClick={() => addVisit(selected.id, 'manual')}>回ったことにする</button>}
              <button className="btn sm" onClick={() => setSelectedId(null)}>閉じる</button>
            </div>
          </div>
        )}
      </div>

      {reportOpen && nearestUnvisited.length > 0 && (
        <div className="card">
          <div className="card-title">近くのスポット（近い順）</div>
          {nearestUnvisited.map(s => (
            <div key={s.id} className="spot-row" style={{ alignItems: 'center' }}>
              <span className="spot-address" style={{ minWidth: 0 }}>{s.address || '（住所未登録）'}</span>
              <span style={{ fontSize: 11.5, color: 'var(--text-3)', flexShrink: 0 }}>{s.distance}m</span>
              <button className="btn sm primary" style={{ flexShrink: 0 }} onClick={() => addVisit(s.id, 'manual')}>回った</button>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="card-title">
          回ったスポット（{sortedVisited.length}件）
        </div>
        {sortedVisited.map((v, i) => (
          <div key={v.id} className="spot-row" style={{ alignItems: 'center' }}>
            <span className="spot-order">{i + 1}</span>
            <span className="spot-address" style={{ minWidth: 0 }}>
              {v.address || '（住所未登録）'}
              <span style={{ color: 'var(--text-3)', fontSize: 11.5, marginLeft: 6 }}>
                {new Date(v.visitedAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' })}{v.source === 'manual' ? '・手動' : ''}
              </span>
            </span>
            {reportOpen && <button className="btn sm" style={{ flexShrink: 0 }} onClick={() => removeVisit(v.id)}>外す</button>}
          </div>
        ))}
        {sortedVisited.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--text-3)' }}>まだ記録がありません。スポットに近づくか、上の「回った」ボタンで追加してください。</p>
        )}
      </div>

      <div className="card">
        <div className="card-title">
          持ち去り車両の記録
          <span style={{ fontSize: 11.5, fontWeight: 400, color: incidentState === 'error' ? 'var(--danger)' : 'var(--text-3)' }}>
            {incidentState === 'dirty' && '入力中…'}
            {incidentState === 'saving' && '保存しています…'}
            {incidentState === 'saved' && '✓ 保存しました'}
            {incidentState === 'error' && '保存に失敗しました'}
          </span>
        </div>
        {incidents.map((x, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 78px auto', gap: 6, marginBottom: 6 }}>
            <input className="text-input" placeholder="車両番号" value={x.vehicleNumber} disabled={!reportOpen}
              onChange={e => editIncidents(incidents.map((y, j) => (j === i ? { ...y, vehicleNumber: e.target.value } : y)))} />
            <input className="text-input" placeholder="業者名（企業名）" value={x.company} disabled={!reportOpen}
              onChange={e => editIncidents(incidents.map((y, j) => (j === i ? { ...y, company: e.target.value } : y)))} />
            <input className="text-input" placeholder="確認時間" value={x.time} disabled={!reportOpen}
              onChange={e => editIncidents(incidents.map((y, j) => (j === i ? { ...y, time: e.target.value } : y)))} />
            {reportOpen && <button className="btn sm" onClick={() => editIncidents(incidents.filter((_, j) => j !== i))}>✕</button>}
          </div>
        ))}
        {reportOpen && (
          <button className="btn sm" onClick={() => editIncidents([...incidents, { vehicleNumber: '', company: '', time: nowHHMM() }])}>
            ＋ 持ち去り車両を記録する（確認時間は現在時刻）
          </button>
        )}
        {!reportOpen && incidents.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-3)' }}>記録はありません。</p>}
      </div>

      <div className="grid-cards" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <a className="btn" href="/driver">← 今日のルートへ</a>
        <a className="btn primary" href="/driver/early/submit">日報を提出する →</a>
      </div>
    </>
  )
}
