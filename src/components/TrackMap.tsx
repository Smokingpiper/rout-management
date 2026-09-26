'use client'

import LeafletMap, { type LatLng } from './LeafletMap'
import TrackPlot from './TrackPlot'
import { distanceMeters, MISSED_SPOT_THRESHOLD_M } from '@/lib/missedSpots'

type Point = { lat: number; lng: number }
type SpotPoint = { id: string; lat: number; lng: number; isAlertSpot: boolean; orderInRoute: number }

export default function TrackMap({
  points, spots, missedIds: missedIdsProp, focusLatLng,
}: {
  points: Point[]
  spots: SpotPoint[]
  missedIds?: Set<string>
  focusLatLng?: LatLng | null
}) {
  const hasKey = !!process.env.NEXT_PUBLIC_MAPTILER_KEY

  // 呼び出し元が事前に計算した判定結果（一覧表示と一致させたい場合）を優先し、
  // 無ければこのコンポーネント単体でも動くようその場で計算する
  const canJudge = points.length > 0
  const missedIds = missedIdsProp ?? new Set(
    canJudge
      ? spots.filter(s => !points.some(p => distanceMeters(s, p) <= MISSED_SPOT_THRESHOLD_M)).map(s => s.id)
      : [],
  )

  // 実際に通過したスポットだけを、元の訪問順（orderInRoute）でつないだ線を描く
  const passedPath = spots
    .filter(s => !missedIds.has(s.id))
    .sort((a, b) => a.orderInRoute - b.orderInRoute)
    .map(s => ({ lat: s.lat, lng: s.lng }))

  if (hasKey) {
    return (
      <LeafletMap
        markers={spots.map(s => ({ lat: s.lat, lng: s.lng, alert: s.isAlertSpot, missed: missedIds.has(s.id) }))}
        path={passedPath}
        height={320}
        focusLatLng={focusLatLng}
      />
    )
  }

  return (
    <div>
      <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginBottom: 6 }}>
        地図未設定のため簡易表示です（MapTilerのAPIキー設定後は自動的に実地図になります）
      </div>
      <TrackPlot points={points} spots={spots} />
    </div>
  )
}
