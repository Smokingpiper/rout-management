import XLSX from 'xlsx'

const file = process.argv[2]
const wb = XLSX.readFile(file)
const ws = wb.Sheets[wb.SheetNames[0]]
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, range: 0 })
for (let i = 0; i < 15; i++) {
  console.log(i, JSON.stringify(rows[i]))
}
