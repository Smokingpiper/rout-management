'use client'

import { useEffect, useRef, useState } from 'react'

export type MapMarker = { lat: number; lng: number; alert?: boolean }
export type LatLng = { lat: number; lng: number }

declare global {
  interface Window {
    google?: any
    __gmapsLoadPromise?: Promise<void>
  }
}

function loadGoogleMaps(apiKey: string): Promise<void> {
  if (window.google?.maps) return Promise.resolve()
  if (window.__gmapsLoadPromise) return window.__gmapsLoadPromise
  window.__gmapsLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&loading=async`
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Google Mapsの読み込みに失敗しました'))
    document.head.appendChild(script)
  })
  return window.__gmapsLoadPromise
}

export default function GoogleMap({
  markers, path, height = 300, currentLocation,
}: {
  markers: MapMarker[]
  path?: LatLng[]
  height?: number
  currentLocation?: LatLng | null
}) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const overlaysRef = useRef<any[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!apiKey || !containerRef.current) return
    let cancelled = false

    loadGoogleMaps(apiKey)
      .then(() => {
        if (cancelled || !containerRef.current) return
        const g = window.google
        if (!mapRef.current) {
          mapRef.current = new g.maps.Map(containerRef.current, {
            zoom: 15,
            center: markers[0] ?? { lat: 35.6895, lng: 139.6917 },
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
          })
        }
        const map = mapRef.current

        overlaysRef.current.forEach(o => o.setMap(null))
        overlaysRef.current = []

        const bounds = new g.maps.LatLngBounds()

        for (const m of markers) {
          const marker = new g.maps.Marker({
            position: m,
            map,
            icon: {
              path: g.maps.SymbolPath.CIRCLE,
              scale: 7,
              fillColor: m.alert ? '#F59E0B' : '#3EA96B',
              fillOpacity: 1,
              strokeColor: '#fff',
              strokeWeight: 1.5,
            },
          })
          overlaysRef.current.push(marker)
          bounds.extend(m)
        }

        if (path && path.length > 1) {
          const line = new g.maps.Polyline({
            path,
            map,
            strokeColor: '#4A7CF6',
            strokeOpacity: 0.9,
            strokeWeight: 3,
          })
          overlaysRef.current.push(line)
          path.forEach(p => bounds.extend(p))
        }

        if (currentLocation) {
          const cur = new g.maps.Marker({
            position: currentLocation,
            map,
            icon: {
              path: g.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: '#4A7CF6',
              fillOpacity: 1,
              strokeColor: '#fff',
              strokeWeight: 2,
            },
          })
          overlaysRef.current.push(cur)
          bounds.extend(currentLocation)
        }

        if (!bounds.isEmpty()) map.fitBounds(bounds, 40)
      })
      .catch(err => setError(err.message))

    return () => { cancelled = true }
  }, [apiKey, JSON.stringify(markers), JSON.stringify(path), JSON.stringify(currentLocation)])

  if (!apiKey) return null
  if (error) return <div style={{ padding: 12, fontSize: 12.5, color: 'var(--danger)' }}>{error}</div>

  return <div ref={containerRef} style={{ width: '100%', height, borderRadius: 10, border: '1px solid var(--border)' }} />
}
