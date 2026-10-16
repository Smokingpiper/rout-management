import { db } from '@/db/client'
import { dailyReports, routes, areas, users } from '@/db/schema'
import { and, desc, eq, gte, lte } from 'drizzle-orm'

export type ReportFilters = { q: string; from: string; to: string; status: string; type: string; id?: string }

const VALID_STATUS = new Set(['in_progress', 'pending_approval', 'approved'])
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// 日報一覧と一括印刷で共通の絞り込み（期間・状態・区分はSQL、キーワードは取得後に判定）
export async function queryReportList(filters: ReportFilters, limit: number) {
  const conditions = []
  if (filters.id) conditions.push(eq(dailyReports.id, filters.id))
  if (DATE_RE.test(filters.from)) conditions.push(gte(dailyReports.reportDate, filters.from))
  if (DATE_RE.test(filters.to)) conditions.push(lte(dailyReports.reportDate, filters.to))
  if (VALID_STATUS.has(filters.status)) conditions.push(eq(dailyReports.status, filters.status as 'in_progress' | 'pending_approval' | 'approved'))
  if (filters.type === 'regular' || filters.type === 'early') conditions.push(eq(dailyReports.collectionType, filters.type))

  let reportList = await db
    .select()
    .from(dailyReports)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(dailyReports.reportDate), desc(dailyReports.id))
    .limit(limit)

  const routeList = await db.select().from(routes)
  const routeById = new Map(routeList.map(r => [r.id, r]))
  const areaList = await db.select().from(areas)
  const areaById = new Map(areaList.map(a => [a.id, a]))
  const userList = await db.select().from(users)
  const userById = new Map(userList.map(u => [u.id, u]))

  if (filters.q) {
    const q = filters.q
    reportList = reportList.filter(r => {
      if (r.collectionType === 'early' && '早朝回収'.includes(q)) return true
      const route = r.routeId ? routeById.get(r.routeId) : null
      const submitter = r.submittedBy ? userById.get(r.submittedBy) : null
      return (
        (route?.name ?? '').includes(q) ||
        (route ? (areaById.get(route.areaId)?.name ?? '') : '').includes(q) ||
        (submitter?.name ?? '').includes(q) ||
        (submitter?.email ?? '').includes(q)
      )
    })
  }

  return { reportList, routeById, areaById, userById }
}
