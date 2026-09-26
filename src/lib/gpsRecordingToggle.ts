'use client'

import { useEffect, useState } from 'react'

// ドライバーが手動でGPS記録を一時停止/再開できるようにする。
// ルート概要画面とスポット詳細画面はページ遷移のたびに独立してマウントされるため、
// 状態はlocalStorageに日報IDごとに保存し、画面をまたいでも同じON/OFFが引き継がれるようにする。
function storageKey(dailyReportId: string) {
  return `gps-recording-${dailyReportId}`
}

export function useGpsRecordingToggle(dailyReportId: string) {
  const [on, setOn] = useState(true)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey(dailyReportId))
      if (saved !== null) setOn(saved === '1')
    } catch {}
  }, [dailyReportId])

  function toggle() {
    setOn(prev => {
      const next = !prev
      try { localStorage.setItem(storageKey(dailyReportId), next ? '1' : '0') } catch {}
      return next
    })
  }

  return { on, toggle }
}
