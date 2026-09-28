import { db } from '@/db/client'
import { dailyReports } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { r2Configured, uploadPhoto } from '@/lib/r2'
import sharp from 'sharp'

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

  const original = Buffer.from(await file.arrayBuffer())

  // 長期保存前提のため容量を抑えたい。AVIF変換に失敗した場合（未対応形式等）は
  // 元ファイルのままアップロードする（写真の保存自体を失敗させたくないため）
  let buffer = original
  let contentType = file.type || 'application/octet-stream'
  let ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  try {
    buffer = await sharp(original).rotate().avif({ quality: 65 }).toBuffer()
    contentType = 'image/avif'
    ext = 'avif'
  } catch (err) {
    console.error('AVIF変換に失敗、元ファイルのまま保存します', err)
  }

  const key = `daily-reports/${dailyReportId}/${type}-${Date.now()}.${ext}`

  await uploadPhoto(key, buffer, contentType)

  const column = type === 'report' ? { reportPhotoUrl: key } : { receiptPhotoUrl: key }
  const [updated] = await db.update(dailyReports).set(column).where(eq(dailyReports.id, dailyReportId)).returning()
  if (!updated) return Response.json({ error: 'daily report not found' }, { status: 404 })

  return Response.json({ key, type })
}
