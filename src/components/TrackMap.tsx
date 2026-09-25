'use client'

import GoogleMap from './GoogleMap'
import TrackPlot from './TrackPlot'

type Point = { lat: number; lng: number }
type SpotPoint = { lat: number; lng: number; isAlertSpot: boolean }

export default function TrackMap({ points, spots }: { points: Point[]; spots: SpotPoint[] }) {
  const hasKey = !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  if (hasKey) {
    return (
      <GoogleMap
        markers={spots.map(s => ({ lat: s.lat, lng: s.lng, alert: s.isAlertSpot }))}
        path={points}
        height={320}
      />
    )
  }

  return (
    <div>
      <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginBottom: 6 }}>
        Google Maps未設定のため簡易表示です（APIキー設定後は自動的に実地図になります）
      </div>
      <TrackPlot points={points} spots={spots} />
    </div>
  )
}
