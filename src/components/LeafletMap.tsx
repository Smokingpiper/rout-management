'use client'

import { useEffect, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'

export type MapMarker = { id?: string; lat: number; lng: number; alert?: boolean; missed?: boolean; target?: boolean; unvisited?: boolean }
export type LatLng = { lat: number; lng: number }
// 走行経路。segments=途切れずにつながった経路（実線）、gaps=GPSが途切れた区間（破線）、dots=記録された各点
export type TrackLayer = { segments: LatLng[][]; gaps: [LatLng, LatLng][]; dots: LatLng[] }

// MapTilerの256pxラスタタイル。512px版(streets-v4/{z}/{x}/{y}.png)を使う場合は
// tileSize:512, zoomOffset:-1 が必要になるため、Leafletの既定に合わせて256px版を使う。
const TILE_URL = (key: string) => `https://api.maptiler.com/maps/streets-v4/256/{z}/{x}/{y}.png?key=${key}`
const ATTRIBUTION = '&copy; <a href="https://www.maptiler.com/copyright/" target="_blank" rel="noreferrer">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'

// 進行方向表示（ヘディングアップ）用。GPSの2点間の方位から進行方向を求める
const HEADING_MIN_MOVE_M = 8      // これ未満の動きはGPSの揺れとみなして向きを更新しない
const HEADING_SMOOTHING = 0.6     // 新しい向きをどれだけ反映するか（1=そのまま、小さいほど滑らか）
const HEADING_ZOOM = 17           // 進行方向モードに入ったときの最小ズーム
const HEADING_STORAGE_KEY = 'rm_map_heading_up'

function distanceM(a: LatLng, b: LatLng) {
  const dLat = (b.lat - a.lat) * 111_320
  const dLng = (b.lng - a.lng) * 111_320 * Math.cos((a.lat * Math.PI) / 180)
  return Math.hypot(dLat, dLng)
}

function bearingDeg(a: LatLng, b: LatLng) {
  const dLat = b.lat - a.lat
  const dLng = (b.lng - a.lng) * Math.cos((a.lat * Math.PI) / 180)
  return ((Math.atan2(dLng, dLat) * 180) / Math.PI + 360) % 360
}

export default function LeafletMap({
  markers, path, track, height = 300, currentLocation, focusLatLng, onMarkerClick, overlay,
}: {
  overlay?: React.ReactNode // 地図の下端に重ねて表示するもの（全画面表示中でも見える）
  markers: MapMarker[]
  path?: LatLng[]
  track?: TrackLayer
  height?: number
  currentLocation?: LatLng | null
  focusLatLng?: LatLng | null
  onMarkerClick?: (id: string) => void
}) {
  // マーカーのクリック処理は再描画のたびに作り直さないよう ref 経由で最新のものを呼ぶ
  const onMarkerClickRef = useRef(onMarkerClick)
  onMarkerClickRef.current = onMarkerClick
  const apiKey = process.env.NEXT_PUBLIC_MAPTILER_KEY
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const overlaysRef = useRef<any[]>([])
  const boundsRef = useRef<[number, number][]>([])
  // ユーザーが地図を操作（ドラッグ・ズーム等）した後は、GPS更新やスポット通過のたびに
  // 全体表示へ自動で引き戻さない。戻したいときは「現在地」ボタンを使う
  const userMovedRef = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [fullscreen, setFullscreen] = useState(false)

  // 進行方向を上にするモード。Leafletに回転機能は無いため、地図要素を大きめにして
  // CSSで回転させる（四隅が見切れないよう、表示領域の対角線の長さの正方形にする）。
  // 回転中は指のドラッグで地図がずれてしまうので、現在地に追従させ、ドラッグは止める
  const clipRef = useRef<HTMLDivElement>(null)
  const [headingUp, setHeadingUp] = useState(false)
  const headingUpRef = useRef(false)
  headingUpRef.current = headingUp
  const [heading, setHeading] = useState<number | null>(null) // 連続値（360°をまたいでも飛ばない）
  const lastFixRef = useRef<LatLng | null>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })

  useEffect(() => {
    try { if (localStorage.getItem(HEADING_STORAGE_KEY) === '1') setHeadingUp(true) } catch { /* 保存できない環境では毎回OFFから */ }
  }, [])

  function toggleHeadingUp() {
    setHeadingUp(v => {
      const next = !v
      try { localStorage.setItem(HEADING_STORAGE_KEY, next ? '1' : '0') } catch { /* 無視 */ }
      return next
    })
  }

  useEffect(() => {
    const el = clipRef.current
    if (!el) return
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [apiKey])

  // 現在地が一定距離以上動いたら、直前の位置からの方位を進行方向とする（止まっている間は向きを保つ）
  useEffect(() => {
    if (!currentLocation) return
    const last = lastFixRef.current
    if (!last) { lastFixRef.current = currentLocation; return }
    if (distanceM(last, currentLocation) < HEADING_MIN_MOVE_M) return
    const target = bearingDeg(last, currentLocation)
    lastFixRef.current = currentLocation
    setHeading(prev => {
      if (prev === null) return target
      const diff = ((target - prev + 540) % 360) - 180 // -180〜180の最短差
      return prev + diff * HEADING_SMOOTHING
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLocation?.lat, currentLocation?.lng])

  const rotating = headingUp && !!currentLocation
  const rotation = rotating && heading !== null ? -heading : 0
  const diag = Math.ceil(Math.hypot(size.w, size.h))
  const rotatingRef = useRef(false)
  rotatingRef.current = rotating

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

        const markMoved = () => { userMovedRef.current = true }
        containerRef.current.addEventListener('pointerdown', markMoved)
        containerRef.current.addEventListener('wheel', markMoved, { passive: true })
      }
      const map = mapRef.current

      overlaysRef.current.forEach(o => map.removeLayer(o))
      overlaysRef.current = []

      const boundsPoints: [number, number][] = []

      // 走行経路はスポットのマーカーより下に描く
      if (track) {
        for (const g of track.gaps) {
          const gap = L.polyline([[g[0].lat, g[0].lng], [g[1].lat, g[1].lng]], {
            color: '#F59E0B', weight: 4, opacity: 0.95, dashArray: '2 9', lineCap: 'round',
          }).addTo(map)
          overlaysRef.current.push(gap)
        }
        for (const seg of track.segments) {
          if (seg.length < 2) continue
          const line = L.polyline(seg.map(p => [p.lat, p.lng] as [number, number]), {
            color: '#4A7CF6', weight: 5, opacity: 0.8, lineJoin: 'round', lineCap: 'round',
          }).addTo(map)
          overlaysRef.current.push(line)
        }
        // 記録された各点。GPSがまばらだった場所が分かるよう、点も小さく描く
        const step = Math.max(1, Math.ceil(track.dots.length / 1500))
        track.dots.forEach((p, i) => {
          if (i % step !== 0) return
          const dot = L.circleMarker([p.lat, p.lng], {
            radius: 2.5, color: '#fff', weight: 1, fillColor: '#1E40AF', fillOpacity: 1, interactive: false,
          }).addTo(map)
          overlaysRef.current.push(dot)
        })
        track.dots.forEach(p => boundsPoints.push([p.lat, p.lng]))
      }

      for (const m of markers) {
        const marker = m.missed
          ? L.marker([m.lat, m.lng], {
              icon: L.divIcon({
                // 地図を回しているときも絵文字は正立させる（--counter は地図の回転を打ち消す角度）
                html: '<span style="display:inline-block;transform:rotate(var(--counter,0deg))">⚠️</span>',
                className: 'missed-spot-icon',
                iconSize: [34, 34], // 指でタップしやすい大きさ
                iconAnchor: [17, 17],
              }),
            })
          : L.circleMarker([m.lat, m.lng], {
              radius: m.target ? 9 : 7,
              color: '#fff',
              weight: m.target ? 2.5 : 1.5,
              fillColor: m.alert ? '#F59E0B' : m.target ? '#4A7CF6' : m.unvisited ? '#E5484D' : '#3EA96B',
              fillOpacity: 1,
            })
        if (m.id) {
          const markerId = m.id
          marker.on('click', () => onMarkerClickRef.current?.(markerId))
        }
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
        const cur = rotatingRef.current
          // 進行方向モードでは、画面の上向きを指す矢印にする
          ? L.marker([currentLocation.lat, currentLocation.lng], {
              interactive: false,
              zIndexOffset: 1000,
              icon: L.divIcon({
                html: '<div style="width:28px;height:28px;transform:rotate(var(--counter,0deg))"><svg viewBox="0 0 28 28" width="28" height="28"><path d="M14 2 L24 25 L14 19 L4 25 Z" fill="#4A7CF6" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg></div>',
                className: 'heading-arrow-icon',
                iconSize: [28, 28],
                iconAnchor: [14, 14],
              }),
            })
          : L.circleMarker([currentLocation.lat, currentLocation.lng], {
              radius: 8,
              color: '#fff',
              weight: 2,
              fillColor: '#4A7CF6',
              fillOpacity: 1,
            })
        cur.addTo(map)
        overlaysRef.current.push(cur)
        boundsPoints.push([currentLocation.lat, currentLocation.lng])
      }

      boundsRef.current = boundsPoints
      if (rotatingRef.current && currentLocation) {
        // 進行方向モードは常に現在地が中央。ズームは今のものを保つ（寄りすぎ・引きすぎの初期値だけ補正）
        map.setView([currentLocation.lat, currentLocation.lng], Math.max(map.getZoom(), HEADING_ZOOM), { animate: false })
      } else if (boundsPoints.length > 0 && !userMovedRef.current) {
        map.fitBounds(boundsPoints, { padding: [40, 40] })
      }
    }).catch(err => setError(err.message))

    return () => { cancelled = true }
  }, [apiKey, rotating, track, JSON.stringify(markers), JSON.stringify(path), JSON.stringify(currentLocation)])

  // 回転中はドラッグ移動を止め、ピンチは中心基準にする（回した地図ではドラッグの向きがずれるため）。
  // 地図要素の大きさが変わったらタイルの描画範囲を引き直す
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (rotating) { map.dragging.disable(); map.options.touchZoom = 'center' }
    else { map.dragging.enable(); map.options.touchZoom = true }
    map.invalidateSize()
  }, [rotating, diag, size.w, size.h])

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
      if (boundsRef.current.length > 0 && !userMovedRef.current && !rotatingRef.current) {
        mapRef.current.fitBounds(boundsRef.current, { padding: [40, 40] })
      }
    })
    return () => {
      cancelAnimationFrame(id)
      document.body.style.overflow = ''
    }
  }, [fullscreen])

  function recenter() {
    const map = mapRef.current
    if (!map || !currentLocation) return
    // 手動で拡大していた場合はそのズームを保ち、引いていた場合だけ街区が見える程度まで寄せる
    map.setView([currentLocation.lat, currentLocation.lng], Math.max(map.getZoom(), 17), { animate: false })
  }

  if (!apiKey) return null
  if (error) return <div style={{ padding: 12, fontSize: 12.5, color: 'var(--danger)' }}>{error}</div>

  return (
    <div style={fullscreen
      ? { position: 'fixed', inset: 0, zIndex: 3000, background: 'var(--bg-2)' }
      : { position: 'relative', width: '100%', height }}
    >
      <style>{'.rm-rotating .leaflet-control-container{display:none}'}</style>
      <div
        ref={clipRef}
        style={{
          position: 'absolute', inset: 0, overflow: 'hidden',
          ...(fullscreen ? {} : { borderRadius: 10, border: '1px solid var(--border)' }),
        }}
      >
        <div
          ref={containerRef}
          className={rotating ? 'rm-rotating' : undefined}
          style={rotating && diag > 0
            ? {
                position: 'absolute', width: diag, height: diag,
                left: (size.w - diag) / 2, top: (size.h - diag) / 2,
                transform: `rotate(${rotation}deg)`,
                ['--counter' as string]: `${-rotation}deg`,
              }
            : { position: 'absolute', inset: 0 }}
        />
      </div>
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
      {currentLocation && (
        <button
          type="button"
          onClick={toggleHeadingUp}
          aria-pressed={headingUp}
          aria-label={headingUp ? '北を上にする' : '進行方向を上にする'}
          style={{
            position: 'absolute', top: 54, right: 10, zIndex: 1001,
            height: 36, padding: '0 10px', borderRadius: 8,
            border: `1px solid ${headingUp ? 'var(--accent-2)' : 'var(--border)'}`,
            background: headingUp ? 'var(--accent-2)' : 'var(--bg-2)',
            color: headingUp ? '#fff' : 'var(--text)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 1px 4px rgba(0,0,0,.2)',
          }}
        >
          {headingUp ? '🧭 進行方向' : '🧭 北固定'}
        </button>
      )}
      {rotating && (
        <>
          <div style={{ position: 'absolute', left: 10, top: 10, zIndex: 1001, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[{ label: '+', d: 1 }, { label: '−', d: -1 }].map(b => (
              <button
                key={b.label}
                type="button"
                aria-label={b.d > 0 ? '拡大' : '縮小'}
                onClick={() => mapRef.current?.setZoom(mapRef.current.getZoom() + b.d, { animate: false })}
                style={{
                  width: 40, height: 40, borderRadius: 8, border: '1px solid var(--border)',
                  background: 'var(--bg-2)', color: 'var(--text)', fontSize: 22, lineHeight: 1, cursor: 'pointer',
                  boxShadow: '0 1px 4px rgba(0,0,0,.2)',
                }}
              >
                {b.label}
              </button>
            ))}
          </div>
          {/* 回転中はLeaflet標準のコントロール（帰属表示を含む）が使えないため、こちらで表示する */}
          <div style={{ position: 'absolute', right: 6, bottom: 4, zIndex: 1001, fontSize: 10, color: 'var(--text-2)', background: 'rgba(255,255,255,.75)', padding: '1px 4px', borderRadius: 3 }}>
            © MapTiler © OpenStreetMap contributors
          </div>
          {heading === null && (
            <div style={{ position: 'absolute', left: '50%', bottom: 24, transform: 'translateX(-50%)', zIndex: 1001, fontSize: 12, background: 'var(--bg-2)', color: 'var(--text-2)', padding: '4px 10px', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,.2)' }}>
              動き出すと進行方向に合わせて回転します
            </div>
          )}
        </>
      )}
      {currentLocation && !rotating && (
        <button
          type="button"
          onClick={recenter}
          aria-label="現在地に戻る"
          style={{
            position: 'absolute', bottom: 24, left: 10, zIndex: 1001,
            height: 36, padding: '0 12px', borderRadius: 18, border: '1px solid var(--border)',
            background: 'var(--bg-2)', color: 'var(--accent-2)', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 5,
            boxShadow: '0 1px 4px rgba(0,0,0,.25)',
          }}
        >
          📍 現在地
        </button>
      )}
      {overlay && (
        <div style={{ position: 'absolute', left: 8, right: 8, bottom: 28, zIndex: 1002 }}>{overlay}</div>
      )}
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
