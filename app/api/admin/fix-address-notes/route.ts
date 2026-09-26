import { db } from '@/db/client'
import { routes, spots, spotNotes } from '@/db/schema'
import { and, eq } from 'drizzle-orm'

// 一時的な移行API。備考の編集欄が無かった間、住所欄に備考を書き足して運用してしまったケースを
// 「元Excelの正しい住所（ベースライン）」との単純な前方一致差分でしか自動修正しない。
// 一致しない（住所そのものを打ち直した等）ケースは自動変更せず needsReview として報告するだけに留める。
function checkToken(request: Request) {
  const expected = process.env.IMPORT_ADMIN_TOKEN
  if (!expected) return false
  return request.headers.get('x-import-token') === expected
}

function stripLeadingSeparators(s: string) {
  return s.replace(/^[\s、,，・\/\-–—:：]+/, '').trim()
}

export async function POST(request: Request) {
  if (!checkToken(request)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = await request.json() as {
    routeName: string
    entries: { no: number; baselineAddress: string | null }[]
  }
  const { routeName, entries } = body

  const [route] = await db.select().from(routes).where(eq(routes.name, routeName))
  if (!route) return Response.json({ error: 'route not found', routeName }, { status: 404 })

  const routeSpots = await db.select().from(spots).where(eq(spots.routeId, route.id))
  const spotByOrder = new Map(routeSpots.map(s => [s.orderInRoute, s]))

  let fixed = 0
  let alreadyClean = 0
  const needsReview: { no: number; currentAddress: string | null; baselineAddress: string | null }[] = []

  for (const entry of entries) {
    const spot = spotByOrder.get(entry.no)
    if (!spot) continue

    const current = spot.address ?? ''
    const baseline = entry.baselineAddress ?? ''

    if (current === baseline) { alreadyClean++; continue }

    if (baseline && current.startsWith(baseline)) {
      const extra = stripLeadingSeparators(current.slice(baseline.length))
      await db.update(spots).set({ address: entry.baselineAddress }).where(eq(spots.id, spot.id))

      if (extra) {
        const [existingNote] = await db.select().from(spotNotes).where(eq(spotNotes.spotId, spot.id))
        if (!existingNote) {
          await db.insert(spotNotes).values({ spotId: spot.id, note: extra })
        } else if (existingNote.note !== extra && !existingNote.note.includes(extra)) {
          await db.update(spotNotes).set({ note: `${existingNote.note} / ${extra}` }).where(eq(spotNotes.id, existingNote.id))
        }
      }
      fixed++
    } else {
      needsReview.push({ no: entry.no, currentAddress: spot.address, baselineAddress: entry.baselineAddress })
    }
  }

  return Response.json({ routeName, fixed, alreadyClean, needsReview })
}
