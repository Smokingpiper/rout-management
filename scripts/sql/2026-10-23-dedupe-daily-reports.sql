-- 日報の二重作成を防ぐ: 既存の重複をまとめてから、一意制約（部分ユニークインデックス）を作る。
-- Neon SQL Editor は1回に1つの文しか実行できない（BEGIN/COMMITで複数の文を並べると失敗する）ため、
-- ①②③⑷を1つずつ別々に実行すること。

-- ① 重複の確認（0行なら重複なし）
SELECT d.collection_type, d.report_date,
       CASE WHEN d.collection_type = 'regular' THEN d.route_id ELSE d.started_by END AS key_id,
       count(*) AS n, array_agg(d.id ORDER BY d.id) AS ids,
       array_agg(d.status::text ORDER BY d.id) AS statuses,
       array_agg(d.total_weight_kg ORDER BY d.id) AS weights
FROM daily_reports d
GROUP BY 1, 2, 3
HAVING count(*) > 1
ORDER BY 2 DESC;

-- ② 重複をまとめる（1つの文。残す日報＝提出済み優先 → GPS点が多いもの → id順。
--    他の日報の軌跡・確認記録は残す日報へ付け替える）
WITH ranked AS (
  SELECT d.id,
         row_number() OVER w AS rn,
         first_value(d.id) OVER w AS keeper_id
  FROM daily_reports d
  WINDOW w AS (
    PARTITION BY d.collection_type, d.report_date,
                 CASE WHEN d.collection_type = 'regular' THEN d.route_id ELSE d.started_by END
    ORDER BY (d.status::text <> 'in_progress') DESC,
             (SELECT count(*) FROM route_track_points t WHERE t.daily_report_id = d.id) DESC,
             d.id
  )
),
m AS (SELECT id AS dup_id, keeper_id FROM ranked WHERE rn > 1),
u1 AS (UPDATE route_track_points         c SET daily_report_id = m.keeper_id FROM m WHERE c.daily_report_id = m.dup_id RETURNING 1),
u2 AS (UPDATE spot_alert_acknowledgments c SET daily_report_id = m.keeper_id FROM m WHERE c.daily_report_id = m.dup_id RETURNING 1),
u3 AS (UPDATE missed_spot_overrides      c SET daily_report_id = m.keeper_id FROM m WHERE c.daily_report_id = m.dup_id RETURNING 1),
u4 AS (UPDATE report_visited_spots       c SET daily_report_id = m.keeper_id FROM m WHERE c.daily_report_id = m.dup_id RETURNING 1),
del AS (DELETE FROM daily_reports WHERE id IN (SELECT dup_id FROM m) RETURNING 1)
SELECT (SELECT count(*) FROM del) AS deleted_reports,
       (SELECT count(*) FROM u1) AS moved_track_points,
       (SELECT count(*) FROM u2) AS moved_alert_acks,
       (SELECT count(*) FROM u3) AS moved_overrides,
       (SELECT count(*) FROM u4) AS moved_visited_spots;

-- ③ 通常回収=ルートごとに1日1件
CREATE UNIQUE INDEX IF NOT EXISTS daily_reports_regular_unique
  ON daily_reports (route_id, report_date) WHERE collection_type = 'regular';

-- ⑷ 早朝回収=ドライバーごとに1日1件
CREATE UNIQUE INDEX IF NOT EXISTS daily_reports_early_unique
  ON daily_reports (started_by, report_date) WHERE collection_type = 'early';
