import { db } from '@/db/client'
import { spots } from '@/db/schema'
import { and, between } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth'
import { distanceMeters } from '@/lib/missedSpots'

const MAX_RADIUS_M = 3000
const MAX_RESULTS = 300

// 早朝回収で、現在地の周辺にあるスポット（全ルート分）を近い順に返す。
// 数千件ある全スポットを端末に配らないよう、緯度経度の範囲で絞ってから距離で並べる
export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) return Response.json({ error: 'ログインが必要です' }, { status: 401 })

  const url = new URL(request.url)
  const lat = Number(url.searchParams.get('lat'))
  const lng = Number(url.searchParams.get('lng'))
  const radius = Math.min(Number(url.searchParams.get('radius')) || 1000, MAX_RADIUS_M)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return Response.json({ error: 'lat, lng are required' }, { status: 400 })
  }

  const dLat = radius / 111320
  const dLng = radius / (111320 * Math.max(Math.cos((lat * Math.PI) / 180), 0.2))
  const rows = await db.select({
    id: spots.id, address: spots.address, latitude: spots.latitude, longitude: spots.longitude,
  }).from(spots).where(and(
    between(spots.latitude, lat - dLat, lat + dLat),
    between(spots.longitude, lng - dLng, lng + dLng),
  ))

  const nearby = rows
    .map(r => ({ ...r, distance: distanceMeters({ lat, lng }, { lat: r.latitude, lng: r.longitude }) }))
    .filter(r => r.distance <= radius)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, MAX_RESULTS)

  return Response.json({ spots: nearby.map(({ distance, ...s }) => s) })
}
