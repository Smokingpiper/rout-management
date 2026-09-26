import { db } from '@/db/client'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getCurrentUser, hashPassword, verifyPassword } from '@/lib/auth'

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return Response.json({ error: 'ログインが必要です' }, { status: 401 })

  const { currentPassword, newPassword } = await request.json() as { currentPassword?: string; newPassword?: string }
  if (!newPassword || newPassword.length < 8) {
    return Response.json({ error: '新しいパスワードは8文字以上にしてください' }, { status: 400 })
  }

  // 初回ログイン直後（招待時の一時パスワードのまま）は、ログイン済みであること自体を本人確認とし、
  // 現在のパスワードの再入力は求めない。それ以外の通常の変更では現在のパスワードの確認を必須にする。
  if (!user.mustChangePassword) {
    const valid = currentPassword && user.passwordHash
      ? await verifyPassword(currentPassword, user.passwordHash)
      : false
    if (!valid) return Response.json({ error: '現在のパスワードが正しくありません' }, { status: 401 })
  }

  const newHash = await hashPassword(newPassword)
  await db.update(users).set({ passwordHash: newHash, mustChangePassword: false }).where(eq(users.id, user.id))
  return Response.json({ ok: true })
}
