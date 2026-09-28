'use client'

import { useEffect, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'

export type MapMarker = { lat: number; lng: number; alert?: boolean; missed?: boolean; target?: boolean; unvisited?: boolean }
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
  const boundsRef = useRef<[number, number][]>([])
  const [error, setError] = useState<string | null>(null)
  const [fullscreen, setFullscreen] = useState(false)

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
              radius: m.target ? 9 : 7,
              color: '#fff',
              weight: m.target ? 2.5 : 1.5,
              fillColor: m.alert ? '#F59E0B' : m.target ? '#4A7CF6' : m.unvisited ? '#E5484D' : '#3EA96B',
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

      boundsRef.current = boundsPoints
      if (boundsPoints.length > 0) {
        map.fitBounds(boundsPoints, { padding: [40, 40] })
      }
    }).catch(err => setError(err.message))

    return () => { cancelled = true }
  }, [apiKey, JSON.stringify(markers), JSON.stringify(path), JSON.stringify(currentLocation)])

  useEffect(() => {
    if (!apiKey || !mapRef.current || !focusLatLng) return
    // animate:trueだとズームアニメーションが完了せずsetViewが反映されない環境があったため、
    // 即時反映（アニメーション無し）にしている
    mapRef.current.setView([focusLatLng.lat, focusLatLng.lng], 18, { animate: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, JSON.stringify(focusLatLng)])

  useEffect(() => {
    return () => {
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  // 全画面表示の切り替え時、コンテナサイズが変わったことをLeafletに伝えて
  // タイルの欠けを防ぎ、元の範囲が収まるよう視点を引き直す
  useEffect(() => {
    document.body.style.overflow = fullscreen ? 'hidden' : ''
    const id = requestAnimationFrame(() => {
      if (!mapRef.current) return
      mapRef.current.invalidateSize()
      if (boundsRef.current.length > 0) {
        mapRef.current.fitBounds(boundsRef.current, { padding: [40, 40] })
      }
    })
    return () => {
      cancelAnimationFrame(id)
      document.body.style.overflow = ''
    }
  }, [fullscreen])

  if (!apiKey) return null
  if (error) return <div style={{ padding: 12, fontSize: 12.5, color: 'var(--danger)' }}>{error}</div>

  return (
    <div style={fullscreen
      ? { position: 'fixed', inset: 0, zIndex: 3000, background: 'var(--bg-2)' }
      : { position: 'relative', width: '100%', height }}
    >
      <div
        ref={containerRef}
        style={fullscreen
          ? { width: '100%', height: '100%' }
          : { width: '100%', height: '100%', borderRadius: 10, border: '1px solid var(--border)' }}
      />
      <button
        type="button"
        onClick={() => setFullscreen(f => !f)}
        aria-label={fullscreen ? '全画面を閉じる' : '全画面表示'}
        style={{
          position: 'absolute', top: 10, right: 10, zIndex: 1001,
          width: 36, height: 36, borderRadius: 8, border: '1px solid var(--border)',
          background: 'var(--bg-2)', color: 'var(--text)', fontSize: 16, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 1px 4px rgba(0,0,0,.2)',
        }}
      >
        {fullscreen ? '✕' : '⛶'}
      </button>
      {focusLatLng && (
        <>
          <div style={{
            position: 'absolute', top: '50%', left: '50%', width: 28, height: 2,
            background: '#E5484D', transform: 'translate(-50%, -50%)', pointerEvents: 'none', zIndex: 500,
            boxShadow: '0 0 2px rgba(0,0,0,0.6)',
          }} />
          <div style={{
            position: 'absolute', top: '50%', left: '50%', width: 2, height: 28,
            background: '#E5484D', transform: 'translate(-50%, -50%)', pointerEvents: 'none', zIndex: 500,
            boxShadow: '0 0 2px rgba(0,0,0,0.6)',
          }} />
        </>
      )}
    </div>
  )
}
