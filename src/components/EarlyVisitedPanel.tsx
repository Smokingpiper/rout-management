'use client'

import LeafletMap from './LeafletMap'

type Visited = { id: string; address: string | null; latitude: number; longitude: number; source: string; visitedAt: string }
type Incident = { vehicleNumber: string; company: string; time: string }

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' })
}

// 早朝回収の日報に載せる「回ったスポット」の地図・一覧と、持ち去り車両の記録
export default function EarlyVisitedPanel({
  visited, track, incidents,
}: { visited: Visited[]; track: { lat: number; lng: number }[]; incidents: Incident[] }) {
  return (
    <>
      <div className="card">
        <div className="card-title">
          回ったスポット
          <span className="pill info">{visited.length}件</span>
        </div>
        {visited.length > 0 ? (
          <>
            <LeafletMap
              markers={visited.map(v => ({ lat: v.latitude, lng: v.longitude }))}
              path={track.length > 1 ? track : undefined}
              height={300}
            />
            <div style={{ marginTop: 12, border: '1px solid var(--border)', borderRadius: 10 }}>
              {visited.map((v, i) => (
                <div key={v.id} style={{ display: 'flex', gap: 8, padding: '7px 10px', fontSize: 12.5, borderBottom: i < visited.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <span style={{ color: 'var(--text-3)', fontFamily: 'monospace', flexShrink: 0 }}>{i + 1}</span>
                  <span style={{ flex: 1 }}>{v.address || '（住所未登録）'}</span>
                  <span style={{ color: 'var(--text-3)', flexShrink: 0 }}>{formatTime(v.visitedAt)}{v.source === 'manual' ? '・手動' : ''}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--text-3)' }}>回ったスポットの記録はありません。</p>
        )}
      </div>

      <div className="card">
        <div className="card-title">持ち去り車両の記録</div>
        {incidents.length > 0 ? (
          <table>
            <thead><tr><th>車両番号</th><th>業者名（企業名）</th><th>確認時間</th></tr></thead>
            <tbody>
              {incidents.map((x, i) => (
                <tr key={i}><td>{x.vehicleNumber || '—'}</td><td>{x.company || '—'}</td><td>{x.time || '—'}</td></tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--text-3)' }}>記録はありません。</p>
        )}
      </div>
    </>
  )
}
