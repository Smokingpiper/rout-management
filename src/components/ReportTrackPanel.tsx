'use client'

import { useState } from 'react'
import TrackMap from './TrackMap'
import SpotPassageList from './SpotPassageList'
import { findMissedSpots, MISSED_SPOT_THRESHOLD_M } from '@/lib/missedSpots'

type Point = { lat: number; lng: number }
type Spot = { id: string; address: string | null; latitude: number; longitude: number; isAlertSpot: boolean; orderInRoute: number }

export default function ReportTrackPanel({ points, spots }: { points: Point[]; spots: Spot[] }) {
  const [selected, setSelected] = useState<{ id: string; lat: number; lng: number } | null>(null)

  const missed = findMissedSpots(spots, points)
  const missedIds = new Set(missed.map(m => m.id))
  const unknown = points.length === 0
  const sortedSpots = [...spots].sort((a, b) => a.orderInRoute - b.orderInRoute)

  return (
    <div className="card">
      <div className="card-title">
        軌跡・通過確認
        {!unknown && (
          <span className={`pill ${missedIds.size > 0 ? 'warn' : 'ok'}`}>
            通過 {spots.length - missedIds.size}/{spots.length}件
          </span>
        )}
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10 }}>
        {unknown
          ? 'GPSの記録が無いため、通過確認ができていません。'
          : `スポット付近（半径${MISSED_SPOT_THRESHOLD_M}m以内）をGPSが通過していれば✅、していなければ⚠️で表示しています。一覧のスポットをタップすると地図がその場所にズームします。`}
      </p>

      <TrackMap
        points={points}
        spots={spots.map(s => ({ id: s.id, lat: s.latitude, lng: s.longitude, isAlertSpot: s.isAlertSpot, orderInRoute: s.orderInRoute }))}
        missedIds={missedIds}
        focusLatLng={selected}
      />

      <div style={{ marginTop: 12 }}>
        <SpotPassageList
          spots={sortedSpots.map(s => ({ id: s.id, orderInRoute: s.orderInRoute, address: s.address, lat: s.latitude, lng: s.longitude }))}
          missedIds={missedIds}
          selectedId={selected?.id ?? null}
          onSelect={s => setSelected({ id: s.id, lat: s.lat, lng: s.lng })}
        />
      </div>
    </div>
  )
}
