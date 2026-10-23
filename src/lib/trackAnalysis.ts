// GPS軌跡の解析。「通った道の経路」を線で描き、GPSが取れていなかった区間（途切れ）を見分けるために使う。
import { distanceMeters } from './missedSpots'

export type TrackPoint = { lat: number; lng: number; t?: number } // t = 記録時刻（ミリ秒）

// 記録は5秒毎（古い日報は15秒毎）。これを大きく超えて記録が空き、かつその間に車が動いている
// （＝位置が飛んでいる）ときだけ「途切れ」とする。止まっている間は記録が増えないことがあるため、
// 時間が空いただけでは途切れとしない
export const GAP_SECONDS = 45
export const GAP_MIN_MOVE_M = 100
const GAP_FALLBACK_M = 300 // 記録時刻が無いデータでは、点どうしが極端に離れているものを途切れとみなす
// 途切れた区間の近くにあるスポットを「GPS不調の可能性」とみなす距離
export const GAP_NEAR_SPOT_M = 100

export type TrackGap = { from: TrackPoint; to: TrackPoint; seconds: number | null; meters: number }
export type TrackAnalysis = {
  segments: TrackPoint[][]   // 途切れずにつながっている走行経路（線で描く）
  gaps: TrackGap[]           // 記録が途切れた区間（破線で描く）
  distanceM: number          // 走行距離（途切れ区間は含めない）
  maxGapSeconds: number | null
}

export function analyzeTrack(points: TrackPoint[]): TrackAnalysis {
  const segments: TrackPoint[][] = []
  const gaps: TrackGap[] = []
  let distanceM = 0
  let cur: TrackPoint[] = []
  for (const p of points) {
    const prev = cur[cur.length - 1]
    if (!prev) { cur.push(p); continue }
    const meters = distanceMeters(prev, p)
    const seconds = prev.t != null && p.t != null ? (p.t - prev.t) / 1000 : null
    const isGap = seconds != null ? seconds > GAP_SECONDS && meters > GAP_MIN_MOVE_M : meters > GAP_FALLBACK_M
    if (isGap) {
      gaps.push({ from: prev, to: p, seconds, meters })
      segments.push(cur)
      cur = [p]
    } else {
      distanceM += meters
      cur.push(p)
    }
  }
  if (cur.length > 0) segments.push(cur)
  const secs = gaps.map(g => g.seconds).filter((s): s is number => s != null)
  return { segments, gaps, distanceM, maxGapSeconds: secs.length ? Math.max(...secs) : null }
}

// 点から線分までの距離（m）。数百m程度の範囲なので平面近似で十分
export function distanceToSegmentM(p: { lat: number; lng: number }, a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const kx = 111_320 * Math.cos((p.lat * Math.PI) / 180)
  const ky = 111_320
  const ax = (a.lng - p.lng) * kx, ay = (a.lat - p.lat) * ky
  const bx = (b.lng - p.lng) * kx, by = (b.lat - p.lat) * ky
  const dx = bx - ax, dy = by - ay
  const len2 = dx * dx + dy * dy
  const u = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2))
  return Math.hypot(ax + u * dx, ay + u * dy)
}

export function distanceToRouteM(p: { lat: number; lng: number }, segments: TrackPoint[][]): number {
  let best = Infinity
  for (const seg of segments) {
    if (seg.length === 1) best = Math.min(best, distanceMeters(p, seg[0]))
    for (let i = 1; i < seg.length; i++) best = Math.min(best, distanceToSegmentM(p, seg[i - 1], seg[i]))
  }
  return best
}

export type MissedHint = { text: string; gpsTrouble: boolean }

// 「通過できていない」スポットについて、原因の見当を付ける材料を作る
export function hintForMissedSpot(spot: { lat: number; lng: number }, analysis: TrackAnalysis): MissedHint | null {
  if (analysis.segments.length === 0) return null
  const dRoute = distanceToRouteM(spot, analysis.segments)
  let nearGap: TrackGap | null = null
  let dGap = Infinity
  for (const g of analysis.gaps) {
    const d = distanceToSegmentM(spot, g.from, g.to)
    if (d < dGap) { dGap = d; nearGap = g }
  }
  if (nearGap && dGap <= GAP_NEAR_SPOT_M && dGap < dRoute) {
    const when = nearGap.seconds != null ? `約${Math.round(nearGap.seconds)}秒` : ''
    return { gpsTrouble: true, text: `GPSの記録が${when}途切れた区間の近くです（GPS不調の可能性）` }
  }
  const m = Math.round(dRoute)
  if (m <= 80) return { gpsTrouble: false, text: `走行経路から約${m}m（あと少し。GPSの誤差の可能性）` }
  return { gpsTrouble: false, text: `走行経路から約${m}m離れています（通っていない可能性）` }
}
