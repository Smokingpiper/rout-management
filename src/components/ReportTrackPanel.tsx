'use client'

import { useState } from 'react'
import TrackMap from './TrackMap'
import SpotPassageList from './SpotPassageList'
import { findMissedSpots, MISSED_SPOT_THRESHOLD_M } from '@/lib/missedSpots'

type Point = { lat: number; lng: number }
type Spot = { id: string; address: string | null; latitude: number; longitude: number; isAlertSpot: boolean; orderInRoute: number }

export default function ReportTrackPanel({
  points, spots, dailyReportId, initialOverriddenSpotIds = [],
}: {
  points: Point[]
  spots: Spot[]
  dailyReportId: string
  initialOverriddenSpotIds?: string[]
}) {
  const [selected, setSelected] = useState<{ id: string; lat: number; lng: number } | null>(null)
  const [overriddenIds, setOverriddenIds] = useState(new Set(initialOverriddenSpotIds))
  const [pendingIds, setPendingIds] = useState(new Set<string>())
  // 一覧の開閉初期状態は最初の判定時点のみで決め、後からクリア操作で
  // 件数が0になっても勝手に閉じてしまわないようにする
  const [detailsOpenInitially] = useState(() => findMissedSpots(spots, points).length > 0)

  const rawMissed = findMissedSpots(spots, points)
  const rawMissedIds = new Set(rawMissed.map(m => m.id))
  const missedIds = new Set([...rawMissedIds].filter(id => !overriddenIds.has(id)))
  const unknown = points.length === 0
  const sortedSpots = [...spots].sort((a, b) => a.orderInRoute - b.orderInRoute)

  async function setPending(spotId: string, on: boolean) {
    setPendingIds(prev => {
      const next = new Set(prev)
      if (on) next.add(spotId); else next.delete(spotId)
      return next
    })
  }

  async function clearMissed(spotId: string) {
    setPending(spotId, true)
    try {
      const res = await fetch('/api/driver/missed-override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dailyReportId, spotId }),
      })
      if (res.ok) setOverriddenIds(prev => new Set(prev).add(spotId))
    } finally {
      setPending(spotId, false)
    }
  }

  async function restoreMissed(spotId: string) {
    setPending(spotId, true)
    try {
      const res = await fetch('/api/driver/missed-override', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dailyReportId, spotId }),
      })
      if (res.ok) setOverriddenIds(prev => { const next = new Set(prev); next.delete(spotId); return next })
    } finally {
      setPending(spotId, false)
    }
  }

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
          : `スポット付近（半径${MISSED_SPOT_THRESHOLD_M}m以内）をGPSが通過していれば✅、していなければ⚠️で表示しています。GPSの誤差等で実際は通過しているのに⚠️になっている場合は「クリア」で手動確認済みにできます。一覧のスポットをタップすると地図がその場所にズームします。`}
      </p>

      <TrackMap
        points={points}
        spots={spots.map(s => ({ id: s.id, lat: s.latitude, lng: s.longitude, isAlertSpot: s.isAlertSpot, orderInRoute: s.orderInRoute }))}
        missedIds={missedIds}
        focusLatLng={selected}
      />

      <details style={{ marginTop: 12 }} open={detailsOpenInitially}>
        <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
          回ったスポット一覧（{spots.length}件）
          {missedIds.size > 0 && <span className="pill warn" style={{ marginLeft: 8 }}>⚠️ 周り損ないの可能性 {missedIds.size}件</span>}
        </summary>
        <div style={{ marginTop: 10 }}>
          <SpotPassageList
            spots={sortedSpots.map(s => ({ id: s.id, orderInRoute: s.orderInRoute, address: s.address, lat: s.latitude, lng: s.longitude }))}
            missedIds={rawMissedIds}
            overriddenIds={overriddenIds}
            pendingIds={pendingIds}
            selectedId={selected?.id ?? null}
            onSelect={s => setSelected({ id: s.id, lat: s.lat, lng: s.lng })}
            onClear={clearMissed}
            onRestore={restoreMissed}
          />
        </div>
      </details>
    </div>
  )
}
