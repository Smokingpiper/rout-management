import { db } from '@/db/client'
import { users, routes, areas, userRoutes } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { getPrimaryCompany } from '@/lib/company'
import ScheduleForm from './ScheduleForm'

export const dynamic = 'force-dynamic'

export default async function UserSchedulePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params
  const [user] = await db.select().from(users).where(eq(users.id, userId))
  if (!user) notFound()

  const company = await getPrimaryCompany()
  const areaList = company ? await db.select().from(areas).where(eq(areas.companyId, company.id)) : []
  const areaIds = areaList.map(a => a.id)
  const areaById = new Map(areaList.map(a => [a.id, a]))

  const routeList = areaIds.length
    ? (await db.select().from(routes)).filter(r => areaIds.includes(r.areaId))
    : []

  const existing = await db.select().from(userRoutes).where(eq(userRoutes.userId, userId))
  const daysByRoute = new Map(existing.map(ur => [ur.routeId, ur.daysOfWeek as number[]]))

  const routesForForm = routeList
    .map(r => ({
      id: r.id,
      name: r.name,
      areaName: areaById.get(r.areaId)?.name ?? '',
      daysOfWeek: daysByRoute.get(r.id) ?? [],
    }))
    .sort((a, b) => (a.areaName + a.name).localeCompare(b.areaName + b.name, 'ja'))

  return (
    <>
      <div className="breadcrumb"><a href="/admin/users">ユーザー招待管理</a> / スケジュール設定</div>
      <div className="page-title">{user.name || user.email} のスケジュール設定</div>
      <div className="page-desc">曜日ごとに担当するルートにチェックを入れてください。同じ曜日に複数のルートを担当することもできます。</div>

      <ScheduleForm userId={userId} routes={routesForForm} />
    </>
  )
}
