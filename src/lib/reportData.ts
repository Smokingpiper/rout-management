import { db } from '@/db/client'
import { dailyInspections, reportVisitedSpots, reportWasteWeights, spots, users, wasteTypes } from '@/db/schema'
import { wasteTypeLabel } from './wasteTypes'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { stampUserIds, type ReportStampSource } from './reportStamps'

type ReportLike = ReportStampSource & {
  id: string
  reportDate: string
  collectionType: string
}

// 日報の区分に対応する作業前点検の区分（早朝回収→early、通常回収→normal）
export function inspectionShiftFor(report: { collectionType: string }): 'early' | 'normal' {
  return report.collectionType === 'early' ? 'early' : 'normal'
}

// 日報を提出したドライバーの、その日・その区分の作業前点検
export async function loadInspectionForReport(report: ReportLike & { submittedBy: string | null }) {
  if (!report.submittedBy) return null
  const [inspection] = await db.select().from(dailyInspections).where(and(
    eq(dailyInspections.userId, report.submittedBy),
    eq(dailyInspections.inspectionDate, report.reportDate),
    eq(dailyInspections.shiftType, inspectionShiftFor(report)),
  ))
  return inspection ?? null
}

// 日報ごとの収集物の内訳（新聞◯kg・雑誌◯kg…）。内訳が無い古い日報は空
export type WeightBreakdownRow = { wasteTypeId: string; name: string; weightKg: number }
export async function loadWeightBreakdown(reportIds: string[]): Promise<Map<string, WeightBreakdownRow[]>> {
  const result = new Map<string, WeightBreakdownRow[]>()
  if (reportIds.length === 0) return result
  const rows = await db.select().from(reportWasteWeights).where(inArray(reportWasteWeights.dailyReportId, reportIds))
  if (rows.length === 0) return result
  const byId = new Map((await db.select().from(wasteTypes)).map(w => [w.id, w]))
  for (const r of rows) {
    const list = result.get(r.dailyReportId) ?? []
    list.push({ wasteTypeId: r.wasteTypeId, name: wasteTypeLabel(r.wasteTypeId, byId) || '（不明）', weightKg: r.weightKg })
    result.set(r.dailyReportId, list)
  }
  for (const list of result.values()) list.sort((a, b) => a.name.localeCompare(b.name, 'ja'))
  return result
}

// 早朝回収で回ったスポット（外されたものを除く）を回った順に
export async function loadVisitedSpots(dailyReportId: string) {
  return db
    .select({
      id: spots.id,
      address: spots.address,
      latitude: spots.latitude,
      longitude: spots.longitude,
      source: reportVisitedSpots.source,
      visitedAt: reportVisitedSpots.visitedAt,
    })
    .from(reportVisitedSpots)
    .innerJoin(spots, eq(reportVisitedSpots.spotId, spots.id))
    .where(and(eq(reportVisitedSpots.dailyReportId, dailyReportId), eq(reportVisitedSpots.excluded, false)))
    .orderBy(asc(reportVisitedSpots.visitedAt))
}

// 押印に使うユーザー（担当者・係長・承認者）をまとめて取得する
export async function loadStampUsers(reportList: ReportStampSource[]) {
  const ids = [...new Set(reportList.flatMap(stampUserIds))]
  const list = ids.length ? await db.select().from(users).where(inArray(users.id, ids)) : []
  return new Map(list.map(u => [u.id, u]))
}

export type EarlyIncident = { vehicleNumber: string; company: string; time: string }
