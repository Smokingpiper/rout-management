import { db } from '@/db/client'
import { sql } from 'drizzle-orm'

// スキーマ初期構築専用の一時的な管理API。IMPORT_ADMIN_TOKEN で保護する。
// DATABASE_URL がVercel上でSensitive設定のためローカルから drizzle-kit push できない事情への対処。
// 適用が終わったら削除して問題ない。
function checkToken(request: Request) {
  const expected = process.env.IMPORT_ADMIN_TOKEN
  if (!expected) return false
  return request.headers.get('x-import-token') === expected
}

const STATEMENTS = [
  `CREATE TYPE route_schedule_status AS ENUM ('pending','in_progress','done')`,
  `CREATE TYPE daily_report_status AS ENUM ('in_progress','pending_approval','approved')`,
  `CREATE TYPE user_role AS ENUM ('union_admin','company_admin','driver')`,
  `CREATE TYPE allowed_email_status AS ENUM ('invited','registered')`,
  `CREATE TYPE fee_type AS ENUM ('rate_percent','fixed_amount')`,

  `CREATE TABLE unions (
    id text PRIMARY KEY,
    name text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE companies (
    id text PRIMARY KEY,
    union_id text NOT NULL REFERENCES unions(id),
    name text NOT NULL,
    waste_category text,
    monthly_fee integer,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE areas (
    id text PRIMARY KEY,
    company_id text NOT NULL REFERENCES companies(id),
    name text NOT NULL
  )`,
  `CREATE TABLE waste_types (
    id text PRIMARY KEY,
    company_id text NOT NULL REFERENCES companies(id),
    name text NOT NULL
  )`,
  `CREATE TABLE waste_type_prices (
    id text PRIMARY KEY,
    waste_type_id text NOT NULL REFERENCES waste_types(id),
    unit_price integer NOT NULL,
    effective_from date NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE routes (
    id text PRIMARY KEY,
    area_id text NOT NULL REFERENCES areas(id),
    name text NOT NULL,
    default_waste_type_id text REFERENCES waste_types(id),
    schedule_rule jsonb
  )`,
  `CREATE TABLE users (
    id text PRIMARY KEY,
    union_id text REFERENCES unions(id),
    company_id text REFERENCES companies(id),
    name text,
    google_email text UNIQUE,
    phone_number text,
    role user_role NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE user_routes (
    id text PRIMARY KEY,
    user_id text NOT NULL REFERENCES users(id),
    route_id text NOT NULL REFERENCES routes(id),
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `ALTER TABLE user_routes ADD COLUMN days_of_week jsonb NOT NULL DEFAULT '[]'`,
  `CREATE TABLE route_schedules (
    id text PRIMARY KEY,
    route_id text NOT NULL REFERENCES routes(id),
    scheduled_date date NOT NULL,
    status route_schedule_status NOT NULL DEFAULT 'pending'
  )`,
  `CREATE TABLE spots (
    id text PRIMARY KEY,
    route_id text NOT NULL REFERENCES routes(id),
    name text,
    address text,
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    is_alert_spot boolean NOT NULL DEFAULT false,
    order_in_route integer NOT NULL
  )`,
  `CREATE TABLE spot_assignments (
    id text PRIMARY KEY,
    spot_id text NOT NULL REFERENCES spots(id),
    user_id text NOT NULL REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE spot_notes (
    id text PRIMARY KEY,
    spot_id text NOT NULL REFERENCES spots(id),
    author_id text REFERENCES users(id),
    note text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE daily_reports (
    id text PRIMARY KEY,
    route_id text NOT NULL REFERENCES routes(id),
    report_date date NOT NULL,
    submitted_by text REFERENCES users(id),
    waste_type_id text REFERENCES waste_types(id),
    total_weight_kg double precision,
    report_photo_url text,
    receipt_photo_url text,
    memo text,
    status daily_report_status NOT NULL DEFAULT 'in_progress',
    approved_by text REFERENCES users(id),
    approved_at timestamptz
  )`,
  `CREATE TABLE route_track_points (
    id text PRIMARY KEY,
    daily_report_id text NOT NULL REFERENCES daily_reports(id),
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    recorded_at timestamptz NOT NULL
  )`,
  `CREATE TABLE spot_alert_acknowledgments (
    id text PRIMARY KEY,
    daily_report_id text NOT NULL REFERENCES daily_reports(id),
    spot_id text NOT NULL REFERENCES spots(id),
    acknowledged_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE monthly_summaries (
    id text PRIMARY KEY,
    company_id text NOT NULL REFERENCES companies(id),
    year_month text NOT NULL,
    total_weight_kg double precision NOT NULL,
    total_amount integer NOT NULL,
    locked_at timestamptz
  )`,
  `CREATE TABLE fee_rules (
    id text PRIMARY KEY,
    union_id text NOT NULL REFERENCES unions(id),
    company_id text REFERENCES companies(id),
    fee_type fee_type NOT NULL,
    fee_value double precision NOT NULL,
    effective_from date NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE payment_allocations (
    id text PRIMARY KEY,
    union_id text NOT NULL REFERENCES unions(id),
    company_id text NOT NULL REFERENCES companies(id),
    year_month text NOT NULL,
    gross_amount integer NOT NULL,
    fee_amount integer NOT NULL,
    allocated_amount integer NOT NULL,
    allocation_rule jsonb
  )`,
  `CREATE TABLE payment_evaluations (
    id text PRIMARY KEY,
    company_id text NOT NULL REFERENCES companies(id),
    year_month text NOT NULL,
    score double precision,
    notes text
  )`,
  `CREATE TABLE allowed_emails (
    id text PRIMARY KEY,
    email text NOT NULL UNIQUE,
    union_id text NOT NULL REFERENCES unions(id),
    company_id text REFERENCES companies(id),
    invited_role user_role NOT NULL,
    invited_by text REFERENCES users(id),
    status allowed_email_status NOT NULL DEFAULT 'invited',
    created_at timestamptz NOT NULL DEFAULT now()
  )`,

  // 簡易パスワード認証（Google認証は後日）。招待でuser作成→一時パスワード発行→本人が変更する運用
  `ALTER TABLE users RENAME COLUMN google_email TO email`,
  `ALTER TABLE users ADD COLUMN password_hash text`,
  `ALTER TABLE users ADD COLUMN must_change_password boolean NOT NULL DEFAULT true`,
  `CREATE TABLE sessions (
    id text PRIMARY KEY,
    user_id text NOT NULL REFERENCES users(id),
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
]

export async function POST(request: Request) {
  if (!checkToken(request)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const results: { statement: string; ok: boolean; error?: string }[] = []
  for (const stmt of STATEMENTS) {
    try {
      await db.execute(sql.raw(stmt))
      results.push({ statement: stmt.split('\n')[0].slice(0, 60), ok: true })
    } catch (err: any) {
      results.push({ statement: stmt.split('\n')[0].slice(0, 60), ok: false, error: String(err?.message ?? err) })
    }
  }

  return Response.json({ results })
}
