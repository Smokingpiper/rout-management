// 斉藤商店の回収エリアExcelを読み、デプロイ済みの /api/admin/import-saito に
// ルートごとPOSTして取り込む。ローカルにDATABASE_URLを持たなくてよい。
// 必要な環境変数（コミットしない）: TARGET_URL, BASIC_AUTH_USER, BASIC_AUTH_PASSWORD, IMPORT_ADMIN_TOKEN
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as XLSX from 'xlsx'

const SOURCE_DIR = 'C:\\Users\\Smokingpiper1014\\Downloads\\saito_extract\\(有)斉藤商店回収エリア'
const UNION_NAME = '杉並リサイクル協同組合'
const COMPANY_NAME = '有限会社斉藤商店'

const TARGET_URL = process.env.TARGET_URL || 'https://rout-management.vercel.app'
const BASIC_AUTH_USER = process.env.BASIC_AUTH_USER
const BASIC_AUTH_PASSWORD = process.env.BASIC_AUTH_PASSWORD
const IMPORT_ADMIN_TOKEN = process.env.IMPORT_ADMIN_TOKEN

if (!BASIC_AUTH_USER || !BASIC_AUTH_PASSWORD || !IMPORT_ADMIN_TOKEN) {
  console.error('BASIC_AUTH_USER / BASIC_AUTH_PASSWORD / IMPORT_ADMIN_TOKEN を環境変数で渡してください')
  process.exit(1)
}

function areaNameFromFile(baseName) {
  const m = baseName.match(/^([^\d]+)/)
  if (!m) throw new Error(`エリア名を抽出できません: ${baseName}`)
  return m[1]
}

function wasteTypeNameFromFile(baseName) {
  if (baseName.includes('缶')) return '缶'
  return '古紙' // 記載のないファイルは全て古紙（2026-09-25 ユーザー確認）
}

async function main() {
  const files = fs.readdirSync(SOURCE_DIR).filter(f => f.endsWith('.xlsx')).sort()
  console.log(`対象ファイル: ${files.length}件`)

  const authHeader = 'Basic ' + Buffer.from(`${BASIC_AUTH_USER}:${BASIC_AUTH_PASSWORD}`).toString('base64')

  for (const file of files) {
    const baseName = path.basename(file, '.xlsx')
    const areaName = areaNameFromFile(baseName)
    const wasteTypeName = wasteTypeNameFromFile(baseName)

    const wb = XLSX.readFile(path.join(SOURCE_DIR, file))
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, range: 1 })

    const spotList = []
    for (const row of rows) {
      const [no, , lat, lng, address, note] = row
      if (no == null || lat == null || lng == null) continue
      spotList.push({ no, lat, lng, address: address ?? null, note: note ?? null })
    }

    const res = await fetch(`${TARGET_URL}/api/admin/import-saito`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
        'x-import-token': IMPORT_ADMIN_TOKEN,
      },
      body: JSON.stringify({
        unionName: UNION_NAME,
        companyName: COMPANY_NAME,
        areaName,
        wasteTypeName,
        routeName: baseName,
        spotList,
      }),
    })

    const json = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    if (!res.ok) {
      console.error(`  ✗ ${baseName}: HTTP ${res.status}`, json)
      continue
    }
    if (json.skipped) {
      console.log(`  - ${baseName}: skip (${json.reason})`)
    } else {
      console.log(`  + ${baseName}: spots=${json.spotsInserted} notes=${json.notesInserted}`)
    }
  }

  console.log('done')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
