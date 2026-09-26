import type { MissedSpot } from '@/lib/missedSpots'
import { MISSED_SPOT_THRESHOLD_M } from '@/lib/missedSpots'

export default function MissedSpotsCard({ missed, totalSpots }: { missed: MissedSpot[]; totalSpots: number }) {
  if (totalSpots === 0) return null

  const unknown = missed.length > 0 && missed[0].nearestDistanceM === null

  if (missed.length === 0) {
    return (
      <div className="card" style={{ background: 'var(--accent-dim)', borderColor: 'var(--accent)' }}>
        <div className="card-title">✅ GPS通過チェック</div>
        <p style={{ fontSize: 12.5, color: 'var(--text-2)' }}>全{totalSpots}件のスポット付近をGPSが通過しています。</p>
      </div>
    )
  }

  return (
    <div className="card" style={{ background: 'var(--warn-dim)', borderColor: 'var(--warn)' }}>
      <div className="card-title">
        ⚠️ GPS通過チェック
        <span className="pill warn">{unknown ? '判定不能' : `${missed.length}件`}</span>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--text-2)', marginBottom: 8 }}>
        {unknown
          ? 'GPSの記録が無いため、通過確認ができていません。'
          : `全${totalSpots}件中、GPSの軌跡がスポット付近（半径${MISSED_SPOT_THRESHOLD_M}m以内）を通過していないものが${missed.length}件あります。周り忘れが無いかご確認ください。`}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 240, overflowY: 'auto' }}>
        {missed.map(s => (
          <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12.5, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
            <span>#{s.orderInRoute} {s.address ?? '（住所未設定）'}</span>
            {s.nearestDistanceM != null && <span style={{ color: 'var(--text-3)', whiteSpace: 'nowrap' }}>最短 {s.nearestDistanceM}m</span>}
          </div>
        ))}
      </div>
    </div>
  )
}
