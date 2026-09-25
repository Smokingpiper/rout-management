// 有限会社斉藤商店の回収エリアExcelデータ（ユーザーのDownloadsフォルダに展開済み）を
// unions/companies/areas/routes/spots/spot_notes/waste_types に取り込む一回限りのスクリプト。
// 個人の住所データを含むため、元データはリポジトリにはコピーしない。
import { config } from 'dotenv'
config({ path: '.env.local' })

import * as fs from 'node:fs'
import * as path from 'node:path'
import * as XLSX from 'xlsx'
// db/client は import 時に process.env.DATABASE_URL を読むため、
// dotenv の config() より後に評価されるよう動的 import にする
const { db } = await import('../src/db/client')
const { unions, companies, areas, routes, spots, spotNotes, wasteTypes } = await import('../src/db/schema')

const SOURCE_DIR = 'C:\\Users\\Smokingpiper1014\\Downloads\\saito_extract\\(有)斉藤商店回収エリア'
const UNION_NAME = '杉並リサイクル協同組合'
const COMPANY_NAME = '有限会社斉藤商店'

type Row = [number, string, number, number, string, string | null]

function areaNameFromFile(baseName: string): string {
  const m = baseName.match(/^([^\d]+)/)
  if (!m) throw new Error(`エリア名を抽出できません: ${baseName}`)
  return m[1]
}

function wasteTypeNameFromFile(baseName: string): string {
  if (baseName.includes('缶')) return '缶'
  // 種別の記載がないファイルは全て古紙（2026-09-25 ユーザー確認）
  return '古紙'
}

async function main() {
  const files = fs.readdirSync(SOURCE_DIR).filter(f => f.endsWith('.xlsx')).sort()
  console.log(`対象ファイル: ${files.length}件`)

  const [union] = await db.insert(unions).values({ name: UNION_NAME }).returning()
  console.log('union:', union.id, union.name)

  const [company] = await db.insert(companies).values({ unionId: union.id, name: COMPANY_NAME }).returning()
  console.log('company:', company.id, company.name)

  const areaIdByName = new Map<string, string>()
  const wasteTypeIdByName = new Map<string, string>()

  let totalSpots = 0
  let totalNotes = 0

  for (const file of files) {
    const baseName = path.basename(file, '.xlsx')
    const areaName = areaNameFromFile(baseName)
    const wasteTypeName = wasteTypeNameFromFile(baseName)

    if (!areaIdByName.has(areaName)) {
      const [area] = await db.insert(areas).values({ companyId: company.id, name: areaName }).returning()
      areaIdByName.set(areaName, area.id)
      console.log('  + area:', areaName)
    }

    if (!wasteTypeIdByName.has(wasteTypeName)) {
      const [wt] = await db.insert(wasteTypes).values({ companyId: company.id, name: wasteTypeName }).returning()
      wasteTypeIdByName.set(wasteTypeName, wt.id)
      console.log('  + wasteType:', wasteTypeName)
    }

    const [route] = await db.insert(routes).values({
      areaId: areaIdByName.get(areaName)!,
      name: baseName,
      defaultWasteTypeId: wasteTypeIdByName.get(wasteTypeName)!,
    }).returning()

    const wb = XLSX.readFile(path.join(SOURCE_DIR, file))
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<Row>(ws, { header: 1, range: 1 }) // skip header row

    const spotRows: (typeof spots.$inferInsert)[] = []
    const noteRows: { spotId: string; note: string }[] = []

    for (const row of rows) {
      const [no, , lat, lng, address, note] = row
      if (no == null || lat == null || lng == null) continue
      const spotId = crypto.randomUUID()
      spotRows.push({
        id: spotId,
        routeId: route.id,
        name: null,
        address: address ?? null,
        latitude: lat,
        longitude: lng,
        isAlertSpot: false,
        orderInRoute: no,
      })
      if (note) noteRows.push({ spotId, note })
    }

    const CHUNK = 300
    for (let i = 0; i < spotRows.length; i += CHUNK) {
      await db.insert(spots).values(spotRows.slice(i, i + CHUNK))
    }
    for (let i = 0; i < noteRows.length; i += CHUNK) {
      await db.insert(spotNotes).values(noteRows.slice(i, i + CHUNK))
    }

    totalSpots += spotRows.length
    totalNotes += noteRows.length
    console.log(`  route "${baseName}": spots=${spotRows.length} notes=${noteRows.length}`)
  }

  console.log(`\n完了: areas=${areaIdByName.size} routes=${files.length} spots=${totalSpots} notes=${totalNotes}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
