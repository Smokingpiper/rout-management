'use client'

const SOUND_URL = '/sounds/spot-passed.mp3'

let audio: HTMLAudioElement | null = null
let unlocked = false

function getAudio(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null
  if (!audio) {
    audio = new Audio(SOUND_URL)
    audio.preload = 'auto'
  }
  return audio
}

export function isSpotSoundUnlocked() {
  return unlocked
}

// iOS Safari等はユーザー操作を伴わずに音声を再生できないため、ボタンタップ等の
// ユーザー操作イベントの中でこれを呼び、一度実際に再生することで以後（GPSトリガー等）
// も再生できるようにする
export async function unlockSpotSound(): Promise<void> {
  const el = getAudio()
  if (!el) return
  try {
    el.currentTime = 0
    await el.play()
    unlocked = true
  } catch {
    /* ユーザー操作イベント外での再生ブロック等は無視 */
  }
}

// スポット通過時などの通知音
export function playSpotSound() {
  const el = getAudio()
  if (!el) return
  el.currentTime = 0
  el.play().catch(() => {})
}
