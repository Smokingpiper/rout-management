import { db } from '@/db/client'
import { companies } from '@/db/schema'

export async function POST(request: Request) {
  const body = await request.json() as { unionId?: string; name?: string; wasteCategory?: string | null; monthlyFee?: number | null }
  const { unionId, name, wasteCategory, monthlyFee } = body
  if (!unionId || !name) {
    return Response.json({ error: 'unionId and name are required' }, { status: 400 })
  }
  const [company] = await db.insert(companies).values({
    unionId,
    name,
    wasteCategory: wasteCategory ?? null,
    monthlyFee: monthlyFee ?? null,
  }).returning()
  return Response.json(company)
}
