import { db } from '@/db/client'
import { dailyReports } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth'

type Action = 'chief_stamp' | 'chief_unstamp' | 'approve' | 'return'

// 押印・承認の操作。権限（ランク）はクライアントを信用せずここで判定する。
//  - 係長（rank=chief）: 係長欄の押印／取り消し、未承認日報の差し戻し。課長欄の押印（承認）はできない
//  - 課長（rank=manager）・ランク未設定の管理者: 課長欄の押印＝承認、承認の取り消し（差し戻し）、係長欄の押印の取り消し
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return Response.json({ error: 'ログインが必要です' }, { status: 401 })
  // 押印・承認は管理者の操作。ドライバーのロールだけのユーザーがAPIを直接叩いても通さない
  const roles = (user.roles as string[]) ?? []
  if (!roles.includes('company_admin') && !roles.includes('union_admin')) {
    return Response.json({ error: '押印・承認には会社管理者のロールが必要です（ユーザー管理でロールを確認してください）' }, { status: 403 })
  }

  const { id } = await params
  const { action } = await request.json() as { action?: Action }
  if (!action) return Response.json({ error: 'action is required' }, { status: 400 })

  const [report] = await db.select().from(dailyReports).where(eq(dailyReports.id, id))
  if (!report) return Response.json({ error: 'not found' }, { status: 404 })

  const isChief = user.adminRank === 'chief'
  const patch: Partial<typeof dailyReports.$inferInsert> = {}

  switch (action) {
    case 'chief_stamp':
      if (!isChief) return Response.json({ error: '係長ランクのユーザーだけが係長欄に押印できます' }, { status: 403 })
      if (report.status !== 'pending_approval') return Response.json({ error: '承認待ちの日報にだけ押印できます' }, { status: 400 })
      patch.chiefStampedBy = user.id
      patch.chiefStampedAt = new Date()
      break

    case 'chief_unstamp':
      if (report.status === 'approved') return Response.json({ error: '承認済みの日報です。先に承認を取り消してください' }, { status: 400 })
      if (isChief && report.chiefStampedBy !== user.id) return Response.json({ error: '他の人の押印は取り消せません' }, { status: 403 })
      patch.chiefStampedBy = null
      patch.chiefStampedAt = null
      break

    case 'approve':
      if (isChief) return Response.json({ error: '課長（またはランク未設定の管理者）だけが承認できます' }, { status: 403 })
      if (report.status === 'approved') return Response.json({ error: 'すでに承認済みです' }, { status: 400 })
      patch.status = 'approved'
      patch.approvedBy = user.id
      patch.approvedAt = new Date()
      break

    case 'return':
      if (isChief && report.status === 'approved') {
        return Response.json({ error: '承認済みの日報を取り消せるのは課長（またはランク未設定の管理者）だけです' }, { status: 403 })
      }
      // 差し戻すと日報は修正・再提出されるため、承認・係長の押印はいったんすべて外す
      patch.status = 'in_progress'
      patch.approvedBy = null
      patch.approvedAt = null
      patch.chiefStampedBy = null
      patch.chiefStampedAt = null
      break

    default:
      return Response.json({ error: 'unknown action' }, { status: 400 })
  }

  const [updated] = await db.update(dailyReports).set(patch).where(eq(dailyReports.id, id)).returning()
  return Response.json(updated)
}
