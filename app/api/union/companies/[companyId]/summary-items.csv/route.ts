import { db } from '@/db/client'
import { companies, monthlySummaryItems, wasteTypes } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import { wasteTypeLabel } from '@/lib/wasteTypes'

export async function GET(request: Request, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params
  const [company] = await db.select().from(companies).where(eq(companies.id, companyId))
  if (!company) return Response.json({ error: 'not found' }, { status: 404 })

  const rows = await db.select({
    yearMonth: monthlySummaryItems.yearMonth,
    totalWeightKg: monthlySummaryItems.totalWeightKg,
    totalAmount: monthlySummaryItems.totalAmount,
    wasteTypeId: monthlySummaryItems.wasteTypeId,
  })
    .from(monthlySummaryItems)
    .where(eq(monthlySummaryItems.companyId, companyId))
    .orderBy(desc(monthlySummaryItems.yearMonth))

  const typeById = new Map((await db.select().from(wasteTypes).where(eq(wasteTypes.companyId, companyId))).map(w => [w.id, w]))
  const header = ['year_month', 'waste_type', 'total_weight_kg', 'total_amount']
  const lines = [header.join(',')]
  for (const r of rows) {
    lines.push([r.yearMonth, `"${wasteTypeLabel(r.wasteTypeId, typeById).replace(/"/g, '""')}"`, r.totalWeightKg, r.totalAmount].join(','))
  }
  const csv = '﻿' + lines.join('\r\n')

  const encodedName = encodeURIComponent(`${company.name}_品目別内訳.csv`)
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="summary-items.csv"; filename*=UTF-8''${encodedName}`,
    },
  })
}
