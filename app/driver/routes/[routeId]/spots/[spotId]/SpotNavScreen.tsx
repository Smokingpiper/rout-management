'use client'

import { useState } from 'react'
import GoogleMap from '@/components/GoogleMap'
import { useGpsTracking, navUrl } from '@/lib/useGpsTracking'

type Spot = { id: string; orderInRoute: number; address: string | null; isAlertSpot: boolean; latitude: number; longitude: number }
type Report = { id: string; status: string; reportDate: string }

export default function SpotNavScreen({
  routeId, routeName, spot, note, index, total, prevSpotId, nextSpotId, report, initiallyAcked, trackPointCount,
}: {
  routeId: string
  routeName: string
  spot: Spot
  note: string | null
  index: number
  total: number
  prevSpotId: string | null
  nextSpotId: string | null
  report: Report
  initiallyAcked: boolean
  trackPointCount: number
}) {
  const trackingEnabled = report.status === 'in_progress'
  const { gpsActive, gpsError, pointCount, currentLocation } = useGpsTracking(report.id, trackingEnabled, trackPointCount)
  const [acked, setAcked] = useState(initiallyAcked)
  const [acking, setAcking] = useState(false)

  async function acknowledge() {
    setAcking(true)
    try {
      const res = await fetch('/api/driver/alert-ack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dailyReportId: report.id, spotId: spot.id }),
      })
      if (res.ok) setAcked(true)
    } finally {
      setAcking(false)
    }
  }

  const nextHref = nextSpotId
    ? `/driver/routes/${routeId}/spots/${nextSpotId}`
    : `/driver/routes/${routeId}/submit`

  return (
    <>
      <div className="breadcrumb"><a href={`/driver/routes/${routeId}`}>{routeName}</a> / スポット {index + 1} / {total}</div>
      <div className="page-title">{spot.address || `スポット #${spot.orderInRoute}`}</div>
      <div className="page-desc">
        {trackingEnabled ? (
          <span className="gps-status">
            <span className={`gps-dot ${gpsActive ? 'active' : ''}`} />
            {gpsError ? `GPS取得エラー: ${gpsError}` : gpsActive ? 'GPS記録中' : 'GPS取得中…'}
            <span style={{ color: 'var(--text-3)' }}>（記録点数: {pointCount}）</span>
          </span>
        ) : '本日の日報は提出済みです'}
      </div>

      {spot.isAlertSpot && (
        <div className="card" style={{ background: 'var(--warn-dim)', borderColor: 'var(--warn)' }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <span>⚠️</span>
            <div>
              <b style={{ color: 'var(--warn)' }}>要注意スポットです。</b><br />
              到達時は分別状況などを確認してください。
            </div>
          </div>
        </div>
      )}

      {note && (
        <div className="card" style={{ background: 'var(--accent-dim)', borderColor: 'var(--accent)' }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <span>📝</span>
            <div>
              <b style={{ color: 'var(--accent)' }}>備考</b><br />
              {note}
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-title">
          {spot.address}
          {spot.isAlertSpot && <span className="pill warn">要注意スポット</span>}
        </div>
        <GoogleMap
          markers={[{ lat: spot.latitude, lng: spot.longitude, alert: spot.isAlertSpot }]}
          currentLocation={currentLocation}
          height={240}
        />
      </div>

      <div className="grid-cards" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 16 }}>
        <a className="btn" href={navUrl(spot.latitude, spot.longitude)} target="_blank" rel="noreferrer">📍 Google Mapsでナビ開始</a>
        {spot.isAlertSpot ? (
          acked ? (
            <span className="btn" style={{ background: 'var(--accent-dim)', color: 'var(--accent)', cursor: 'default', borderColor: 'var(--accent-dim)' }}>✓ 確認済み</span>
          ) : (
            <button className="btn primary" disabled={acking} onClick={acknowledge}>✓ 注意事項を確認しました</button>
          )
        ) : (
          <span />
        )}
      </div>

      <div className="grid-cards" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {prevSpotId ? (
          <a className="btn" href={`/driver/routes/${routeId}/spots/${prevSpotId}`}>← 前のスポット</a>
        ) : <span />}
        <a className="btn primary" href={nextHref}>
          {nextSpotId ? '次のスポットへ →' : '日報提出へ →'}
        </a>
      </div>
    </>
  )
}
