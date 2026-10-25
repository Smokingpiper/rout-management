'use client'

import { useEffect, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import type { PatrolRow } from '@/lib/patrolStatus'

const TILE_URL = (key: string) => `https://api.maptiler.com/maps/streets-v4/256/{z}/{x}/{y}.png?key=${key}`
const ATTRIBUTION = '&copy; <a href="https://www.maptiler.com/copyright/" target="_blank" rel="noreferrer">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'

function hhmm(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' })
}

// 全ルートを重ねて表示する地図。ルートごとに色を分け、表示するルートは親（チップ）で絞り込む。
//  ・小さな点＝スポット（緑=通過済み、灰=まだ、赤=周回漏れの恐れのあるルートの未通過、橙の縁=要注意）
//  ・線＝走行経路、大きな丸＝最新の現在地
export default function PatrolMap({
  rows, colorOf, focusKey, onPick, onSpotClick, alertOverrides, activeSpotId, overlay, height = 440,
}: {
  rows: PatrolRow[]            // 表示するルート（絞り込み済み）
  colorOf: Map<string, string> // ルートごとの色
  focusKey: string | null      // 「地図で見る」で選ばれたルート
  onPick: (key: string) => void                       // 線・現在地を押したとき（そのルートの一覧へ）
  onSpotClick: (spotId: string, key: string) => void  // スポットを押したとき（要注意の設定・メモ）
  alertOverrides: Map<string, boolean>                // この画面で変更した要注意の状態（再読み込み前でも地図に反映）
  activeSpotId: string | null
  overlay?: React.ReactNode
  height?: number
}) {
  const apiKey = process.env.NEXT_PUBLIC_MAPTILER_KEY
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const layerRef = useRef<any>(null)
  const lastFitRef = useRef('')
  const onPickRef = useRef(onPick)
  onPickRef.current = onPick
  const onSpotRef = useRef(onSpotClick)
  onSpotRef.current = onSpotClick
  const [fullscreen, setFullscreen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 絞り込みが変わったとき・「地図で見る」を押したときだけ表示範囲を合わせる
  // （1分ごとの自動更新では、見ている位置を動かさない）
  const visibleSig = rows.map(r => r.key).sort().join(',')

  useEffect(() => {
    if (!apiKey || !containerRef.current) return
    let cancelled = false
    import('leaflet').then(L => {
      if (cancelled || !containerRef.current) return
      if (!mapRef.current) {
        mapRef.current = L.map(containerRef.current, { renderer: L.canvas({ tolerance: 8 }) }) // 点を指で押しやすいよう、押せる範囲を広げる
          .setView([35.69, 139.69], 12)
        L.tileLayer(TILE_URL(apiKey), { attribution: ATTRIBUTION, maxZoom: 20 }).addTo(mapRef.current)
        layerRef.current = L.layerGroup().addTo(mapRef.current)
      }
      const map = mapRef.current
      layerRef.current.clearLayers()

      const bounds: [number, number][] = []
      const boundsByKey = new Map<string, [number, number][]>()

      for (const row of rows) {
        const color = colorOf.get(row.key) ?? '#4A7CF6'
        const pts: [number, number][] = []
        const unvisitedColor = row.level === 'danger' ? '#E5484D' : '#9CA3AF'

        for (const [lat, lng, unvisited, alertFlag, spotId] of row.map.spots) {
          pts.push([lat, lng])
          const alert = alertOverrides.get(spotId) ?? !!alertFlag
          const active = spotId === activeSpotId
          const m = L.circleMarker([lat, lng], {
            radius: active ? 10 : alert ? 7 : 6,
            color: active ? '#1D4ED8' : alert ? '#F59E0B' : '#fff',
            weight: active ? 3.5 : alert ? 3 : 1,
            fillColor: unvisited ? unvisitedColor : '#3EA96B',
            fillOpacity: 0.95,
          })
          m.on('click', () => onSpotRef.current(spotId, row.key))
          m.addTo(layerRef.current)
        }

        if (row.map.track.length > 1) {
          L.polyline(row.map.track, { color, weight: 4, opacity: 0.85, lineJoin: 'round' })
            .on('click', () => onPickRef.current(row.key))
            .addTo(layerRef.current)
          row.map.track.forEach(p => pts.push(p))
        }

        if (row.map.last) {
          const [lat, lng] = row.map.last
          const dot = L.circleMarker([lat, lng], { radius: 9, color: '#fff', weight: 3, fillColor: color, fillOpacity: 1 })
          dot.bindTooltip(`${row.title}　最終 ${hhmm(row.lastPointAt)}`, { direction: 'top' })
          dot.on('click', () => onPickRef.current(row.key))
          dot.addTo(layerRef.current)
        }

        pts.forEach(p => bounds.push(p))
        boundsByKey.set(row.key, pts)
      }

      const sig = `${visibleSig}|${focusKey ?? ''}`
      if (sig !== lastFitRef.current) {
        const target = focusKey && boundsByKey.get(focusKey)?.length ? boundsByKey.get(focusKey)! : bounds
        if (target.length > 0) map.fitBounds(target, { padding: [30, 30], maxZoom: 17 })
        lastFitRef.current = sig
      }
    }).catch(e => setError(e.message))
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, rows, focusKey, visibleSig, alertOverrides, activeSpotId])

  useEffect(() => {
    document.body.style.overflow = fullscreen ? 'hidden' : ''
    const id = requestAnimationFrame(() => mapRef.current?.invalidateSize())
    return () => { cancelAnimationFrame(id); document.body.style.overflow = '' }
  }, [fullscreen])

  useEffect(() => () => { mapRef.current?.remove(); mapRef.current = null }, [])

  if (!apiKey) return <div className="card" style={{ fontSize: 12.5, color: 'var(--text-3)' }}>地図のAPIキーが未設定のため、地図は表示できません。</div>
  if (error) return <div className="card" style={{ fontSize: 12.5, color: 'var(--danger)' }}>{error}</div>

  return (
    <div style={fullscreen
      ? { position: 'fixed', inset: 0, zIndex: 3000, background: 'var(--bg-2)' }
      : { position: 'relative', width: '100%', height, marginBottom: 14 }}
    >
      <div
        ref={containerRef}
        style={fullscreen
          ? { position: 'absolute', inset: 0 }
          : { position: 'absolute', inset: 0, borderRadius: 10, border: '1px solid var(--border)' }}
      />
      <button
        type="button"
        onClick={() => setFullscreen(f => !f)}
        aria-label={fullscreen ? '全画面を閉じる' : '全画面表示'}
        style={{
          position: 'absolute', top: 10, right: 10, zIndex: 1001,
          width: 36, height: 36, borderRadius: 8, border: '1px solid var(--border)',
          background: 'var(--bg-2)', color: 'var(--text)', fontSize: 16, cursor: 'pointer',
          boxShadow: '0 1px 4px rgba(0,0,0,.2)',
        }}
      >
        {fullscreen ? '✕' : '⛶'}
      </button>
      {overlay && <div style={{ position: 'absolute', left: 8, right: 8, top: 8, zIndex: 1002, maxWidth: 560 }}>{overlay}</div>}
      <div style={{
        position: 'absolute', left: 8, bottom: 22, zIndex: 1001, fontSize: 11, color: 'var(--text-2)',
        background: 'rgba(255,255,255,.88)', padding: '3px 8px', borderRadius: 6, lineHeight: 1.6,
      }}>
        <span style={{ color: '#3EA96B' }}>●</span> 通過済み　<span style={{ color: '#9CA3AF' }}>●</span> まだ　<span style={{ color: '#E5484D' }}>●</span> 周回漏れの恐れ
        <span style={{ color: '#F59E0B' }}>◎</span> 要注意　━ 走行経路　⬤ 現在地　（点を押すと要注意の設定ができます）
      </div>
    </div>
  )
}
