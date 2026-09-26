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

// 日本時間の「今日」の曜日を0(日)〜6(土)で返す（user_routes.daysOfWeekと同じ規則）。
// YYYY-MM-DDをUTC正午として解釈しgetUTCDay()を取ることで、実行環境のタイムゾーンに関係なく
// そのカレンダー日の曜日を正しく求められる（日付そのものは既にJST基準でtodayStr()が確定させている）。
export function todayDayOfWeek(): number {
  return new Date(`${todayStr()}T12:00:00Z`).getUTCDay()
}
