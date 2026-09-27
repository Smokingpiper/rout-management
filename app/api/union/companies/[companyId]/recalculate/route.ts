import { db } from '@/db/client'
import { companies } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getPrimaryUnion } from '@/lib/union'
import { recalculateMonth, recalculateAllMonths } from '@/lib/monthlyCalc'

export async function POST(request: Request, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params
  const [company] = await db.select().from(companies).where(eq(companies.id, companyId))
  if (!company) return Response.json({ error: 'not found' }, { status: 404 })

  const union = await getPrimaryUnion()
  if (!union) return Response.json({ error: 'union not found' }, { status: 400 })

  const body = await request.json().catch(() => ({})) as { yearMonth?: string }

  if (body.yearMonth) {
    const result = await recalculateMonth(union.id, companyId, body.yearMonth)
    return Response.json({ results: [{ yearMonth: body.yearMonth, ...result }] })
  }

  const results = await recalculateAllMonths(union.id, companyId)
  return Response.json({ results })
}
