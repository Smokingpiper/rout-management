type Point = { lat: number; lng: number }
type SpotPoint = { lat: number; lng: number; isAlertSpot: boolean }

const W = 400
const H = 280
const PAD = 16

export default function TrackPlot({ points, spots }: { points: Point[]; spots: SpotPoint[] }) {
  const all = [...points, ...spots]
  if (all.length === 0) {
    return <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>まだ記録がありません</div>
  }

  const lats = all.map(p => p.lat)
  const lngs = all.map(p => p.lng)
  const minLat = Math.min(...lats), maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs)
  const latRange = Math.max(maxLat - minLat, 0.0005)
  const lngRange = Math.max(maxLng - minLng, 0.0005)

  const project = (p: Point) => {
    const x = PAD + ((p.lng - minLng) / lngRange) * (W - PAD * 2)
    const y = PAD + (1 - (p.lat - minLat) / latRange) * (H - PAD * 2)
    return [x, y]
  }

  const pathD = points
    .map(project)
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ')

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 220, background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)' }}>
        {points.length > 1 && (
          <path d={pathD} fill="none" stroke="var(--accent-2)" strokeWidth={2.5} strokeDasharray="6 5" />
        )}
        {spots.map((s, i) => {
          const [x, y] = project(s)
          return <circle key={i} cx={x} cy={y} r={4} fill={s.isAlertSpot ? 'var(--warn)' : 'var(--accent)'} />
        })}
        {points.map((p, i) => {
          const [x, y] = project(p)
          return <circle key={`t${i}`} cx={x} cy={y} r={2} fill="var(--accent-2)" opacity={0.6} />
        })}
      </svg>
      <div style={{ display: 'flex', gap: 14, marginTop: 8, fontSize: 11.5, color: 'var(--text-2)' }}>
        <span>● スポット</span>
        <span style={{ color: 'var(--warn)' }}>● 要注意スポット</span>
        <span style={{ color: 'var(--accent-2)' }}>--- 実走軌跡</span>
      </div>
    </div>
  )
}
