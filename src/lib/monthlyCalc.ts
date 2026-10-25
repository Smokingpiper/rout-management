import { db } from '@/db/client'
import {
  dailyReports, routes, areas, wasteTypePrices, feeRules,
  monthlySummaries, monthlySummaryItems, paymentAllocations, users, reportWasteWeights, wasteTypes,
} from '@/db/schema'
import { eq, and, or, inArray, desc, gte, lt, lte, isNull } from 'drizzle-orm'

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

// その会社の日報（通常回収＝会社のルートの日報、早朝回収＝会社のドライバーが開始した日報）を指す条件。
// 早朝回収はルートを持たないため、ルートではなく開始したドライバーの所属会社で判定する
async function companyReportCondition(companyId: string) {
  const companyAreas = await db.select().from(areas).where(eq(areas.companyId, companyId))
  const companyRoutes = companyAreas.length
    ? await db.select().from(routes).where(inArray(routes.areaId, companyAreas.map(a => a.id)))
    : []
  const companyUsers = await db.select({ id: users.id }).from(users).where(eq(users.companyId, companyId))

  const parts = []
  if (companyRoutes.length) parts.push(inArray(dailyReports.routeId, companyRoutes.map(r => r.id)))
  if (companyUsers.length) {
    parts.push(and(eq(dailyReports.collectionType, 'early'), inArray(dailyReports.startedBy, companyUsers.map(u => u.id))))
  }
  return parts.length ? or(...parts) : null
}

// 対象会社・対象年月（YYYY-MM）の承認済み日報を集計し、品目別内訳・月次合計・支払い配分を再計算する
export async function recalculateMonth(unionId: string, companyId: string, yearMonth: string) {
  const monthStart = `${yearMonth}-01`
  const [y, m] = yearMonth.split('-').map(Number)
  const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`

  const scope = await companyReportCondition(companyId)
  if (!scope) return { totalWeightKg: 0, totalAmount: 0, items: [] }

  const reports = await db.select().from(dailyReports).where(and(
    scope,
    eq(dailyReports.status, 'approved'),
    gte(dailyReports.reportDate, monthStart),
    lt(dailyReports.reportDate, nextMonth),
  ))

  // 日報ごとの収集物の内訳（古紙→新聞・雑誌・段ボール など）。内訳の行がある日報はそれを使い、
  // 無い古い日報は従来どおり「日報の品目＋総重量」で集計する
  const reportIds = reports.map(r => r.id)
  const weightRows = reportIds.length
    ? await db.select().from(reportWasteWeights).where(inArray(reportWasteWeights.dailyReportId, reportIds))
    : []
  const weightsByReport = new Map<string, { wasteTypeId: string; weightKg: number }[]>()
  for (const w of weightRows) {
    const list = weightsByReport.get(w.dailyReportId) ?? []
    list.push({ wasteTypeId: w.wasteTypeId, weightKg: w.weightKg })
    weightsByReport.set(w.dailyReportId, list)
  }
  const parentById = new Map((await db.select().from(wasteTypes).where(eq(wasteTypes.companyId, companyId))).map(w => [w.id, w.parentId]))

  // 品目別に重量・金額を積み上げる（単価は日報ごとの実施日時点のものを使う。
  // 内訳に単価が無ければ、その大分類の単価を使う）
  const byWasteType = new Map<string, { weight: number; amount: number }>()
  const priceCache = new Map<string, number | null>()
  async function priceFor(wasteTypeId: string, date: string) {
    const cacheKey = `${wasteTypeId}:${date}`
    let price = priceCache.get(cacheKey)
    if (price === undefined) {
      price = await priceAsOf(wasteTypeId, date)
      const parentId = parentById.get(wasteTypeId)
      if (price == null && parentId) price = await priceAsOf(parentId, date)
      priceCache.set(cacheKey, price)
    }
    return price
  }
  for (const r of reports) {
    const entries = weightsByReport.get(r.id)
      ?? (r.wasteTypeId && r.totalWeightKg != null ? [{ wasteTypeId: r.wasteTypeId, weightKg: r.totalWeightKg }] : [])
    for (const e of entries) {
      const price = await priceFor(e.wasteTypeId, r.reportDate)
      if (price == null) continue // 単価未設定の品目は集計対象外
      const entry = byWasteType.get(e.wasteTypeId) ?? { weight: 0, amount: 0 }
      entry.weight += e.weightKg
      entry.amount += Math.round(e.weightKg * price)
      byWasteType.set(e.wasteTypeId, entry)
    }
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
  const scope = await companyReportCondition(companyId)
  if (!scope) return []

  const reports = await db.select({ reportDate: dailyReports.reportDate }).from(dailyReports).where(and(
    scope,
    eq(dailyReports.status, 'approved'),
  ))
  const yearMonths = [...new Set(reports.map(r => r.reportDate.slice(0, 7)))].sort()

  const results = []
  for (const ym of yearMonths) {
    results.push({ yearMonth: ym, ...(await recalculateMonth(unionId, companyId, ym)) })
  }
  return results
}
