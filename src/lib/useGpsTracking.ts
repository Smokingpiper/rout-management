'use client'

import { useEffect, useRef, useState } from 'react'

const MIN_INTERVAL_MS = 15000 // GPS点をサーバーに送る最短間隔

export function useGpsTracking(dailyReportId: string, enabled: boolean, initialCount: number) {
  const [gpsActive, setGpsActive] = useState(false)
  const [gpsError, setGpsError] = useState<string | null>(null)
  const [pointCount, setPointCount] = useState(initialCount)
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null)
  const lastSentAt = useRef(0)

  useEffect(() => {
    if (!enabled) return
    if (!('geolocation' in navigator)) {
      setGpsError('この端末は位置情報に対応していません')
      return
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsActive(true)
        setCurrentLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        const now = Date.now()
        if (now - lastSentAt.current < MIN_INTERVAL_MS) return
        lastSentAt.current = now
        fetch('/api/driver/track-points', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dailyReportId,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          }),
        }).then(res => { if (res.ok) setPointCount(c => c + 1) })
      },
      (err) => setGpsError(err.message || '位置情報を取得できませんでした'),
      { enableHighAccuracy: true, maximumAge: 10000 },
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [enabled, dailyReportId])

  return { gpsActive, gpsError, pointCount, currentLocation }
}

export function navUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`
}
