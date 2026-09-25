// Vercelのサーバーは既定でUTCタイムゾーンで動くため、new Date()のgetFullYear()等をそのまま使うと
// 「今日」の日付境界が日本時間から最大9時間ずれる（例: 日本時間0:00〜8:59はまだ前日のまま扱われる）。
// 日報の日付は必ず日本時間基準にする。
const JST_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export function todayStr(): string {
  return JST_FORMATTER.format(new Date()) // en-CA ロケールは YYYY-MM-DD 形式
}
