import { db } from '@/db/client'
import { companies } from '@/db/schema'

// PoC段階では会社も1つのみ（getPrimaryUnionと同様の前提）。複数会社対応は将来の拡張。
export async function getPrimaryCompany() {
  const [company] = await db.select().from(companies).limit(1)
  return company
}
