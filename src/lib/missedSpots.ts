const EARTH_RADIUS_M = 6371000
// GPSの実務上の誤差・記録間隔（15秒毎）を踏まえた「通過とみなす」距離。狭すぎると住宅密集地で誤検知が増える。
export const MISSED_SPOT_THRESHOLD_M = 40

function toRad(deg: number) {
  return (deg * Math.PI) / 180
}

export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h))
}

export type SpotForCheck = { id: string; address: string | null; latitude: number; longitude: number; orderInRoute: number }
export type MissedSpot = SpotForCheck & { nearestDistanceM: number | null }

// 各スポットについて、記録されたGPS軌跡のうち最も近い点との距離を求め、
// 一定距離（閾値）より近づいた記録が無ければ「通過できていない可能性がある」とみなす。
// GPS記録が1件も無い場合は判定不能なので、安全側に振って全件を要確認として返す（nearestDistanceM: null）。
export function findMissedSpots(
  spotList: SpotForCheck[],
  trackPoints: { lat: number; lng: number }[],
  thresholdMeters = MISSED_SPOT_THRESHOLD_M,
): MissedSpot[] {
  if (trackPoints.length === 0) {
    return spotList.map(s => ({ ...s, nearestDistanceM: null }))
  }

  const missed: MissedSpot[] = []
  for (const spot of spotList) {
    let nearest = Infinity
    for (const p of trackPoints) {
      const d = distanceMeters({ lat: spot.latitude, lng: spot.longitude }, p)
      if (d < nearest) nearest = d
      if (nearest <= thresholdMeters) break
    }
    if (nearest > thresholdMeters) missed.push({ ...spot, nearestDistanceM: Math.round(nearest) })
  }
  return missed
}
