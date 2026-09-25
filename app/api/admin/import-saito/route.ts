import { db } from '@/db/client'
import { unions, companies, areas, routes, spots, spotNotes, wasteTypes } from '@/db/schema'
import { and, eq, sql } from 'drizzle-orm'

// 斉藤商店の実データ取り込み専用の一時的な管理APIです。
// Basic認証とは別に IMPORT_ADMIN_TOKEN を要求し、Basic認証を知っているだけの
// レビュアーには使わせない。取り込み完了後は削除する想定。
function checkToken(request: Request) {
  const expected = process.env.IMPORT_ADMIN_TOKEN
  if (!expected) return false
  const got = request.headers.get('x-import-token')
  return got === expected
}

type SpotInput = { no: number; lat: number; lng: number; address: string | null; note: string | null }

export async function POST(request: Request) {
  if (!checkToken(request)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = await request.json() as {
    unionName: string
    companyName: string
    areaName: string
    wasteTypeName: string
    routeName: string
    spotList: SpotInput[]
  }
  const { unionName, companyName, areaName, wasteTypeName, routeName, spotList } = body

  let [union] = await db.select().from(unions).where(eq(unions.name, unionName))
  if (!union) [union] = await db.insert(unions).values({ name: unionName }).returning()

  let [company] = await db.select().from(companies).where(and(eq(companies.name, companyName), eq(companies.unionId, union.id)))
  if (!company) [company] = await db.insert(companies).values({ unionId: union.id, name: companyName }).returning()

  let [area] = await db.select().from(areas).where(and(eq(areas.name, areaName), eq(areas.companyId, company.id)))
  if (!area) [area] = await db.insert(areas).values({ companyId: company.id, name: areaName }).returning()

  let [wasteType] = await db.select().from(wasteTypes).where(and(eq(wasteTypes.name, wasteTypeName), eq(wasteTypes.companyId, company.id)))
  if (!wasteType) [wasteType] = await db.insert(wasteTypes).values({ companyId: company.id, name: wasteTypeName }).returning()

  const [existingRoute] = await db.select().from(routes).where(and(eq(routes.name, routeName), eq(routes.areaId, area.id)))
  if (existingRoute) {
    return Response.json({ skipped: true, reason: 'route already exists', routeId: existingRoute.id })
  }

  const [route] = await db.insert(routes).values({
    areaId: area.id,
    name: routeName,
    defaultWasteTypeId: wasteType.id,
  }).returning()

  const spotRows: (typeof spots.$inferInsert)[] = []
  const noteRows: { spotId: string; note: string }[] = []
  for (const s of spotList) {
    const spotId = crypto.randomUUID()
    spotRows.push({
      id: spotId,
      routeId: route.id,
      name: null,
      address: s.address,
      latitude: s.lat,
      longitude: s.lng,
      isAlertSpot: false,
      orderInRoute: s.no,
    })
    if (s.note) noteRows.push({ spotId, note: s.note })
  }

  const CHUNK = 300
  for (let i = 0; i < spotRows.length; i += CHUNK) {
    await db.insert(spots).values(spotRows.slice(i, i + CHUNK))
  }
  for (let i = 0; i < noteRows.length; i += CHUNK) {
    await db.insert(spotNotes).values(noteRows.slice(i, i + CHUNK))
  }

  return Response.json({
    unionId: union.id,
    companyId: company.id,
    areaId: area.id,
    wasteTypeId: wasteType.id,
    routeId: route.id,
    spotsInserted: spotRows.length,
    notesInserted: noteRows.length,
  })
}

async function countOf(table: any) {
  const [row] = await db.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(table)
  return row.n
}

export async function GET(request: Request) {
  if (!checkToken(request)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }
  const [unionsN, companiesN, areasN, routesN, spotsN, notesN, wasteTypesN] = await Promise.all([
    countOf(unions), countOf(companies), countOf(areas), countOf(routes),
    countOf(spots), countOf(spotNotes), countOf(wasteTypes),
  ])
  return Response.json({
    unions: unionsN, companies: companiesN, areas: areasN, routes: routesN,
    spots: spotsN, spot_notes: notesN, waste_types: wasteTypesN,
  })
}
