import { db } from '@/db/client'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'

const VALID_ROLES = ['driver', 'company_admin'] as const
const VALID_RANKS = ['manager', 'chief'] as const

export async function PATCH(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params
  const { roles, adminRank, sealName } = await request.json() as {
    roles?: string[]
    adminRank?: string | null
    sealName?: string | null
  }

  if (!Array.isArray(roles) || roles.length === 0) {
    return Response.json({ error: 'roles must be a non-empty array' }, { status: 400 })
  }
  const resolvedRoles = roles.filter(r => VALID_ROLES.includes(r as any))
  if (resolvedRoles.length === 0) {
    return Response.json({ error: '有効なロールがありません' }, { status: 400 })
  }

  // ランク（課長/係長）は会社管理者にだけ意味がある。会社管理者でなくなる場合は外す
  const resolvedRank = resolvedRoles.includes('company_admin') && VALID_RANKS.includes(adminRank as any)
    ? (adminRank as typeof VALID_RANKS[number])
    : null
  const resolvedSeal = (sealName ?? '').trim().slice(0, 4) || null

  const [user] = await db.update(users)
    .set({ roles: resolvedRoles, adminRank: resolvedRank, sealName: resolvedSeal })
    .where(eq(users.id, userId))
    .returning()
  if (!user) return Response.json({ error: 'user not found' }, { status: 404 })

  return Response.json({ id: user.id, roles: user.roles, adminRank: user.adminRank, sealName: user.sealName })
}
