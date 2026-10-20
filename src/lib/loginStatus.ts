// 招待したユーザーが「初期ログイン（一時パスワードの変更）」まで済ませたかの判定。
// DBに最終ログイン列は持たず、users.mustChangePassword と sessions の有無から導く。
//   done     : 一時パスワードを自分のものに変更済み＝初期ログイン完了
//   changing : ログインはしたが、まだ一時パスワードのまま（変更画面で止まっている）
//   none     : まだ一度もログインしていない（ログアウト済みの場合も含む）
import { db } from '@/db/client'
import { sessions } from '@/db/schema'
import { max } from 'drizzle-orm'
import { inArray } from 'drizzle-orm'

export type LoginState = 'done' | 'changing' | 'none'

export type LoginStatus = { state: LoginState; lastLoginAt: Date | null }

export const LOGIN_STATE_LABEL: Record<LoginState, string> = {
  done: '初期ログイン完了',
  changing: 'PW未変更',
  none: '未ログイン',
}

export const LOGIN_STATE_HINT: Record<LoginState, string> = {
  done: '一時パスワードを変更済みです。',
  changing: 'ログインはしましたが、一時パスワードのままです。パスワード変更画面で止まっている可能性があります。',
  none: 'まだログインしていません（ログアウト済みの場合も含みます）。一時パスワードをお伝えできているか確認してください。',
}

export const LOGIN_STATE_PILL: Record<LoginState, string> = { done: 'ok', changing: 'warn', none: 'danger' }

export async function getLoginStatuses(
  list: { id: string; mustChangePassword: boolean }[],
): Promise<Map<string, LoginStatus>> {
  const latest = list.length
    ? await db
        .select({ userId: sessions.userId, at: max(sessions.createdAt) })
        .from(sessions)
        .where(inArray(sessions.userId, list.map(u => u.id)))
        .groupBy(sessions.userId)
    : []
  const lastById = new Map(latest.map(r => [r.userId, r.at]))
  return new Map(
    list.map(u => {
      const lastLoginAt = lastById.get(u.id) ?? null
      const state: LoginState = !u.mustChangePassword ? 'done' : lastLoginAt ? 'changing' : 'none'
      return [u.id, { state, lastLoginAt }]
    }),
  )
}
