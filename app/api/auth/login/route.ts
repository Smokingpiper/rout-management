import { db } from '@/db/client'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { verifyPassword, createSession } from '@/lib/auth'

export async function POST(request: Request) {
  const { email, password } = await request.json() as { email?: string; password?: string }
  if (!email || !password) {
    return Response.json({ error: 'メールアドレスとパスワードを入力してください' }, { status: 400 })
  }

  const [user] = await db.select().from(users).where(eq(users.email, email))
  if (!user || !user.passwordHash) {
    return Response.json({ error: 'メールアドレスまたはパスワードが正しくありません' }, { status: 401 })
  }

  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) {
    return Response.json({ error: 'メールアドレスまたはパスワードが正しくありません' }, { status: 401 })
  }

  await createSession(user.id)
  return Response.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
  })
}
