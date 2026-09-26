import { db } from '@/db/client'
import { routes, spots } from '@/db/schema'
import { eq } from 'drizzle-orm'

// 診断専用（読み取りのみ）。正常な住所は必ず「日本、〒」で始まる形式のため、
// それに一致しないスポットを一覧化して、備考が誤って住所欄に入っている実例を確認する。
function checkToken(request: Request) {
  const expected = process.env.IMPORT_ADMIN_TOKEN
  if (!expected) return false
  return request.headers.get('x-import-token') === expected
}

export async function GET(request: Request) {
  if (!checkToken(request)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const allSpots = await db.select().from(spots)
  const allRoutes = await db.select().from(routes)
  const routeNameById = new Map(allRoutes.map(r => [r.id, r.name]))

  const anomalous = allSpots
    .filter(s => !s.address || !s.address.startsWith('日本、'))
    .map(s => ({
      routeName: routeNameById.get(s.routeId),
      no: s.orderInRoute,
      address: s.address,
    }))

  return Response.json({ total: allSpots.length, anomalousCount: anomalous.length, anomalous })
}
