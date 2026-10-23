'use client'

import { useEffect, useRef, useState } from 'react'

// GPS点をサーバーに送る最短間隔。ごみ収集は徒歩に近い速さ（秒速1〜2m）で進むため、2秒なら点の間隔は数mに収まり、
// 狭い判定距離でも通過を取りこぼしにくい（速く走る場合は間隔が空くので、通過判定は点どうしをつなぐ線分で補う余地がある）
const MIN_INTERVAL_MS = 2000

export function useGpsTracking(dailyReportId: string, enabled: boolean, initialCount: number) {
  const [gpsActive, setGpsActive] = useState(false)
  const [gpsError, setGpsError] = useState<string | null>(null)
  const [pointCount, setPointCount] = useState(initialCount)
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [backgrounded, setBackgrounded] = useState(false)
  const lastSentAt = useRef(0)

  useEffect(() => {
    if (!enabled) return
    if (!('geolocation' in navigator)) {
      setGpsError('この端末は位置情報に対応していません')
      return
    }

    function sendPoint(lat: number, lng: number, force: boolean) {
      setCurrentLocation({ lat, lng })
      const now = Date.now()
      if (!force && now - lastSentAt.current < MIN_INTERVAL_MS) return
      lastSentAt.current = now
      fetch('/api/driver/track-points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dailyReportId, latitude: lat, longitude: lng }),
      }).then(res => { if (res.ok) setPointCount(c => c + 1) })
    }

    // watchPositionの初回コールバックは測位に時間がかかることがあるため、
    // 収集開始直後は getCurrentPosition でも並行して現在地を取りにいき、
    // マップの参考ルート線などができるだけ早く表示されるようにする
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsActive(true)
        sendPoint(pos.coords.latitude, pos.coords.longitude, false)
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 },
    )

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsActive(true)
        sendPoint(pos.coords.latitude, pos.coords.longitude, false)
      },
      (err) => setGpsError(err.message || '位置情報を取得できませんでした'),
      // maximumAge:0 = 端末が保持している少し前の位置ではなく、常に新しく測った位置を使う
      { enableHighAccuracy: true, maximumAge: 0 },
    )

    // ナビアプリ（Google/Apple Maps）を開くとブラウザがバックグラウンドになり、
    // 端末によっては watchPosition が止まる。画面に戻った瞬間に現在地を取り直すことで、
    // 記録の空白期間をできるだけ短くする（完全なバックグラウンド記録はWebアプリでは不可）
    function handleVisibilityChange() {
      if (document.hidden) {
        setBackgrounded(true)
        return
      }
      setBackgrounded(false)
      navigator.geolocation.getCurrentPosition(
        (pos) => sendPoint(pos.coords.latitude, pos.coords.longitude, true),
        () => {},
        { enableHighAccuracy: true, maximumAge: 5000 },
      )
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      navigator.geolocation.clearWatch(watchId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [enabled, dailyReportId])

  return { gpsActive, gpsError, pointCount, currentLocation, backgrounded }
}
