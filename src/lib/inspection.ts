// 紙の「日常点検・点呼表」の項目定義。項目の追加・変更はここだけで完結させる
// （DBにはキーごとの結果をjsonbで保存しているので、項目を増減してもスキーマ変更は不要）

export type CheckItem = { key: string; label: string; hint?: string }
export type CheckGroup = { key: string; title: string; items: CheckItem[] }

export const CHECK_GROUPS: CheckGroup[] = [
  {
    key: 'vehicle',
    title: '車両点検',
    items: [
      { key: 'engine', label: 'エンジン' },
      { key: 'fuel', label: '燃料' },
      { key: 'brake_pedal', label: 'ブレーキペダル' },
      { key: 'parking_brake', label: 'サイドブレーキ' },
      { key: 'battery', label: 'バッテリー' },
      { key: 'turn_signal', label: '方向指示器' },
      { key: 'brake_lamp', label: 'ブレーキランプ' },
      { key: 'wiper', label: 'ワイパー' },
      { key: 'tire', label: 'タイヤ' },
      { key: 'body', label: 'ボディ' },
      { key: 'mirror', label: 'ミラー全般' },
    ],
  },
  {
    key: 'worker',
    title: '作業者',
    items: [
      { key: 'health', label: '健康状態' },
      { key: 'attendance', label: '出勤時間' },
      { key: 'license', label: '免許証' },
      { key: 'attire', label: '服装' },
    ],
  },
  {
    key: 'posting',
    title: 'その他（掲出チェック）',
    items: [
      { key: 'sticker', label: 'ステッカー', hint: '所定の位置に掲出' },
      { key: 'vehicle_cert', label: '登録車両証', hint: '所定の位置に掲出' },
    ],
  },
]

export const ALL_CHECK_ITEMS: CheckItem[] = CHECK_GROUPS.flatMap(g => g.items)
export const VALID_CHECK_KEYS = new Set(ALL_CHECK_ITEMS.map(i => i.key))

export const SHIFT_TYPES = [
  { value: 'normal', label: '通常' },
  { value: 'early', label: '早朝（持ち去り防止）' },
] as const
export type ShiftType = typeof SHIFT_TYPES[number]['value']

export type CheckResult = 'ok' | 'ng'
export type CheckEntry = { result: CheckResult; action?: string }
export type Checks = Record<string, CheckEntry>

// 点呼。boolean は「有／無」「使用／不使用」を true/false で持ち、未回答は null
export type RollCall = {
  caller: string
  faceToFace: boolean | null       // 点呼（対面）有 = true
  alcoholDeviceUsed: boolean | null // アルコール検知器 使用 = true
  drunk: boolean | null            // 酒気帯び 有 = true（本来は false であるべき）
  unwell: boolean | null           // 疾病・疲労・睡眠不足など 有 = true（本来は false であるべき）
  note: string
  at?: string                      // 記録時刻（ISO）。サーバー側で付与する
}

export function emptyRollCall(): RollCall {
  return { caller: '', faceToFace: null, alcoholDeviceUsed: null, drunk: null, unwell: null, note: '' }
}

export function isRollCallAnswered(rc: RollCall | null | undefined): boolean {
  return !!rc && rc.faceToFace !== null && rc.alcoholDeviceUsed !== null && rc.drunk !== null && rc.unwell !== null
}

// 点呼で要確認の状態（検知器未使用・対面なし・酒気帯び有・体調不良有）
export function rollCallAlerts(rc: RollCall | null | undefined): string[] {
  if (!rc) return []
  const alerts: string[] = []
  if (rc.faceToFace === false) alerts.push('対面点呼なし')
  if (rc.alcoholDeviceUsed === false) alerts.push('検知器未使用')
  if (rc.drunk === true) alerts.push('酒気帯びあり')
  if (rc.unwell === true) alerts.push('疾病・疲労・睡眠不足あり')
  return alerts
}

export function summarizeInspection(input: { checks: unknown; startRollCall: unknown; endRollCall: unknown }) {
  const checks = (input.checks ?? {}) as Checks
  const startRollCall = (input.startRollCall ?? null) as RollCall | null
  const endRollCall = (input.endRollCall ?? null) as RollCall | null

  const total = ALL_CHECK_ITEMS.length
  const answered = ALL_CHECK_ITEMS.filter(i => checks[i.key]?.result).length
  const ngItems = ALL_CHECK_ITEMS.filter(i => checks[i.key]?.result === 'ng')

  return {
    total,
    answered,
    ngItems,
    checksDone: answered === total,
    startDone: isRollCallAnswered(startRollCall),
    endDone: isRollCallAnswered(endRollCall),
    alerts: [...rollCallAlerts(startRollCall), ...rollCallAlerts(endRollCall)],
  }
}
