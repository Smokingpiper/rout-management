import { db } from '@/db/client'
import { routes, spots, spotNotes } from '@/db/schema'
import { and, eq } from 'drizzle-orm'

function checkToken(request: Request) {
  const expected = process.env.IMPORT_ADMIN_TOKEN
  if (!expected) return false
  return request.headers.get('x-import-token') === expected
}

export async function GET(request: Request) {
  if (!checkToken(request)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }
  const url = new URL(request.url)
  const routeName = url.searchParams.get('routeName')
  const no = Number(url.searchParams.get('no'))
  if (!routeName || !no) return Response.json({ error: 'routeName and no required' }, { status: 400 })

  const [route] = await db.select().from(routes).where(eq(routes.name, routeName))
  if (!route) return Response.json({ error: 'route not found' }, { status: 404 })

  const [spot] = await db.select().from(spots).where(and(eq(spots.routeId, route.id), eq(spots.orderInRoute, no)))
  if (!spot) return Response.json({ error: 'spot not found' }, { status: 404 })

  const notes = await db.select().from(spotNotes).where(eq(spotNotes.spotId, spot.id))
  return Response.json({ spot, notes })
}
