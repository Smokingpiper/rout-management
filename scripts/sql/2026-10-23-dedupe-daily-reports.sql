-- 日報の二重作成を防ぐ: 既存の重複をまとめてから、一意制約（部分ユニークインデックス）を作る。
-- Neon SQL Editor で、上から順に実行する。

-- ① 重複の確認（結果が0行なら重複なし。②は飛ばして③へ）
SELECT d.collection_type, d.report_date,
       CASE WHEN d.collection_type = 'regular' THEN d.route_id ELSE d.started_by END AS key_id,
       count(*) AS n, array_agg(d.id ORDER BY d.id) AS ids,
       array_agg(d.status::text ORDER BY d.id) AS statuses,
       array_agg(d.total_weight_kg ORDER BY d.id) AS weights
FROM daily_reports d
GROUP BY 1, 2, 3
HAVING count(*) > 1
ORDER BY 2 DESC;

-- ② 重複をまとめる（残す日報＝提出済みのもの優先 → GPS点が多いもの → id順。他の日報の軌跡・確認記録は残す日報に付け替える）
BEGIN;

CREATE TABLE _dedupe_map AS
SELECT id AS dup_id, keeper_id FROM (
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
) x WHERE rn > 1;

UPDATE route_track_points        c SET daily_report_id = m.keeper_id FROM _dedupe_map m WHERE c.daily_report_id = m.dup_id;
UPDATE spot_alert_acknowledgments c SET daily_report_id = m.keeper_id FROM _dedupe_map m WHERE c.daily_report_id = m.dup_id;
UPDATE missed_spot_overrides      c SET daily_report_id = m.keeper_id FROM _dedupe_map m WHERE c.daily_report_id = m.dup_id;
UPDATE report_visited_spots       c SET daily_report_id = m.keeper_id FROM _dedupe_map m WHERE c.daily_report_id = m.dup_id;
DELETE FROM daily_reports WHERE id IN (SELECT dup_id FROM _dedupe_map);

DROP TABLE _dedupe_map;
COMMIT;

-- ③ 一意制約を作る（通常回収=ルートごとに1日1件、早朝回収=ドライバーごとに1日1件）
CREATE UNIQUE INDEX IF NOT EXISTS daily_reports_regular_unique
  ON daily_reports (route_id, report_date) WHERE collection_type = 'regular';
CREATE UNIQUE INDEX IF NOT EXISTS daily_reports_early_unique
  ON daily_reports (started_by, report_date) WHERE collection_type = 'early';
