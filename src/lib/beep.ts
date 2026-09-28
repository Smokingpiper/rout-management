'use client'

let ctx: AudioContext | null = null

export function isBeepUnlocked() {
  return ctx !== null
}

// iOS Safari等はユーザー操作を伴わずに音声を再生できないため、
// ボタンタップ等のユーザー操作イベントの中でこれを呼び、AudioContextを有効化しておく。
// 生成直後もsuspended状態のままのことがあるため、生成時にも必ずresume()する
export async function unlockBeep(): Promise<void> {
  if (!ctx) {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext
    if (!Ctor) return
    ctx = new Ctor()
  }
  if (ctx.state === 'suspended') {
    try { await ctx.resume() } catch { /* noop */ }
  }
}

// スポット通過などの通知音（外部音声ファイル不要、Web Audio APIでその場生成する短いピロン音）
export function playBeep() {
  if (!ctx) return
  // バックグラウンド復帰後などにブラウザ側で再度suspendedになることがあるため、
  // 呼び出しのたびに保険で再開を試みる（結果は待たない）
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(880, now)
  osc.frequency.setValueAtTime(1320, now + 0.09)
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.3, now + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(now)
  osc.stop(now + 0.3)
}
