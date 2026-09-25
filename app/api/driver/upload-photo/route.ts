import { db } from '@/db/client'
import { dailyReports } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { r2Configured, uploadPhoto } from '@/lib/r2'

const MAX_SIZE = 15 * 1024 * 1024 // 15MB

export async function POST(request: Request) {
  if (!r2Configured()) {
    return Response.json({ error: '写真ストレージが未設定です（R2の環境変数が未登録）' }, { status: 503 })
  }

  const form = await request.formData()
  const file = form.get('file')
  const dailyReportId = form.get('dailyReportId')
  const type = form.get('type') // 'report' | 'receipt'

  if (!(file instanceof File) || typeof dailyReportId !== 'string' || (type !== 'report' && type !== 'receipt')) {
    return Response.json({ error: 'file, dailyReportId, type(report|receipt) are required' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return Response.json({ error: 'ファイルサイズが大きすぎます（15MBまで）' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const key = `daily-reports/${dailyReportId}/${type}-${Date.now()}.${ext}`

  await uploadPhoto(key, buffer, file.type || 'application/octet-stream')

  const column = type === 'report' ? { reportPhotoUrl: key } : { receiptPhotoUrl: key }
  const [updated] = await db.update(dailyReports).set(column).where(eq(dailyReports.id, dailyReportId)).returning()
  if (!updated) return Response.json({ error: 'daily report not found' }, { status: 404 })

  return Response.json({ key, type })
}
