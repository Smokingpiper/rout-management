import { db } from '@/db/client'
import { companies, paymentAllocations } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'

export async function GET(request: Request, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params
  const [company] = await db.select().from(companies).where(eq(companies.id, companyId))
  if (!company) return Response.json({ error: 'not found' }, { status: 404 })

  const rows = await db.select().from(paymentAllocations).where(eq(paymentAllocations.companyId, companyId)).orderBy(desc(paymentAllocations.yearMonth))

  const header = ['year_month', 'gross_amount', 'fee_amount', 'allocated_amount']
  const lines = [header.join(',')]
  for (const r of rows) {
    lines.push([r.yearMonth, r.grossAmount, r.feeAmount, r.allocatedAmount].join(','))
  }
  const csv = '﻿' + lines.join('\r\n')

  // ファイル名に日本語が入るため、ヘッダー値はASCIIのfilenameとRFC 5987のfilename*を併記する
  const encodedName = encodeURIComponent(`${company.name}_allocations.csv`)
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="allocations.csv"; filename*=UTF-8''${encodedName}`,
    },
  })
}
