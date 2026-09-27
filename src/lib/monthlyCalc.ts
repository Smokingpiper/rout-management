import { db } from '@/db/client'
import {
  dailyReports, routes, areas, wasteTypePrices, feeRules,
  monthlySummaries, monthlySummaryItems, paymentAllocations,
} from '@/db/schema'
import { eq, and, inArray, desc, gte, lt, lte, isNull } from 'drizzle-orm'

// 指定日時点で有効な単価（effective_from が対象日以前で最新のもの）
async function priceAsOf(wasteTypeId: string, asOfDate: string): Promise<number | null> {
  const [row] = await db.select().from(wasteTypePrices)
    .where(and(eq(wasteTypePrices.wasteTypeId, wasteTypeId), lte(wasteTypePrices.effectiveFrom, asOfDate)))
    .orderBy(desc(wasteTypePrices.effectiveFrom))
    .limit(1)
  return row ? row.unitPrice : null
}

// 指定日時点で有効な手数料ルール（会社別ルールがあれば優先、なければ全社共通ルール）
async function feeRuleAsOf(unionId: string, companyId: string, asOfDate: string) {
  const companyRules = await db.select().from(feeRules)
    .where(and(eq(feeRules.unionId, unionId), eq(feeRules.companyId, companyId), lte(feeRules.effectiveFrom, asOfDate)))
    .orderBy(desc(feeRules.effectiveFrom)).limit(1)
  if (companyRules[0]) return companyRules[0]

  const generalRules = await db.select().from(feeRules)
    .where(and(eq(feeRules.unionId, unionId), isNull(feeRules.companyId), lte(feeRules.effectiveFrom, asOfDate)))
    .orderBy(desc(feeRules.effectiveFrom)).limit(1)
  return generalRules[0] ?? null
}

// 対象会社・対象年月（YYYY-MM）の承認済み日報を集計し、品目別内訳・月次合計・支払い配分を再計算する
export async function recalculateMonth(unionId: string, companyId: string, yearMonth: string) {
  const monthStart = `${yearMonth}-01`
  const [y, m] = yearMonth.split('-').map(Number)
  const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`

  const companyAreas = await db.select().from(areas).where(eq(areas.companyId, companyId))
  if (companyAreas.length === 0) return { totalWeightKg: 0, totalAmount: 0, items: [] }
  const companyRoutes = await db.select().from(routes).where(inArray(routes.areaId, companyAreas.map(a => a.id)))
  if (companyRoutes.length === 0) return { totalWeightKg: 0, totalAmount: 0, items: [] }

  const reports = await db.select().from(dailyReports).where(and(
    inArray(dailyReports.routeId, companyRoutes.map(r => r.id)),
    eq(dailyReports.status, 'approved'),
    gte(dailyReports.reportDate, monthStart),
    lt(dailyReports.reportDate, nextMonth),
  ))

  // 品目別に重量・金額を積み上げる（単価は日報ごとの実施日時点のものを使う）
  const byWasteType = new Map<string, { weight: number; amount: number }>()
  const priceCache = new Map<string, number | null>()
  for (const r of reports) {
    if (!r.wasteTypeId || r.totalWeightKg == null) continue
    const cacheKey = `${r.wasteTypeId}:${r.reportDate}`
    let price = priceCache.get(cacheKey)
    if (price === undefined) {
      price = await priceAsOf(r.wasteTypeId, r.reportDate)
      priceCache.set(cacheKey, price)
    }
    if (price == null) continue // 単価未設定の品目は集計対象外
    const entry = byWasteType.get(r.wasteTypeId) ?? { weight: 0, amount: 0 }
    entry.weight += r.totalWeightKg
    entry.amount += Math.round(r.totalWeightKg * price)
    byWasteType.set(r.wasteTypeId, entry)
  }

  const totalWeightKg = [...byWasteType.values()].reduce((s, v) => s + v.weight, 0)
  const totalAmount = [...byWasteType.values()].reduce((s, v) => s + v.amount, 0)

  // 品目別内訳（洗い替え）
  await db.delete(monthlySummaryItems).where(and(eq(monthlySummaryItems.companyId, companyId), eq(monthlySummaryItems.yearMonth, yearMonth)))
  if (byWasteType.size > 0) {
    await db.insert(monthlySummaryItems).values(
      [...byWasteType.entries()].map(([wasteTypeId, v]) => ({
        companyId, wasteTypeId, yearMonth, totalWeightKg: v.weight, totalAmount: v.amount,
      }))
    )
  }

  // 会社合計（洗い替え）
  await db.delete(monthlySummaries).where(and(eq(monthlySummaries.companyId, companyId), eq(monthlySummaries.yearMonth, yearMonth)))
  await db.insert(monthlySummaries).values({ companyId, yearMonth, totalWeightKg, totalAmount, lockedAt: new Date() })

  // 手数料を適用して支払い配分を計算（洗い替え）
  const rule = await feeRuleAsOf(unionId, companyId, `${yearMonth}-28`)
  const feeAmount = rule
    ? Math.round(rule.feeType === 'rate_percent' ? totalAmount * (rule.feeValue / 100) : rule.feeValue)
    : 0
  const allocatedAmount = totalAmount - feeAmount

  await db.delete(paymentAllocations).where(and(eq(paymentAllocations.companyId, companyId), eq(paymentAllocations.yearMonth, yearMonth)))
  await db.insert(paymentAllocations).values({
    unionId, companyId, yearMonth,
    grossAmount: totalAmount, feeAmount, allocatedAmount,
    allocationRule: rule ? { feeType: rule.feeType, feeValue: rule.feeValue } : null,
  })

  return { totalWeightKg, totalAmount, items: [...byWasteType.entries()] }
}

// 承認済み日報が存在する年月をすべて洗い出して再計算する（初回導入時のバックフィル用）
export async function recalculateAllMonths(unionId: string, companyId: string) {
  const companyAreas = await db.select().from(areas).where(eq(areas.companyId, companyId))
  if (companyAreas.length === 0) return []
  const companyRoutes = await db.select().from(routes).where(inArray(routes.areaId, companyAreas.map(a => a.id)))
  if (companyRoutes.length === 0) return []

  const reports = await db.select({ reportDate: dailyReports.reportDate }).from(dailyReports).where(and(
    inArray(dailyReports.routeId, companyRoutes.map(r => r.id)),
    eq(dailyReports.status, 'approved'),
  ))
  const yearMonths = [...new Set(reports.map(r => r.reportDate.slice(0, 7)))].sort()

  const results = []
  for (const ym of yearMonths) {
    results.push({ yearMonth: ym, ...(await recalculateMonth(unionId, companyId, ym)) })
  }
  return results
}
