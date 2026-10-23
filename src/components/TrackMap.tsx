'use client'

import { useMemo } from 'react'
import LeafletMap, { type LatLng, type TrackLayer } from './LeafletMap'
import TrackPlot from './TrackPlot'
import { distanceMeters, MISSED_SPOT_THRESHOLD_M } from '@/lib/missedSpots'
import { analyzeTrack, type TrackAnalysis } from '@/lib/trackAnalysis'

type Point = { lat: number; lng: number; t?: number }
type SpotPoint = { id: string; lat: number; lng: number; isAlertSpot: boolean; orderInRoute: number }

export default function TrackMap({
  points, spots, missedIds: missedIdsProp, focusLatLng, analysis: analysisProp, onSpotClick, activeId, overlay,
}: {
  onSpotClick?: (id: string) => void
  activeId?: string | null
  overlay?: React.ReactNode
  points: Point[]
  analysis?: TrackAnalysis
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

  // 実際に走った経路（GPS記録）を線で描く。途切れた区間は破線にする
  const analysis = useMemo(() => analysisProp ?? analyzeTrack(points), [analysisProp, points])
  const track = useMemo<TrackLayer | undefined>(() => points.length === 0 ? undefined : ({
    segments: analysis.segments,
    gaps: analysis.gaps.map(g => [g.from, g.to] as [LatLng, LatLng]),
    dots: points,
  }), [analysis, points])

  if (hasKey) {
    return (
      <LeafletMap
        markers={spots.map(s => ({ id: s.id, lat: s.lat, lng: s.lng, alert: s.isAlertSpot, missed: missedIds.has(s.id), target: s.id === activeId && !missedIds.has(s.id) }))}
        onMarkerClick={onSpotClick}
        overlay={overlay}
        track={track}
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
