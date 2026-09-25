import { db } from '@/db/client'
import { dailyReports } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { r2Configured, presignPhotoUrl } from '@/lib/r2'

export async function GET(request: Request, { params }: { params: Promise<{ dailyReportId: string }> }) {
  const { dailyReportId } = await params
  const [report] = await db.select().from(dailyReports).where(eq(dailyReports.id, dailyReportId))
  if (!report) return Response.json({ error: 'not found' }, { status: 404 })

  if (!r2Configured()) {
    return Response.json({ reportPhotoUrl: null, receiptPhotoUrl: null, configured: false })
  }

  const [reportPhotoUrl, receiptPhotoUrl] = await Promise.all([
    report.reportPhotoUrl ? presignPhotoUrl(report.reportPhotoUrl) : Promise.resolve(null),
    report.receiptPhotoUrl ? presignPhotoUrl(report.receiptPhotoUrl) : Promise.resolve(null),
  ])

  return Response.json({ reportPhotoUrl, receiptPhotoUrl, configured: true })
}
