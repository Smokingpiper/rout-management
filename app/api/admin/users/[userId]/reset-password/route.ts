import { db } from '@/db/client'
import { users, sessions } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { generateDefaultPassword, getCurrentUser, hashPassword } from '@/lib/auth'

// 初期（一時）パスワードの再発行。新しい一時パスワードを返す（この応答でしか確認できない）。
// 本人は次回ログイン時にパスワード変更を求められ、いま持っているログインは無効になる。
export async function POST(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const me = await getCurrentUser()
  if (!me) return Response.json({ error: 'ログインが必要です' }, { status: 401 })
  if (!(me.roles as string[] | null)?.includes('company_admin')) {
    return Response.json({ error: '会社管理者のみ実行できます' }, { status: 403 })
  }

  const { userId } = await params
  if (userId === me.id) {
    return Response.json({ error: '自分自身のパスワードは「パスワード変更」から変更してください' }, { status: 400 })
  }

  const [target] = await db.select().from(users).where(eq(users.id, userId))
  if (!target) return Response.json({ error: 'ユーザーが見つかりません' }, { status: 404 })
  if (me.companyId && target.companyId !== me.companyId) {
    return Response.json({ error: '他社のユーザーは操作できません' }, { status: 403 })
  }

  const temporaryPassword = generateDefaultPassword()
  const passwordHash = await hashPassword(temporaryPassword)
  await db.update(users).set({ passwordHash, mustChangePassword: true }).where(eq(users.id, userId))
  // 旧パスワードでログイン中の端末を締め出す
  await db.delete(sessions).where(eq(sessions.userId, userId))

  return Response.json({ email: target.email, name: target.name, temporaryPassword })
}
