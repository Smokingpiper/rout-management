import { db } from '@/db/client'
import { wasteTypePrices } from '@/db/schema'

export async function POST(request: Request) {
  const body = await request.json() as { wasteTypeId?: string; unitPrice?: number; effectiveFrom?: string }
  const { wasteTypeId, unitPrice, effectiveFrom } = body
  if (!wasteTypeId || unitPrice == null || !effectiveFrom) {
    return Response.json({ error: 'wasteTypeId, unitPrice, effectiveFrom are required' }, { status: 400 })
  }
  const [price] = await db.insert(wasteTypePrices).values({ wasteTypeId, unitPrice, effectiveFrom }).returning()
  return Response.json(price)
}
