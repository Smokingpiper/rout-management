// 住所欄に紛れ込んだ備考文言を、元Excelの住所（ベースライン）との前方一致差分で検出し、
// /api/admin/fix-address-notes 経由で住所を元に戻し備考へ移す。DB直結不要。
import * as fs from 'node:fs'
import * as path from 'node:path'
import XLSX from 'xlsx'

const SOURCE_DIR = 'C:\\Users\\Smokingpiper1014\\Downloads\\saito_extract\\(有)斉藤商店回収エリア'

const TARGET_URL = process.env.TARGET_URL || 'https://rout-management.vercel.app'
const BASIC_AUTH_USER = process.env.BASIC_AUTH_USER
const BASIC_AUTH_PASSWORD = process.env.BASIC_AUTH_PASSWORD
const IMPORT_ADMIN_TOKEN = process.env.IMPORT_ADMIN_TOKEN

if (!BASIC_AUTH_USER || !BASIC_AUTH_PASSWORD || !IMPORT_ADMIN_TOKEN) {
  console.error('BASIC_AUTH_USER / BASIC_AUTH_PASSWORD / IMPORT_ADMIN_TOKEN を環境変数で渡してください')
  process.exit(1)
}

async function main() {
  const files = fs.readdirSync(SOURCE_DIR).filter(f => f.endsWith('.xlsx')).sort()
  const authHeader = 'Basic ' + Buffer.from(`${BASIC_AUTH_USER}:${BASIC_AUTH_PASSWORD}`).toString('base64')

  let totalFixed = 0
  const allNeedsReview = []

  for (const file of files) {
    const routeName = path.basename(file, '.xlsx')
    const wb = XLSX.readFile(path.join(SOURCE_DIR, file))
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, range: 1 })

    const entries = []
    for (const row of rows) {
      const [no, , lat, lng, address] = row
      if (no == null || lat == null || lng == null) continue
      entries.push({ no, baselineAddress: address ?? null })
    }

    const res = await fetch(`${TARGET_URL}/api/admin/fix-address-notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
        'x-import-token': IMPORT_ADMIN_TOKEN,
      },
      body: JSON.stringify({ routeName, entries }),
    })

    const json = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    if (!res.ok) {
      console.error(`  ✗ ${routeName}: HTTP ${res.status}`, json)
      continue
    }
    console.log(`  ${routeName}: fixed=${json.fixed} alreadyClean=${json.alreadyClean} needsReview=${json.needsReview.length}`)
    totalFixed += json.fixed
    for (const r of json.needsReview) allNeedsReview.push({ routeName, ...r })
  }

  console.log(`\n合計 fixed=${totalFixed}`)
  if (allNeedsReview.length) {
    console.log(`\n要確認（自動修正しなかったもの）: ${allNeedsReview.length}件`)
    for (const r of allNeedsReview) {
      console.log(`  [${r.routeName} #${r.no}] 現在: ${JSON.stringify(r.currentAddress)} / 元Excel: ${JSON.stringify(r.baselineAddress)}`)
    }
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
