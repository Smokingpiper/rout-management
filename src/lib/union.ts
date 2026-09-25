import { db } from '@/db/client'
import { unions } from '@/db/schema'

// PoC段階では組合は1つのみ。複数組合対応はフェーズ3の拡張。
export async function getPrimaryUnion() {
  const [union] = await db.select().from(unions).limit(1)
  return union
}
