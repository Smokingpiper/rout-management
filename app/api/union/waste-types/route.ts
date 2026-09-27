import { db } from '@/db/client'
import { wasteTypes } from '@/db/schema'

export async function POST(request: Request) {
  const body = await request.json() as { companyId?: string; name?: string }
  const { companyId, name } = body
  if (!companyId || !name) {
    return Response.json({ error: 'companyId, name are required' }, { status: 400 })
  }
  const [wasteType] = await db.insert(wasteTypes).values({ companyId, name }).returning()
  return Response.json(wasteType)
}
