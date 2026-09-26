'use client'

import { useMemo, useState } from 'react'
import GoogleMap from '@/components/GoogleMap'
import { useGpsTracking, navUrl } from '@/lib/useGpsTracking'
import { buildChunkedNavUrls } from '@/lib/chunkedNav'

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
  const trackingEnabled = report.status === 'in_progress'
  const { gpsActive, gpsError, pointCount, currentLocation } = useGpsTracking(report.id, trackingEnabled, trackPointCount)
  const [acked, setAcked] = useState(new Set(ackedSpotIds))

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
  const navChunks = useMemo(() => buildChunkedNavUrls(spots), [spots])

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
        <div className="card-title">スポット一覧（全{spots.length}件・タップで住所の詳細）</div>
        {spots.map(spot => (
          <a className="spot-row" key={spot.id} href={`/driver/routes/${routeId}/spots/${spot.id}`} style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}>
            <span className="spot-order">{spot.orderInRoute}</span>
            <span className="spot-address">{spot.address}</span>
            {spot.hasNote && <span title="備考あり">📝</span>}
            {spot.isAlertSpot && <span className="pill warn">要注意</span>}
          </a>
        ))}
      </div>

      {trackingEnabled && (
        <details className="card">
          <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
            🔰 ナビが必要な方はこちら（区間ナビ・Google Maps）
          </summary>
          <p style={{ fontSize: 12.5, color: 'var(--text-2)', margin: '10px 0', lineHeight: 1.6 }}>
            Google Mapsは1回のナビに入れられる経由地の数に上限があるため、入力順のまま{navChunks.length}区間に分けています。
            区間を1つ終えたら、次の区間のボタンをタップしてください（現在地からその区間の最後のスポットまで自動でナビされます）。
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {navChunks.map(chunk => (
              <a
                key={chunk.chunkIndex}
                className="btn primary"
                style={{ justifyContent: 'space-between' }}
                href={chunk.url}
                target="_blank"
                rel="noreferrer"
              >
                <span>📍 区間{chunk.chunkIndex + 1}（{chunk.startOrder}〜{chunk.endOrder}件目）</span>
                <span>ナビ開始 →</span>
              </a>
            ))}
          </div>
        </details>
      )}

      <div className="grid-cards" style={{ gridTemplateColumns: trackingEnabled ? '1fr 1fr' : '1fr' }}>
        <a className="btn" href={`/driver/routes/${routeId}/track`}>🛰 軌跡マップを見る</a>
        {trackingEnabled && (
          <a className="btn primary" href={`/driver/routes/${routeId}/submit`}>日報を提出する →</a>
        )}
      </div>
    </>
  )
}
