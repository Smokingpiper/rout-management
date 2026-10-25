import { db } from '@/db/client'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getAdminUser } from '@/lib/adminAuth'

// 連絡先（電話番号）の登録。巡回状況の画面から、周回漏れの恐れがあるときに電話をかけるために使う
export async function PATCH(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const admin = await getAdminUser()
  if (!admin) return Response.json({ error: '管理者のみ実行できます' }, { status: 403 })
  const { userId } = await params
  const body = await request.json() as { phoneNumber?: string | null }

  const raw = (body.phoneNumber ?? '').trim()
  // 数字・ハイフン・括弧・スペース・先頭の+だけを許す（tel:リンクに使うため）
  if (raw && !/^\+?[0-9\-() ]{6,20}$/.test(raw)) {
    return Response.json({ error: '電話番号は数字とハイフンで入力してください（例：090-1234-5678）' }, { status: 400 })
  }

  const [target] = await db.select().from(users).where(eq(users.id, userId))
  if (!target) return Response.json({ error: 'ユーザーが見つかりません' }, { status: 404 })
  if (admin.companyId && target.companyId !== admin.companyId) {
    return Response.json({ error: '他社のユーザーは操作できません' }, { status: 403 })
  }

  const [updated] = await db.update(users).set({ phoneNumber: raw || null }).where(eq(users.id, userId)).returning()
  return Response.json({ phoneNumber: updated.phoneNumber })
}
