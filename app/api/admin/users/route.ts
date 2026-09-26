import { db } from '@/db/client'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { generateDefaultPassword, hashPassword } from '@/lib/auth'
import { getPrimaryCompany } from '@/lib/company'

const VALID_ROLES = ['driver', 'company_admin'] as const

export async function POST(request: Request) {
  const { email, name, role } = await request.json() as { email?: string; name?: string; role?: string }
  if (!email) return Response.json({ error: 'メールアドレスを入力してください' }, { status: 400 })
  const resolvedRole = VALID_ROLES.includes(role as any) ? (role as typeof VALID_ROLES[number]) : 'driver'

  const [existing] = await db.select().from(users).where(eq(users.email, email))
  if (existing) return Response.json({ error: 'このメールアドレスは既に登録されています' }, { status: 409 })

  const company = await getPrimaryCompany()
  const temporaryPassword = generateDefaultPassword()
  const passwordHash = await hashPassword(temporaryPassword)

  const [user] = await db.insert(users).values({
    email,
    name: name || null,
    role: resolvedRole,
    companyId: company?.id ?? null,
    unionId: company?.unionId ?? null,
    passwordHash,
    mustChangePassword: true,
  }).returning()

  return Response.json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    temporaryPassword,
  })
}
