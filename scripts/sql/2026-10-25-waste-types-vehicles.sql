-- 収集物マスタ（大分類＋内訳）・日報の重さの内訳・車両マスタ。
-- Neon SQL Editor は1回に1つの文しか実行できないので、①〜⑤を1つずつ別々に実行すること。
-- 先にこのSQLを実行してから、コードを公開する（コードが新しい列を読むため）。

-- ① 収集物の「親」（内訳→大分類）
ALTER TABLE waste_types ADD COLUMN IF NOT EXISTS parent_id text REFERENCES waste_types(id);

-- ② 車両マスタ
CREATE TABLE IF NOT EXISTS vehicles (
  id text PRIMARY KEY,
  company_id text NOT NULL REFERENCES companies(id),
  plate_number text NOT NULL,
  name text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now()
);

-- ③ 点検記録に使用車両を紐づける
ALTER TABLE daily_inspections ADD COLUMN IF NOT EXISTS vehicle_id text REFERENCES vehicles(id);

-- ④ 日報の収集物ごとの重さ（内訳）
CREATE TABLE IF NOT EXISTS report_waste_weights (
  id text PRIMARY KEY,
  daily_report_id text NOT NULL REFERENCES daily_reports(id),
  waste_type_id text NOT NULL REFERENCES waste_types(id),
  weight_kg double precision NOT NULL
);

-- ⑤ 同じ日報・同じ収集物の行は1つだけ
CREATE UNIQUE INDEX IF NOT EXISTS report_waste_weights_unique ON report_waste_weights (daily_report_id, waste_type_id);
