'use client'

import { useEffect, useRef, useState } from 'react'
import GoogleMap from '@/components/GoogleMap'

type Spot = { id: string; orderInRoute: number; address: string | null; isAlertSpot: boolean; latitude: number; longitude: number }
type Report = { id: string; status: string; reportDate: string }

function navUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`
}

const MIN_INTERVAL_MS = 15000 // GPS点を送る最短間隔

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
  const [gpsActive, setGpsActive] = useState(false)
  const [gpsError, setGpsError] = useState<string | null>(null)
  const [pointCount, setPointCount] = useState(trackPointCount)
  const [acked, setAcked] = useState(new Set(ackedSpotIds))
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null)
  const lastSentAt = useRef(0)

  const trackingEnabled = report.status === 'in_progress'

  useEffect(() => {
    if (!trackingEnabled) return
    if (!('geolocation' in navigator)) {
      setGpsError('この端末は位置情報に対応していません')
      return
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsActive(true)
        setCurrentLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        const now = Date.now()
        if (now - lastSentAt.current < MIN_INTERVAL_MS) return
        lastSentAt.current = now
        fetch('/api/driver/track-points', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dailyReportId: report.id,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          }),
        }).then(res => { if (res.ok) setPointCount(c => c + 1) })
      },
      (err) => setGpsError(err.message || '位置情報を取得できませんでした'),
      { enableHighAccuracy: true, maximumAge: 10000 },
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [trackingEnabled, report.id])

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

  return (
    <>
      <div className="breadcrumb">ドライバー向け</div>
      <div className="page-title">{routeName}</div>
      <div className="page-desc">{report.reportDate} ・ {wasteTypeName ?? '品目未設定'}</div>

      {trackingEnabled ? (
        <div className="card">
          <div className="gps-status">
            <span className={`gps-dot ${gpsActive ? 'active' : ''}`} />
            {gpsError ? `GPS取得エラー: ${gpsError}` : gpsActive ? 'GPS記録中' : 'GPS位置情報を取得しています…'}
            <span style={{ marginLeft: 'auto', color: 'var(--text-3)' }}>記録点数: {pointCount}</span>
          </div>
        </div>
      ) : (
        <div className="card">
          <span className="pill ok">本日の日報は提出済みです</span>
        </div>
      )}

      <div className="card">
        <div className="card-title">マップ</div>
        <GoogleMap
          markers={spots.map(s => ({ lat: s.latitude, lng: s.longitude, alert: s.isAlertSpot }))}
          currentLocation={currentLocation}
          height={260}
        />
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
              <a className="btn sm" href={navUrl(spot.latitude, spot.longitude)} target="_blank" rel="noreferrer">📍 ナビ開始</a>
              {acked.has(spot.id) ? (
                <span className="pill ok">確認済</span>
              ) : (
                <button className="btn sm primary" onClick={() => acknowledgeAlert(spot.id)}>確認しました</button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="card-title">スポット一覧（全{spots.length}件）</div>
        {spots.map(spot => (
          <div className="spot-row" key={spot.id}>
            <span className="spot-order">{spot.orderInRoute}</span>
            <span className="spot-address">{spot.address}</span>
            {spot.isAlertSpot && <span className="pill warn">要注意</span>}
          </div>
        ))}
      </div>

      {trackingEnabled ? (
        <a className="btn primary" href={`/driver/routes/${routeId}/submit`}>日報を提出する →</a>
      ) : (
        <a className="btn" href={`/driver/routes/${routeId}/track`}>軌跡マップを見る</a>
      )}
    </>
  )
}
