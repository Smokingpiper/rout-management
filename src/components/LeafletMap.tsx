'use client'

import { useEffect, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'

export type MapMarker = { lat: number; lng: number; alert?: boolean; missed?: boolean }
export type LatLng = { lat: number; lng: number }

// MapTilerの256pxラスタタイル。512px版(streets-v4/{z}/{x}/{y}.png)を使う場合は
// tileSize:512, zoomOffset:-1 が必要になるため、Leafletの既定に合わせて256px版を使う。
const TILE_URL = (key: string) => `https://api.maptiler.com/maps/streets-v4/256/{z}/{x}/{y}.png?key=${key}`
const ATTRIBUTION = '&copy; <a href="https://www.maptiler.com/copyright/" target="_blank" rel="noreferrer">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'

export default function LeafletMap({
  markers, path, height = 300, currentLocation, focusLatLng,
}: {
  markers: MapMarker[]
  path?: LatLng[]
  height?: number
  currentLocation?: LatLng | null
  focusLatLng?: LatLng | null
}) {
  const apiKey = process.env.NEXT_PUBLIC_MAPTILER_KEY
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const overlaysRef = useRef<any[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!apiKey || !containerRef.current) return
    let cancelled = false

    import('leaflet').then(L => {
      if (cancelled || !containerRef.current) return

      if (!mapRef.current) {
        const first = markers[0] ?? { lat: 35.6895, lng: 139.6917 }
        mapRef.current = L.map(containerRef.current).setView([first.lat, first.lng], 15)
        L.tileLayer(TILE_URL(apiKey), {
          attribution: ATTRIBUTION,
          maxZoom: 20,
        }).addTo(mapRef.current)
      }
      const map = mapRef.current

      overlaysRef.current.forEach(o => map.removeLayer(o))
      overlaysRef.current = []

      const boundsPoints: [number, number][] = []

      for (const m of markers) {
        const marker = m.missed
          ? L.marker([m.lat, m.lng], {
              icon: L.divIcon({
                html: '⚠️',
                className: 'missed-spot-icon',
                iconSize: [20, 20],
                iconAnchor: [10, 10],
              }),
            })
          : L.circleMarker([m.lat, m.lng], {
              radius: 7,
              color: '#fff',
              weight: 1.5,
              fillColor: m.alert ? '#F59E0B' : '#3EA96B',
              fillOpacity: 1,
            })
        marker.addTo(map)
        overlaysRef.current.push(marker)
        boundsPoints.push([m.lat, m.lng])
      }

      if (path && path.length > 1) {
        const line = L.polyline(path.map(p => [p.lat, p.lng] as [number, number]), {
          color: '#4A7CF6',
          opacity: 0.9,
          weight: 3,
        }).addTo(map)
        overlaysRef.current.push(line)
        path.forEach(p => boundsPoints.push([p.lat, p.lng]))
      }

      if (currentLocation) {
        const cur = L.circleMarker([currentLocation.lat, currentLocation.lng], {
          radius: 8,
          color: '#fff',
          weight: 2,
          fillColor: '#4A7CF6',
          fillOpacity: 1,
        }).addTo(map)
        overlaysRef.current.push(cur)
        boundsPoints.push([currentLocation.lat, currentLocation.lng])
      }

      if (boundsPoints.length > 0) {
        map.fitBounds(boundsPoints, { padding: [40, 40] })
      }
    }).catch(err => setError(err.message))

    return () => { cancelled = true }
  }, [apiKey, JSON.stringify(markers), JSON.stringify(path), JSON.stringify(currentLocation)])

  useEffect(() => {
    console.log('[LeafletMap] focus effect fired', { apiKey: !!apiKey, hasMap: !!mapRef.current, focusLatLng })
    if (!apiKey || !mapRef.current || !focusLatLng) return
    console.log('[LeafletMap] calling setView', focusLatLng, 'currentZoom=', mapRef.current.getZoom())
    mapRef.current.setView([focusLatLng.lat, focusLatLng.lng], 18, { animate: true })
    console.log('[LeafletMap] after setView, zoom=', mapRef.current.getZoom())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, JSON.stringify(focusLatLng)])

  useEffect(() => {
    return () => {
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  if (!apiKey) return null
  if (error) return <div style={{ padding: 12, fontSize: 12.5, color: 'var(--danger)' }}>{error}</div>

  return <div ref={containerRef} style={{ width: '100%', height, borderRadius: 10, border: '1px solid var(--border)' }} />
}
