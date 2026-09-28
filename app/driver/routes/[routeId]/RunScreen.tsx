'use client'

import { useEffect, useMemo, useState } from 'react'
import LeafletMap from '@/components/LeafletMap'
import { useGpsTracking } from '@/lib/useGpsTracking'
import { useGpsRecordingToggle } from '@/lib/gpsRecordingToggle'
import { useRouteLine } from '@/lib/useRouteLine'
import { useIsApplePlatform, navUrl } from '@/lib/mapNav'
import { distanceMeters, MISSED_SPOT_THRESHOLD_M } from '@/lib/missedSpots'
import { unlockSpotSound, playSpotSound, isSpotSoundUnlocked } from '@/lib/spotSound'
import DriverSpotList from './DriverSpotList'

type Spot = { id: string; orderInRoute: number; address: string | null; isAlertSpot: boolean; latitude: number; longitude: number; hasNote?: boolean }
type Report = { id: string; status: string; reportDate: string }

export default function RunScreen({
  routeId, routeName, report, spots, ackedSpotIds, trackPointCount, wasteTypeName,
}: {
  routeId: string
  routeName: string
  report: Report
  spots: Spot[]
  ackedSpotIds: string[]
  trackPointCount: number
  wasteTypeName: string | null
}) {
  const reportOpen = report.status === 'in_progress'
  const { on: recordingOn, toggle: toggleRecording } = useGpsRecordingToggle(report.id)
  const trackingEnabled = reportOpen && recordingOn
  const { gpsActive, gpsError, pointCount, currentLocation, backgrounded } = useGpsTracking(report.id, trackingEnabled, trackPointCount)
  const [acked, setAcked] = useState(new Set(ackedSpotIds))
  const [soundEnabled, setSoundEnabled] = useState(() => isSpotSoundUnlocked())

  async function enableSound() {
    await unlockSpotSound()
    setSoundEnabled(true)
  }

  async function acknowledgeAlert(spotId: string) {
    const res = await fetch('/api/driver/alert-ack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dailyReportId: report.id, spotId }),
    })
    if (res.ok) setAcked(prev => new Set(prev).add(spotId))
  }

  const alertSpots = spots.filter(s => s.isAlertSpot)
  const remainingAlerts = alertSpots.filter(s => !acked.has(s.id)).length
  const isApple = useIsApplePlatform()

  // 到達済み（閾値内に近づいた）とみなせた最大の順番。単純な最近傍判定だと、GPSが
  // ルートから離れた場所（テスト中など）にあるだけで「次のスポット」が無くなってしまうため、
  // 一度でも近づいたスポットの順番だけを単調に進める方式にしている
  const [reachedOrder, setReachedOrder] = useState(0)
  useEffect(() => {
    if (!currentLocation) return
    let maxReached = reachedOrder
    for (const s of spots) {
      if (s.orderInRoute <= maxReached) continue
      if (distanceMeters({ lat: s.latitude, lng: s.longitude }, currentLocation) <= MISSED_SPOT_THRESHOLD_M) {
        maxReached = Math.max(maxReached, s.orderInRoute)
      }
    }
    if (maxReached !== reachedOrder) {
      setReachedOrder(maxReached)
      playSpotSound()
    }
  }, [currentLocation, spots, reachedOrder])

  // 現在地の次に回るべきスポット。この画面だけで運転中も現在地→次のスポットの
  // 経路が見えるようにし、スポットごとの画面遷移やナビアプリへの切り替えを避けられるようにする
  const nextTargetSpot = useMemo(() => {
    const sorted = [...spots].sort((a, b) => a.orderInRoute - b.orderInRoute)
    return sorted.find(s => s.orderInRoute > reachedOrder) ?? null
  }, [reachedOrder, spots])

  const { routeLine } = useRouteLine(currentLocation, nextTargetSpot ? { lat: nextTargetSpot.latitude, lng: nextTargetSpot.longitude } : null)

  return (
    <>
      <div className="breadcrumb">ドライバー向け</div>
      <div className="page-title">{routeName}</div>
      <div className="page-desc">{report.reportDate} ・ {wasteTypeName ?? '品目未設定'}</div>

      {reportOpen ? (
        <div className="card">
          <div className="gps-status">
            <span className={`gps-dot ${gpsActive && !backgrounded ? 'active' : ''}`} />
            {recordingOn
              ? (backgrounded ? 'ナビアプリ表示中はGPS記録が一時停止します' : gpsError ? `GPS取得エラー: ${gpsError}` : gpsActive ? 'GPS記録中' : 'GPS位置情報を取得しています…')
              : 'GPS記録は停止中です'}
            <span style={{ marginLeft: 'auto', color: 'var(--text-3)' }}>記録点数: {pointCount}</span>
          </div>
          <button
            className={`btn sm ${recordingOn ? '' : 'primary'}`}
            style={{ marginTop: 8, width: '100%' }}
            onClick={toggleRecording}
          >
            {recordingOn ? '⏸ 収集終了' : '▶ 収集開始'}
          </button>
          {!recordingOn && (
            <p style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 6 }}>
              停止中は移動経路が記録されません。休憩などで一時的に止める場合にご利用ください。
            </p>
          )}
          <button
            className="btn sm"
            style={{ marginTop: 8, width: '100%' }}
            onClick={enableSound}
          >
            {soundEnabled ? '🔔 通知音は有効です（タップでテスト再生）' : '🔕 通知音を有効にする（スポット通過時に鳴らす）'}
          </button>
        </div>
      ) : (
        <div className="card">
          <span className="pill ok">本日の日報は提出済みです</span>
        </div>
      )}

      <div className="card">
        <div className="card-title">
          マップ
          {nextTargetSpot && <span className="pill info">次のスポット: {nextTargetSpot.address || `#${nextTargetSpot.orderInRoute}`}</span>}
        </div>
        <LeafletMap
          markers={spots.map(s => ({
            lat: s.latitude, lng: s.longitude, alert: s.isAlertSpot,
            target: s.id === nextTargetSpot?.id,
            unvisited: s.orderInRoute > reachedOrder,
          }))}
          currentLocation={currentLocation}
          path={routeLine ?? undefined}
          height={300}
        />
        {recordingOn && (
          <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 6 }}>
            🔴 未通過 → 🟢 通過済み（40m以内に近づくと自動で切り替わり、通知音が鳴ります）・🔵 次のスポット。
            青い線は現在地から次のスポットまでの参考ルートです。この画面を開いたままにしておけば、スポットごとに画面を移動しなくてもGPS記録が続きます。
          </div>
        )}
      </div>

      {alertSpots.length > 0 && (
        <div className="card">
          <div className="card-title">
            要注意スポット
            <span className="pill warn">残り{remainingAlerts}件</span>
          </div>
          {alertSpots.map(spot => (
            <div className="spot-row" key={spot.id} style={{ flexWrap: 'wrap' }}>
              <span className="spot-address">{spot.address}</span>
              <a className="btn sm" href={navUrl(spot.latitude, spot.longitude, isApple)} target="_blank" rel="noreferrer">📍 ナビ開始</a>
              {acked.has(spot.id) ? (
                <span className="pill ok">確認済</span>
              ) : (
                <button className="btn sm primary" onClick={() => acknowledgeAlert(spot.id)}>確認しました</button>
              )}
            </div>
          ))}
        </div>
      )}

      <DriverSpotList routeId={routeId} spots={spots} />

      <div className="grid-cards" style={{ gridTemplateColumns: reportOpen ? '1fr 1fr' : '1fr' }}>
        <a className="btn" href={`/driver/routes/${routeId}/track`}>🛰 軌跡マップを見る</a>
        {reportOpen && (
          <a className="btn primary" href={`/driver/routes/${routeId}/submit`}>日報を提出する →</a>
        )}
      </div>
    </>
  )
}
