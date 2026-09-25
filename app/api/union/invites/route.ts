import { db } from '@/db/client'
import { allowedEmails } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function POST(request: Request) {
  const body = await request.json() as {
    unionId?: string
    email?: string
    invitedRole?: 'union_admin' | 'company_admin' | 'driver'
    companyId?: string | null
  }
  const { unionId, email, invitedRole, companyId } = body
  if (!unionId || !email || !invitedRole) {
    return Response.json({ error: 'unionId, email, invitedRole are required' }, { status: 400 })
  }

  const [existing] = await db.select().from(allowedEmails).where(eq(allowedEmails.email, email))
  if (existing) {
    return Response.json({ error: 'duplicate' }, { status: 409 })
  }

  const [invite] = await db.insert(allowedEmails).values({
    unionId,
    email,
    invitedRole,
    companyId: companyId ?? null,
    status: 'invited',
  }).returning()
  return Response.json(invite)
}
