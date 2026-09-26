import {
  pgTable, text, timestamp, integer, boolean, doublePrecision, jsonb, date, pgEnum,
} from 'drizzle-orm/pg-core'

export const routeScheduleStatusEnum = pgEnum('route_schedule_status', ['pending', 'in_progress', 'done'])
export const dailyReportStatusEnum   = pgEnum('daily_report_status', ['in_progress', 'pending_approval', 'approved'])
export const userRoleEnum            = pgEnum('user_role', ['union_admin', 'company_admin', 'driver'])
export const allowedEmailStatusEnum  = pgEnum('allowed_email_status', ['invited', 'registered'])
export const feeTypeEnum             = pgEnum('fee_type', ['rate_percent', 'fixed_amount'])

const id = () => text('id').primaryKey().$defaultFn(() => crypto.randomUUID())

// ── 組合 ──────────────────────────────────────────────
export const unions = pgTable('unions', {
  id:        id(),
  name:      text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ── 会社 ──────────────────────────────────────────────
export const companies = pgTable('companies', {
  id:            id(),
  unionId:       text('union_id').notNull().references(() => unions.id),
  name:          text('name').notNull(),
  wasteCategory: text('waste_category'),
  monthlyFee:    integer('monthly_fee'),
  createdAt:     timestamp('created_at').defaultNow().notNull(),
})

// ── エリア ─────────────────────────────────────────────
export const areas = pgTable('areas', {
  id:        id(),
  companyId: text('company_id').notNull().references(() => companies.id),
  name:      text('name').notNull(),
})

// ── ゴミ種類マスタ ───────────────────────────────────────
export const wasteTypes = pgTable('waste_types', {
  id:        id(),
  companyId: text('company_id').notNull().references(() => companies.id),
  name:      text('name').notNull(),
})

// ── 単価改定履歴 ────────────────────────────────────────
export const wasteTypePrices = pgTable('waste_type_prices', {
  id:            id(),
  wasteTypeId:   text('waste_type_id').notNull().references(() => wasteTypes.id),
  unitPrice:     integer('unit_price').notNull(),
  effectiveFrom: date('effective_from').notNull(),
  createdAt:     timestamp('created_at').defaultNow().notNull(),
})

// ── 巡回ルート ─────────────────────────────────────────
// defaultWasteTypeId: 設計ドキュメントからの拡張。ルートごとに扱う品目はほぼ固定なので、
// 日報提出時の初期値として使う（未設定なら null のまま、単価マスタ画面で後から設定）
export const routes = pgTable('routes', {
  id:                id(),
  areaId:            text('area_id').notNull().references(() => areas.id),
  name:              text('name').notNull(),
  defaultWasteTypeId: text('default_waste_type_id').references(() => wasteTypes.id),
  scheduleRule:      jsonb('schedule_rule'),
})

// ── ドライバーの担当ルート（多対多） ───────────────────────
export const userRoutes = pgTable('user_routes', {
  id:        id(),
  userId:    text('user_id').notNull().references(() => users.id),
  routeId:   text('route_id').notNull().references(() => routes.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ── ルートのスケジュール実体 ─────────────────────────────
export const routeSchedules = pgTable('route_schedules', {
  id:            id(),
  routeId:       text('route_id').notNull().references(() => routes.id),
  scheduledDate: date('scheduled_date').notNull(),
  status:        routeScheduleStatusEnum('status').default('pending').notNull(),
})

// ── ゴミ捨て場（スポット） ────────────────────────────────
// address: 設計ドキュメントからの拡張。実データ（斉藤商店エリアデータ）に住所があるため追加
export const spots = pgTable('spots', {
  id:            id(),
  routeId:       text('route_id').notNull().references(() => routes.id),
  name:          text('name'),
  address:       text('address'),
  latitude:      doublePrecision('latitude').notNull(),
  longitude:     doublePrecision('longitude').notNull(),
  isAlertSpot:   boolean('is_alert_spot').default(false).notNull(),
  orderInRoute:  integer('order_in_route').notNull(),
})

// ── スポットメモ ────────────────────────────────────────
export const spotNotes = pgTable('spot_notes', {
  id:        id(),
  spotId:    text('spot_id').notNull().references(() => spots.id),
  authorId:  text('author_id').references(() => users.id),
  note:      text('note').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ── 日報 ──────────────────────────────────────────────
export const dailyReports = pgTable('daily_reports', {
  id:               id(),
  routeId:          text('route_id').notNull().references(() => routes.id),
  reportDate:       date('report_date').notNull(),
  submittedBy:      text('submitted_by').references(() => users.id),
  wasteTypeId:      text('waste_type_id').references(() => wasteTypes.id),
  totalWeightKg:    doublePrecision('total_weight_kg'),
  reportPhotoUrl:   text('report_photo_url'),
  receiptPhotoUrl:  text('receipt_photo_url'),
  memo:             text('memo'),
  status:           dailyReportStatusEnum('status').default('in_progress').notNull(),
  approvedBy:       text('approved_by').references(() => users.id),
  approvedAt:       timestamp('approved_at'),
})

// ── 実走GPS軌跡 ────────────────────────────────────────
export const routeTrackPoints = pgTable('route_track_points', {
  id:             id(),
  dailyReportId:  text('daily_report_id').notNull().references(() => dailyReports.id),
  latitude:       doublePrecision('latitude').notNull(),
  longitude:      doublePrecision('longitude').notNull(),
  recordedAt:     timestamp('recorded_at').notNull(),
})

// ── 要注意スポットの確認タップ ─────────────────────────────
export const spotAlertAcknowledgments = pgTable('spot_alert_acknowledgments', {
  id:             id(),
  dailyReportId:  text('daily_report_id').notNull().references(() => dailyReports.id),
  spotId:         text('spot_id').notNull().references(() => spots.id),
  acknowledgedAt: timestamp('acknowledged_at').defaultNow().notNull(),
})

// ── 月次集計（確定値） ────────────────────────────────────
export const monthlySummaries = pgTable('monthly_summaries', {
  id:            id(),
  companyId:     text('company_id').notNull().references(() => companies.id),
  yearMonth:     text('year_month').notNull(),
  totalWeightKg: doublePrecision('total_weight_kg').notNull(),
  totalAmount:   integer('total_amount').notNull(),
  lockedAt:      timestamp('locked_at'),
})

// ── 協会手数料マスタ ───────────────────────────────────────
export const feeRules = pgTable('fee_rules', {
  id:            id(),
  unionId:       text('union_id').notNull().references(() => unions.id),
  companyId:     text('company_id').references(() => companies.id),
  feeType:       feeTypeEnum('fee_type').notNull(),
  feeValue:      doublePrecision('fee_value').notNull(),
  effectiveFrom: date('effective_from').notNull(),
  createdAt:     timestamp('created_at').defaultNow().notNull(),
})

// ── 支払い配分 ─────────────────────────────────────────
export const paymentAllocations = pgTable('payment_allocations', {
  id:               id(),
  unionId:          text('union_id').notNull().references(() => unions.id),
  companyId:        text('company_id').notNull().references(() => companies.id),
  yearMonth:        text('year_month').notNull(),
  grossAmount:      integer('gross_amount').notNull(),
  feeAmount:        integer('fee_amount').notNull(),
  allocatedAmount:  integer('allocated_amount').notNull(),
  allocationRule:   jsonb('allocation_rule'),
})

// ── 支払い評価（フェーズ2） ─────────────────────────────────
export const paymentEvaluations = pgTable('payment_evaluations', {
  id:        id(),
  companyId: text('company_id').notNull().references(() => companies.id),
  yearMonth: text('year_month').notNull(),
  score:     doublePrecision('score'),
  notes:     text('notes'),
})

// ── ユーザー ────────────────────────────────────────────
export const users = pgTable('users', {
  id:                 id(),
  unionId:            text('union_id').references(() => unions.id),
  companyId:          text('company_id').references(() => companies.id),
  name:               text('name'),
  email:              text('email').unique(),
  phoneNumber:        text('phone_number'),
  role:               userRoleEnum('role').notNull(),
  // 簡易パスワード認証（Google認証は後日導入予定）。招待時に発行した一時パスワードのハッシュを保持する
  passwordHash:       text('password_hash'),
  mustChangePassword: boolean('must_change_password').default(true).notNull(),
  createdAt:          timestamp('created_at').defaultNow().notNull(),
})

// ── ログインセッション ────────────────────────────────────
export const sessions = pgTable('sessions', {
  id:        id(),
  userId:    text('user_id').notNull().references(() => users.id),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ── 招待制の許可リスト ────────────────────────────────────
export const allowedEmails = pgTable('allowed_emails', {
  id:           id(),
  email:        text('email').notNull().unique(),
  unionId:      text('union_id').notNull().references(() => unions.id),
  companyId:    text('company_id').references(() => companies.id),
  invitedRole:  userRoleEnum('invited_role').notNull(),
  invitedBy:    text('invited_by').references(() => users.id),
  status:       allowedEmailStatusEnum('status').default('invited').notNull(),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
})
