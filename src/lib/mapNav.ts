'use client'

import { useEffect, useState } from 'react'

// ドライバーの端末がGoogle Mapsアプリ以外（iOS/Mac）かどうかを判定する。
// SSR時・初回クライアントレンダー時はサーバーと同じ描画にするためfalse固定で、
// マウント後にuseEffectで実際のUserAgentを見て更新する（hydrationミスマッチを避けるため）。
export function useIsApplePlatform(): boolean {
  const [isApple, setIsApple] = useState(false)
  useEffect(() => {
    setIsApple(/iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent))
  }, [])
  return isApple
}

export function navAppLabel(isApple: boolean): string {
  return isApple ? 'Apple Maps' : 'Google Maps'
}

export function navUrl(lat: number, lng: number, isApple: boolean): string {
  return isApple
    ? `https://maps.apple.com/directions?destination=${lat},${lng}&mode=driving`
    : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`
}
