import { db } from '@/db/client'
import { feeRules } from '@/db/schema'

export async function POST(request: Request) {
  const body = await request.json() as {
    unionId?: string
    companyId?: string | null
    feeType?: 'rate_percent' | 'fixed_amount'
    feeValue?: number
    effectiveFrom?: string
  }
  const { unionId, companyId, feeType, feeValue, effectiveFrom } = body
  if (!unionId || !feeType || feeValue == null || !effectiveFrom) {
    return Response.json({ error: 'unionId, feeType, feeValue, effectiveFrom are required' }, { status: 400 })
  }
  const [rule] = await db.insert(feeRules).values({
    unionId,
    companyId: companyId ?? null,
    feeType,
    feeValue,
    effectiveFrom,
  }).returning()
  return Response.json(rule)
}
