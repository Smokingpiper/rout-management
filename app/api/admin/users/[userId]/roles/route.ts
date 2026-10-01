import { db } from '@/db/client'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'

const VALID_ROLES = ['driver', 'company_admin'] as const

export async function PATCH(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params
  const { roles } = await request.json() as { roles?: string[] }

  if (!Array.isArray(roles) || roles.length === 0) {
    return Response.json({ error: 'roles must be a non-empty array' }, { status: 400 })
  }
  const resolvedRoles = roles.filter(r => VALID_ROLES.includes(r as any))
  if (resolvedRoles.length === 0) {
    return Response.json({ error: '有効なロールがありません' }, { status: 400 })
  }

  const [user] = await db.update(users).set({ roles: resolvedRoles }).where(eq(users.id, userId)).returning()
  if (!user) return Response.json({ error: 'user not found' }, { status: 404 })

  return Response.json({ id: user.id, roles: user.roles })
}
