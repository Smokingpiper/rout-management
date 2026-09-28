'use client'

import { useEffect, useRef, useState } from 'react'
import { distanceMeters } from './missedSpots'
import type { LatLng } from '@/components/LeafletMap'

const MIN_REFETCH_INTERVAL_MS = 15000
const MIN_MOVE_METERS = 30
const RETRY_INTERVAL_MS = 5000 // まだ一度も経路を取得できていない間のリトライ間隔
const POLL_INTERVAL_MS = 3000

// OSRMの公開デモサーバー（登録不要・無料）。区間（現在地→次のスポット）ごとの
// 単発リクエストのみで、常時表示課金だったGoogle Maps JS APIとは負荷特性が違う。
// ただし商用の大量利用は推奨されていないため、利用者数が増えたら自前ホスティングを検討する。
const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving'

// 現在地からスポットまでの道路沿いルート線を取得する。GPS更新のたびに叩くと
// デモサーバーに負荷をかけすぎるため、一定距離動いた場合のみ・最低間隔を空けて再取得する。
// 「出る時と出ない時がある」不具合対策として、propsの変化を待つだけでなく定期的に
// ポーリングし、まだ経路を取得できていない間（初回取得中・前回失敗）は短い間隔で
// 自動リトライする（デモサーバーの一時的な失敗やタイムアウトで取得できないまま
// 固まってしまうのを防ぐ）。
export function useRouteLine(origin: LatLng | null, destination: LatLng | null) {
  const [routeLine, setRouteLine] = useState<LatLng[] | null>(null)
  const [routeError, setRouteError] = useState<string | null>(null)

  const originRef = useRef(origin)
  const destinationRef = useRef(destination)
  originRef.current = origin
  destinationRef.current = destination

  const lastFetchedAt = useRef(0)
  const lastFetchOrigin = useRef<LatLng | null>(null)
  const lastFetchDestination = useRef<LatLng | null>(null)
  const hasRoute = useRef(false)
  const inFlight = useRef(false)

  useEffect(() => {
    function maybeFetch() {
      const origin = originRef.current
      const destination = destinationRef.current
      if (!origin || !destination || inFlight.current) return

      const destinationChanged = !lastFetchDestination.current
        || lastFetchDestination.current.lat !== destination.lat || lastFetchDestination.current.lng !== destination.lng
      const moved = !lastFetchOrigin.current || distanceMeters(origin, lastFetchOrigin.current) >= MIN_MOVE_METERS
      const now = Date.now()

      if (!destinationChanged) {
        if (hasRoute.current) {
          if (!moved) return
          if (now - lastFetchedAt.current < MIN_REFETCH_INTERVAL_MS) return
        } else if (now - lastFetchedAt.current < RETRY_INTERVAL_MS) {
          return
        }
      }

      inFlight.current = true
      lastFetchedAt.current = now
      lastFetchOrigin.current = origin
      lastFetchDestination.current = destination

      const url = `${OSRM_BASE}/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`
      fetch(url)
        .then(res => res.json())
        .then(json => {
          const coords = json?.routes?.[0]?.geometry?.coordinates as [number, number][] | undefined
          if (coords && coords.length > 0) {
            setRouteLine(coords.map(([lng, lat]) => ({ lat, lng })))
            setRouteError(null)
            hasRoute.current = true
          } else {
            setRouteError('経路を取得できませんでした')
          }
        })
        .catch(() => setRouteError('経路を取得できませんでした'))
        .finally(() => { inFlight.current = false })
    }

    maybeFetch()
    const id = setInterval(maybeFetch, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [])

  return { routeLine, routeError }
}
