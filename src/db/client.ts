import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

// DATABASE_URL は実行時（リクエストハンドラの中）まで読まない。
// Next.js のビルド時「Collecting page data」でモジュールがimportされるだけでも
// 即座に接続文字列を検証してしまうと、ローカルのプレースホルダー値でビルドが落ちるため。
type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>
let _db: DrizzleDb | null = null

function getDb(): DrizzleDb {
  if (!_db) {
    const sql = neon(process.env.DATABASE_URL!)
    _db = drizzle(sql, { schema })
  }
  return _db
}

export const db: DrizzleDb = new Proxy({} as DrizzleDb, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb() as object, prop, receiver)
  },
})
