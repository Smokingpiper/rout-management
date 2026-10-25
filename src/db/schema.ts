import {
  pgTable, text, timestamp, integer, boolean, doublePrecision, jsonb, date, pgEnum, uniqueIndex, type AnyPgColumn,
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

// ── ゴミ種類（収集物）マスタ ─────────────────────────────────
// parentId が null＝大分類（古紙・ビン・缶など。ルートの既定や日報の収集物として選ぶ）。
// parentId がある＝内訳（古紙の中の新聞・雑誌・段ボールなど）。内訳がある大分類は、日報に内訳ごとの重さを書く。
// 単価は、内訳があれば内訳ごと、なければ大分類に設定する
export const wasteTypes = pgTable('waste_types', {
  id:        id(),
  companyId: text('company_id').notNull().references(() => companies.id),
  name:      text('name').notNull(),
  parentId:  text('parent_id').references((): AnyPgColumn => wasteTypes.id),
})

// ── 車両マスタ ────────────────────────────────────────
export const vehicles = pgTable('vehicles', {
  id:          id(),
  companyId:   text('company_id').notNull().references(() => companies.id),
  plateNumber: text('plate_number').notNull(), // ナンバープレート（例：品川 800 あ 1234）
  name:        text('name'),                   // 呼び名（例：2tパッカー車）
  active:      boolean('active').notNull().default(true),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
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

// ── ドライバーの担当ルート（多対多、曜日指定つき） ───────────────
export const userRoutes = pgTable('user_routes', {
  id:         id(),
  userId:     text('user_id').notNull().references(() => users.id),
  routeId:    text('route_id').notNull().references(() => routes.id),
  // 曜日の配列（0=日〜6=土、JSの Date.getDay() と同じ規則）。空配列は「このルートは担当だが曜日未設定」を表す
  daysOfWeek: jsonb('days_of_week').notNull().default('[]'),
  createdAt:  timestamp('created_at').defaultNow().notNull(),
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

// ── スポットの担当ドライバー（多対多、1スポットにつき最大5人まで。上限はアプリ側でチェック） ─
export const spotAssignments = pgTable('spot_assignments', {
  id:        id(),
  spotId:    text('spot_id').notNull().references(() => spots.id),
  userId:    text('user_id').notNull().references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
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
  // 早朝回収はルートを持たないため null を許す
  routeId:          text('route_id').references(() => routes.id),
  reportDate:       date('report_date').notNull(),
  // 'regular'=通常回収（ルートあり）/ 'early'=早朝回収（ルートなし・ドライバーが自由にスポットを回る）
  collectionType:   text('collection_type').notNull().default('regular'),
  // 日報を開始したドライバー（早朝回収はドライバーごとに1日1件の日報になる）
  startedBy:        text('started_by').references(() => users.id),
  submittedBy:      text('submitted_by').references(() => users.id),
  wasteTypeId:      text('waste_type_id').references(() => wasteTypes.id),
  totalWeightKg:    doublePrecision('total_weight_kg'),
  reportPhotoUrl:   text('report_photo_url'),
  receiptPhotoUrl:  text('receipt_photo_url'),
  memo:             text('memo'),
  status:           dailyReportStatusEnum('status').default('in_progress').notNull(),
  approvedBy:       text('approved_by').references(() => users.id),
  approvedAt:       timestamp('approved_at'),
  // 押印欄：担当者=submittedBy/submittedAt、係長=chiefStamped*、課長=approvedBy/approvedAt（承認＝課長欄の押印）
  submittedAt:      timestamp('submitted_at'),
  chiefStampedBy:   text('chief_stamped_by').references(() => users.id),
  chiefStampedAt:   timestamp('chief_stamped_at'),
  // 早朝回収の「持ち去り車両」記録: [{ vehicleNumber, company, time }]
  incidentLog:      jsonb('incident_log').notNull().default('[]'),
})

// ── 日報の収集物ごとの重さ（内訳） ───────────────────────────
// 大分類に内訳がある場合は内訳ごとに1行（古紙→新聞/雑誌/段ボール）、内訳がない場合は大分類自体で1行。
// 日報の総重量（daily_reports.total_weight_kg）は、この合計と一致させる。
// この行が無い古い日報は、従来どおり daily_reports の waste_type_id と総重量で集計する
export const reportWasteWeights = pgTable('report_waste_weights', {
  id:            id(),
  dailyReportId: text('daily_report_id').notNull().references(() => dailyReports.id),
  wasteTypeId:   text('waste_type_id').notNull().references(() => wasteTypes.id),
  weightKg:      doublePrecision('weight_kg').notNull(),
}, t => [uniqueIndex('report_waste_weights_unique').on(t.dailyReportId, t.wasteTypeId)])

// ── 早朝回収で回ったスポット ─────────────────────────────
// GPS通過で自動追加（source=gps）またはドライバーが手動追加（source=manual）。
// ドライバーが外したスポットは excluded=true にして残し、GPSが再度自動追加しないようにする
export const reportVisitedSpots = pgTable('report_visited_spots', {
  id:            id(),
  dailyReportId: text('daily_report_id').notNull().references(() => dailyReports.id),
  spotId:        text('spot_id').notNull().references(() => spots.id),
  source:        text('source').notNull().default('gps'),
  excluded:      boolean('excluded').notNull().default(false),
  visitedAt:     timestamp('visited_at').defaultNow().notNull(),
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

// ── 周り損ない判定の手動クリア（GPS誤差等による誤検知の解除） ───────
export const missedSpotOverrides = pgTable('missed_spot_overrides', {
  id:            id(),
  dailyReportId: text('daily_report_id').notNull().references(() => dailyReports.id),
  spotId:        text('spot_id').notNull().references(() => spots.id),
  clearedBy:     text('cleared_by').references(() => users.id),
  clearedAt:     timestamp('cleared_at').defaultNow().notNull(),
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

// ── 月次集計の品目別内訳 ───────────────────────────────────
export const monthlySummaryItems = pgTable('monthly_summary_items', {
  id:            id(),
  companyId:     text('company_id').notNull().references(() => companies.id),
  wasteTypeId:   text('waste_type_id').notNull().references(() => wasteTypes.id),
  yearMonth:     text('year_month').notNull(),
  totalWeightKg: doublePrecision('total_weight_kg').notNull(),
  totalAmount:   integer('total_amount').notNull(),
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
  // 1人が複数ロールを兼ねられるようにする（例：会社管理者 かつ ドライバー）。
  // 値は user_role enum と同じ文字列（'union_admin'|'company_admin'|'driver'）の配列
  roles:              jsonb('roles').notNull().default('[]'),
  // 会社管理者の中のランク。'manager'=課長 / 'chief'=係長 / null=未設定（従来どおり承認でき、課長欄に押印される）
  adminRank:          text('admin_rank'),
  // 電子印鑑に表示する文字。未設定なら氏名から自動で決める（src/lib/seal.ts）
  sealName:           text('seal_name'),
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

// ── 作業前点検（日常点検・点呼表）──────────────────────────
// 紙の「日常点検・点呼表」のデジタル化。ドライバー1人につき1日1件（日付はJST基準）。
// checks:        { [項目キー]: { result: 'ok' | 'ng', action?: '×の場合の対応' } }（項目定義は src/lib/inspection.ts）
// startRollCall/endRollCall: 始業・終業点呼（点呼者・対面・検知器・酒気帯び・体調・連絡事項・記録時刻）
export const dailyInspections = pgTable('daily_inspections', {
  id:             id(),
  userId:         text('user_id').notNull().references(() => users.id),
  inspectionDate: date('inspection_date').notNull(),
  shiftType:      text('shift_type').notNull().default('normal'),
  vehicleNumber:  text('vehicle_number'), // ナンバー（マスタから選んだ時点の値を控えとして残す）
  vehicleId:      text('vehicle_id').references(() => vehicles.id),
  checks:         jsonb('checks').notNull().default('{}'),
  startRollCall:  jsonb('start_roll_call'),
  endRollCall:    jsonb('end_roll_call'),
  nearMissNote:   text('near_miss_note'),
  createdAt:      timestamp('created_at').defaultNow().notNull(),
  updatedAt:      timestamp('updated_at').defaultNow().notNull(),
})
