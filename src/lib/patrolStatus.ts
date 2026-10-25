// 管理者向け「巡回状況」。指定日のすべてのルート（と早朝回収）について、
// どこまで回れているか・周回漏れの恐れがないか・誰に連絡すればよいかをまとめる
import { db } from '@/db/client'
import {
  areas, routes, spots, spotNotes, spotAlertAcknowledgments, userRoutes, users,
  dailyReports, routeTrackPoints, missedSpotOverrides, dailyInspections, reportVisitedSpots,
} from '@/db/schema'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { getPrimaryCompany } from './company'
import { todayStr } from './date'
import { MISSED_SPOT_THRESHOLD_M, distanceMeters } from './missedSpots'

// 位置情報が取れていない時間がこれを超えたら「記録が途絶えている」とみなす（今日の分のみ）
export const GPS_STALE_MINUTES = 10
// 画面に載せる未通過スポットの上限（多いときは件数だけ出す）
const MAX_UNVISITED_LISTED = 100

export type PatrolLevel = 'danger' | 'warn' | 'active' | 'ok' | 'idle'

export type PatrolDriver = { id: string; name: string; phone: string | null; email: string | null; inspected: boolean }
export type PatrolSpot = { id: string; routeId: string; orderInRoute: number; address: string | null; isAlertSpot: boolean; note: string | null; acked: boolean }

// 地図用の軽量データ。spots=[緯度, 経度, 通過済み(0)/未通過(1), 要注意(1), スポットid]、track=走行経路、last=最新の現在地
export type PatrolMapData = { spots: [number, number, 0 | 1, 0 | 1, string][]; track: [number, number][]; last: [number, number] | null }

export type PatrolRow = {
  key: string
  kind: 'regular' | 'early'
  title: string
  reportId: string | null
  reportStatus: string | null
  level: PatrolLevel
  statusText: string
  reasons: string[]
  total: number
  passed: number
  unvisitedCount: number
  unvisited: PatrolSpot[]
  alertSpots: PatrolSpot[]
  lastPointAt: string | null // ISO
  pointCount: number
  drivers: PatrolDriver[]
  map: PatrolMapData
}

export type PatrolStatusData = {
  date: string
  isToday: boolean
  generatedAt: string
  rows: PatrolRow[]
}

const LEVEL_ORDER: Record<PatrolLevel, number> = { danger: 0, warn: 1, active: 2, ok: 3, idle: 4 }

function dayOfWeekOf(date: string) {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

function hhmm(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' })
}

const r5 = (n: number) => Math.round(n * 1e5) / 1e5

// 走行経路を地図用に間引く（12m以上離れた点だけ残す。最後の点は必ず残す。最大1200点）
function thinTrack(pts: { lat: number; lng: number }[]): [number, number][] {
  const out: { lat: number; lng: number }[] = []
  for (const p of pts) {
    const last = out[out.length - 1]
    if (!last || distanceMeters(last, p) >= 12) out.push(p)
  }
  const end = pts[pts.length - 1]
  if (end && out[out.length - 1] !== end) out.push(end)
  const step = Math.max(1, Math.ceil(out.length / 1200))
  return out.filter((_, i) => i % step === 0 || i === out.length - 1).map(p => [r5(p.lat), r5(p.lng)] as [number, number])
}

// GPS点の格子（約45m四方）。判定距離（20m）より大きいので、スポットの周囲9マスだけ調べれば足りる
const CELL = 0.0005
function cellKey(lat: number, lng: number) {
  return `${Math.floor(lat / CELL)}:${Math.floor(lng / CELL)}`
}
export function buildGrid(points: { lat: number; lng: number }[]) {
  const grid = new Map<string, { lat: number; lng: number }[]>()
  for (const p of points) {
    const k = cellKey(p.lat, p.lng)
    const cell = grid.get(k)
    if (cell) cell.push(p); else grid.set(k, [p])
  }
  return grid
}
export function isNearTrack(grid: Map<string, { lat: number; lng: number }[]>, lat: number, lng: number) {
  const cy = Math.floor(lat / CELL), cx = Math.floor(lng / CELL)
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const cell = grid.get(`${cy + dy}:${cx + dx}`)
      if (!cell) continue
      for (const p of cell) if (distanceMeters({ lat, lng }, p) <= MISSED_SPOT_THRESHOLD_M) return true
    }
  }
  return false
}

export async function loadPatrolStatus(date: string): Promise<PatrolStatusData> {
  const isToday = date === todayStr()
  const dow = dayOfWeekOf(date)
  const company = await getPrimaryCompany()

  const areaList = company ? await db.select().from(areas).where(eq(areas.companyId, company.id)) : []
  const areaById = new Map(areaList.map(a => [a.id, a]))
  const routeList = areaList.length ? await db.select().from(routes).where(inArray(routes.areaId, areaList.map(a => a.id))) : []
  const routeIds = routeList.map(r => r.id)

  const userList = company ? await db.select().from(users).where(eq(users.companyId, company.id)) : []
  const userById = new Map(userList.map(u => [u.id, u]))

  // この曜日の担当ドライバー
  const assignments = routeIds.length ? await db.select().from(userRoutes).where(inArray(userRoutes.routeId, routeIds)) : []
  const driversByRoute = new Map<string, string[]>()
  for (const a of assignments) {
    if (!(a.daysOfWeek as number[]).includes(dow)) continue
    const list = driversByRoute.get(a.routeId) ?? []
    list.push(a.userId)
    driversByRoute.set(a.routeId, list)
  }

  // この日の日報（通常回収はルートごと、早朝回収はドライバーごと）と、作業前点検の有無
  const reportList = await db.select().from(dailyReports).where(eq(dailyReports.reportDate, date))
  const regularByRoute = new Map(reportList.filter(r => r.collectionType === 'regular' && r.routeId).map(r => [r.routeId!, r]))
  const earlyReports = reportList.filter(r => r.collectionType === 'early')
  const inspections = await db.select().from(dailyInspections).where(eq(dailyInspections.inspectionDate, date))
  const inspectedKey = new Set(inspections.map(i => `${i.userId}|${i.shiftType}`))

  const reportIds = reportList.map(r => r.id)
  const points = reportIds.length
    ? await db.select({ reportId: routeTrackPoints.dailyReportId, lat: routeTrackPoints.latitude, lng: routeTrackPoints.longitude, at: routeTrackPoints.recordedAt })
        .from(routeTrackPoints).where(inArray(routeTrackPoints.dailyReportId, reportIds)).orderBy(asc(routeTrackPoints.recordedAt))
    : []
  const pointsByReport = new Map<string, { lat: number; lng: number; at: Date }[]>()
  for (const p of points) {
    const list = pointsByReport.get(p.reportId) ?? []
    list.push({ lat: p.lat, lng: p.lng, at: p.at })
    pointsByReport.set(p.reportId, list)
  }

  const overrides = reportIds.length ? await db.select().from(missedSpotOverrides).where(inArray(missedSpotOverrides.dailyReportId, reportIds)) : []
  const overriddenByReport = new Map<string, Set<string>>()
  for (const o of overrides) {
    const set = overriddenByReport.get(o.dailyReportId) ?? new Set<string>()
    set.add(o.spotId)
    overriddenByReport.set(o.dailyReportId, set)
  }
  const acks = reportIds.length ? await db.select().from(spotAlertAcknowledgments).where(inArray(spotAlertAcknowledgments.dailyReportId, reportIds)) : []
  const ackedByReport = new Map<string, Set<string>>()
  for (const a of acks) {
    const set = ackedByReport.get(a.dailyReportId) ?? new Set<string>()
    set.add(a.spotId)
    ackedByReport.set(a.dailyReportId, set)
  }

  // 管理者はすべてのルートを見られるようにする（担当がいない日・日報がまだ無いルートも含める）
  const activeRoutes = routeList
  const activeRouteIds = activeRoutes.map(r => r.id)
  const spotList = activeRouteIds.length ? await db.select().from(spots).where(inArray(spots.routeId, activeRouteIds)) : []
  const spotsByRoute = new Map<string, typeof spotList>()
  for (const s of spotList) {
    const list = spotsByRoute.get(s.routeId) ?? []
    list.push(s)
    spotsByRoute.set(s.routeId, list)
  }

  const now = Date.now()
  const driverInfo = (userId: string, shift: 'normal' | 'early'): PatrolDriver | null => {
    const u = userById.get(userId)
    if (!u) return null
    return { id: u.id, name: u.name || u.email || '（名前なし）', phone: u.phoneNumber ?? null, email: u.email ?? null, inspected: inspectedKey.has(`${u.id}|${shift}`) }
  }

  type Draft = Omit<PatrolRow, 'level' | 'statusText' | 'reasons' | 'map'> & { visitedIds: Set<string> | null; map: PatrolMapData }
  const rows: PatrolRow[] = []

  // ── 通常回収（ルートごと）
  const noteTargetIds = new Set<string>()
  const draftRows: { draft: Draft; unvisitedAll: typeof spotList; alertAll: typeof spotList }[] = []
  for (const route of activeRoutes) {
    const report = regularByRoute.get(route.id) ?? null
    const routeSpots = (spotsByRoute.get(route.id) ?? []).sort((a, b) => a.orderInRoute - b.orderInRoute)
    const pts = report ? pointsByReport.get(report.id) ?? [] : []
    const grid = buildGrid(pts)
    const overridden = report ? overriddenByReport.get(report.id) ?? new Set<string>() : new Set<string>()
    const passedIds = new Set<string>()
    for (const s of routeSpots) {
      if (overridden.has(s.id) || (pts.length > 0 && isNearTrack(grid, s.latitude, s.longitude))) passedIds.add(s.id)
    }
    const unvisitedAll = routeSpots.filter(s => !passedIds.has(s.id))
    const alertAll = routeSpots.filter(s => s.isAlertSpot)
    const lastPoint = pts.length ? pts[pts.length - 1].at.toISOString() : null
    const area = areaById.get(route.areaId)
    const driverIds = [...new Set(driversByRoute.get(route.id) ?? [])]
    const drivers = driverIds.map(id => driverInfo(id, 'normal')).filter((d): d is PatrolDriver => !!d)
    unvisitedAll.slice(0, MAX_UNVISITED_LISTED).forEach(s => noteTargetIds.add(s.id))
    alertAll.forEach(s => noteTargetIds.add(s.id))
    draftRows.push({
      draft: {
        key: `route:${route.id}`, kind: 'regular', title: `${area?.name ?? ''} — ${route.name}`,
        reportId: report?.id ?? null, reportStatus: report?.status ?? null,
        total: routeSpots.length, passed: passedIds.size, unvisitedCount: unvisitedAll.length,
        unvisited: [], alertSpots: [], lastPointAt: lastPoint, pointCount: pts.length, drivers, visitedIds: passedIds,
        map: {
          spots: routeSpots.map(s => [r5(s.latitude), r5(s.longitude), passedIds.has(s.id) ? 0 : 1, s.isAlertSpot ? 1 : 0, s.id] as [number, number, 0 | 1, 0 | 1, string]),
          track: thinTrack(pts),
          last: pts.length ? [r5(pts[pts.length - 1].lat), r5(pts[pts.length - 1].lng)] : null,
        },
      },
      unvisitedAll, alertAll,
    })
  }

  const noteRows = noteTargetIds.size ? await db.select().from(spotNotes).where(inArray(spotNotes.spotId, [...noteTargetIds])) : []
  const noteBySpot = new Map(noteRows.map(n => [n.spotId, n.note]))

  for (const { draft, unvisitedAll, alertAll } of draftRows) {
    const ackedSet = draft.reportId ? ackedByReport.get(draft.reportId) ?? new Set<string>() : new Set<string>()
    const toSpot = (s: (typeof spotList)[number]): PatrolSpot => ({
      id: s.id, routeId: s.routeId, orderInRoute: s.orderInRoute, address: s.address, isAlertSpot: s.isAlertSpot,
      note: noteBySpot.get(s.id) ?? null, acked: ackedSet.has(s.id),
    })
    const { visitedIds: _v, ...base } = draft
    void _v
    const row: PatrolRow = {
      ...base, level: 'idle', statusText: '', reasons: [],
      unvisited: unvisitedAll.slice(0, MAX_UNVISITED_LISTED).map(toSpot),
      alertSpots: alertAll.map(toSpot),
    }

    const stale = isToday && row.lastPointAt != null && now - new Date(row.lastPointAt).getTime() > GPS_STALE_MINUTES * 60_000
    const submitted = row.reportStatus != null && row.reportStatus !== 'in_progress'
    if (submitted) {
      if (row.unvisitedCount > 0) {
        row.level = 'danger'
        row.statusText = '周回漏れの恐れ'
        row.reasons.push(`日報は提出済みですが、通過が確認できていないスポットが${row.unvisitedCount}件あります`)
      } else {
        row.level = 'ok'
        row.statusText = row.reportStatus === 'approved' ? '完了（承認済み）' : '完了（提出済み）'
      }
    } else if (row.pointCount > 0) {
      if (!isToday) {
        row.level = 'warn'
        row.statusText = '日報が未提出'
        row.reasons.push('この日の日報が提出されていません')
      } else if (stale) {
        row.level = 'warn'
        row.statusText = 'GPS記録が途絶'
        row.reasons.push(`最後の位置情報は${hhmm(row.lastPointAt)}です（${GPS_STALE_MINUTES}分以上、更新がありません）。アプリを閉じた・電波が悪い・記録を止めている可能性があります`)
      } else {
        row.level = 'active'
        row.statusText = '巡回中'
      }
    } else if (row.drivers.length > 0) {
      row.level = 'warn'
      row.statusText = isToday ? '未開始' : '記録なし'
      row.reasons.push(isToday ? '担当ドライバーがいますが、まだGPSの記録が始まっていません' : '担当ドライバーがいましたが、この日の記録がありません')
    } else {
      row.level = 'idle'
      row.statusText = isToday ? '本日の担当なし' : '記録なし'
    }
    if (row.level !== 'ok' && row.level !== 'idle' && row.drivers.length === 0) row.reasons.push('この曜日の担当ドライバーが設定されていません')
    rows.push(row)
  }

  // ── 早朝回収（ドライバーごと。ルートがないので、回ったスポット数だけ出す）
  const earlyIds = earlyReports.map(r => r.id)
  const earlySpotIds = [...new Set((earlyIds.length ? await db.select().from(reportVisitedSpots).where(and(inArray(reportVisitedSpots.dailyReportId, earlyIds), eq(reportVisitedSpots.excluded, false))) : []).map(v => v.spotId))]
  const earlySpotRows = earlySpotIds.length ? await db.select().from(spots).where(inArray(spots.id, earlySpotIds)) : []
  const earlySpotById = new Map(earlySpotRows.map(s => [s.id, s]))
  const visitedRows = earlyIds.length
    ? await db.select().from(reportVisitedSpots).where(and(inArray(reportVisitedSpots.dailyReportId, earlyIds), eq(reportVisitedSpots.excluded, false)))
    : []
  const visitedCount = new Map<string, number>()
  for (const v of visitedRows) visitedCount.set(v.dailyReportId, (visitedCount.get(v.dailyReportId) ?? 0) + 1)
  for (const r of earlyReports) {
    const pts = pointsByReport.get(r.id) ?? []
    const lastPoint = pts.length ? pts[pts.length - 1].at.toISOString() : null
    const stale = isToday && lastPoint != null && now - new Date(lastPoint).getTime() > GPS_STALE_MINUTES * 60_000
    const driver = r.startedBy ? driverInfo(r.startedBy, 'early') : null
    const submitted = r.status !== 'in_progress'
    const row: PatrolRow = {
      key: `early:${r.id}`, kind: 'early', title: `早朝回収${driver ? `（${driver.name}）` : ''}`,
      reportId: r.id, reportStatus: r.status, level: 'active', statusText: '巡回中', reasons: [],
      total: 0, passed: visitedCount.get(r.id) ?? 0, unvisitedCount: 0, unvisited: [], alertSpots: [],
      lastPointAt: lastPoint, pointCount: pts.length, drivers: driver ? [driver] : [],
      map: {
        spots: visitedRows.filter(v => v.dailyReportId === r.id).flatMap(v => {
          const s = earlySpotById.get(v.spotId)
          return s ? [[r5(s.latitude), r5(s.longitude), 0, 0, s.id] as [number, number, 0 | 1, 0 | 1, string]] : []
        }),
        track: thinTrack(pts),
        last: pts.length ? [r5(pts[pts.length - 1].lat), r5(pts[pts.length - 1].lng)] : null,
      },
    }
    if (submitted) { row.level = 'ok'; row.statusText = r.status === 'approved' ? '完了（承認済み）' : '完了（提出済み）' }
    else if (!isToday) { row.level = 'warn'; row.statusText = '日報が未提出'; row.reasons.push('この日の日報が提出されていません') }
    else if (stale) { row.level = 'warn'; row.statusText = 'GPS記録が途絶'; row.reasons.push(`最後の位置情報は${hhmm(lastPoint)}です（${GPS_STALE_MINUTES}分以上、更新がありません）`) }
    rows.push(row)
  }

  rows.sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] || a.title.localeCompare(b.title, 'ja'))
  return { date, isToday, generatedAt: new Date().toISOString(), rows }
}
