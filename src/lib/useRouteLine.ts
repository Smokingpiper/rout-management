'use client'

import { useEffect, useRef, useState } from 'react'
import { distanceMeters } from './missedSpots'
import type { LatLng } from '@/components/LeafletMap'

const MIN_REFETCH_INTERVAL_MS = 15000
const MIN_MOVE_METERS = 30

// OSRMの公開デモサーバー（登録不要・無料）。区間（現在地→次のスポット）ごとの
// 単発リクエストのみで、常時表示課金だったGoogle Maps JS APIとは負荷特性が違う。
// ただし商用の大量利用は推奨されていないため、利用者数が増えたら自前ホスティングを検討する。
const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving'

// 現在地からスポットまでの道路沿いルート線を取得する。GPS更新のたびに叩くと
// デモサーバーに負荷をかけすぎるため、一定距離動いた場合のみ・最低間隔を空けて再取得する。
export function useRouteLine(origin: LatLng | null, destination: LatLng | null) {
  const [routeLine, setRouteLine] = useState<LatLng[] | null>(null)
  const [routeError, setRouteError] = useState<string | null>(null)
  const lastFetchedAt = useRef(0)
  const lastOrigin = useRef<LatLng | null>(null)
  const lastDestination = useRef<LatLng | null>(null)

  useEffect(() => {
    if (!origin || !destination) return
    const now = Date.now()
    const destinationChanged = !lastDestination.current
      || lastDestination.current.lat !== destination.lat || lastDestination.current.lng !== destination.lng
    const moved = !lastOrigin.current || distanceMeters(origin, lastOrigin.current) >= MIN_MOVE_METERS
    if (!destinationChanged) {
      if (lastOrigin.current && !moved) return
      if (now - lastFetchedAt.current < MIN_REFETCH_INTERVAL_MS) return
    }

    let cancelled = false
    lastFetchedAt.current = now
    lastOrigin.current = origin
    lastDestination.current = destination

    const url = `${OSRM_BASE}/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`
    fetch(url)
      .then(res => res.json())
      .then(json => {
        if (cancelled) return
        const coords = json?.routes?.[0]?.geometry?.coordinates as [number, number][] | undefined
        if (coords && coords.length > 0) {
          setRouteLine(coords.map(([lng, lat]) => ({ lat, lng })))
          setRouteError(null)
        } else {
          setRouteError('経路を取得できませんでした')
        }
      })
      .catch(() => { if (!cancelled) setRouteError('経路を取得できませんでした') })

    return () => { cancelled = true }
  }, [origin?.lat, origin?.lng, destination?.lat, destination?.lng])

  return { routeLine, routeError }
}
