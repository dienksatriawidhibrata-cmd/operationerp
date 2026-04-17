const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const DATA_FILE = path.join(ROOT, 'src', 'data', 'kpi2026.js')
const OUT_FILE = path.join(ROOT, 'supabase', 'migrations', '004_kpi_reports.sql')

const MONTH_TO_DATE = {
  Jan: '2026-01-01',
  Feb: '2026-02-01',
  Mar: '2026-03-01',
}

function readKpiData() {
  const raw = fs.readFileSync(DATA_FILE, 'utf8')
  const prefix = 'export const KPI_2026 = '
  const start = raw.indexOf(prefix)
  if (start === -1) throw new Error('KPI_2026 export not found')
  const jsonText = raw.slice(start + prefix.length).trim()
  return JSON.parse(jsonText)
}

function sqlString(value) {
  return `'${String(value ?? '').replace(/'/g, "''")}'`
}

function sqlJson(value) {
  return `${sqlString(JSON.stringify(value ?? {}))}::jsonb`
}

function buildMetricPayload(data, storeName, month) {
  return {
    sales: data.sales?.[storeName]?.[month] || null,
    avg: data.avg?.[storeName]?.[month] || null,
    audit: data.audit?.[storeName]?.[month] ?? null,
    mysteryShopper: data.mysteryShoppers?.[storeName]?.[month] ?? null,
    large: data.large?.[storeName]?.[month] || null,
    oatside: data.oatside?.[storeName]?.[month] || null,
    bundling: data.bundling?.[storeName]?.[month] || null,
    complain: data.complain?.[storeName]?.[month] || null,
    retention: data.retention?.[storeName]?.[month] || null,
    hpp: data.hpp?.[storeName]?.[month] || null,
  }
}

function buildSeedRows(data) {
  const rows = []

  for (const month of data.availableMonths) {
    const monthData = data.monthly?.[month]
    if (!monthData) continue

    for (const store of monthData.stores || []) {
      const itemScores = Object.fromEntries(
        (monthData.itemKeys || []).map((key, index) => [key, store.scores?.[index] ?? null])
      )

      rows.push({
        storeShort: store.store,
        bulan: MONTH_TO_DATE[month],
        dmName: store.dm,
        totalScore: Number(store.total || 0),
        itemScores,
        metrics: buildMetricPayload(data, store.store, month),
      })
    }
  }

  return rows
}

function renderSql(data, rows) {
  const values = rows
    .map((row) => {
      return `  (
    ${sqlString(row.storeShort)},
    DATE ${sqlString(row.bulan)},
    ${sqlString(row.dmName)},
    ${row.totalScore},
    ${sqlJson(row.itemScores)},
    ${sqlJson(row.metrics)},
    DATE ${sqlString(data.lastUpdated)}
  )`
    })
    .join(',\n')

  return `-- ============================================================
-- BAGI KOPI OPS — KPI REPORTS
-- Generated from src/data/kpi2026.js
-- Run again with: node scripts/export-kpi-sql.cjs
-- ============================================================

CREATE TABLE IF NOT EXISTS kpi_monthly_reports (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id         UUID REFERENCES branches NOT NULL,
  bulan             DATE NOT NULL,
  dm_name           TEXT NOT NULL,
  total_score       NUMERIC(7,4) NOT NULL DEFAULT 0,
  item_scores       JSONB NOT NULL DEFAULT '{}'::jsonb,
  metrics           JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_updated_at DATE,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE(branch_id, bulan)
);

CREATE INDEX IF NOT EXISTS idx_kpi_monthly_reports_bulan ON kpi_monthly_reports (bulan DESC);
CREATE INDEX IF NOT EXISTS idx_kpi_monthly_reports_branch ON kpi_monthly_reports (branch_id);

ALTER TABLE kpi_monthly_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kpi_monthly_reports_select" ON kpi_monthly_reports;
CREATE POLICY "kpi_monthly_reports_select" ON kpi_monthly_reports
  FOR SELECT TO authenticated
  USING (
    my_role() IN ('staff','asst_head_store','head_store','district_manager','area_manager','ops_manager')
    AND can_access_branch(branch_id)
  );

DROP POLICY IF EXISTS "kpi_monthly_reports_manage" ON kpi_monthly_reports;
CREATE POLICY "kpi_monthly_reports_manage" ON kpi_monthly_reports
  FOR ALL TO authenticated
  USING (my_role() = 'ops_manager')
  WITH CHECK (my_role() = 'ops_manager');

WITH seed (
  store_short,
  bulan,
  dm_name,
  total_score,
  item_scores,
  metrics,
  source_updated_at
) AS (
VALUES
${values}
)
INSERT INTO kpi_monthly_reports (
  branch_id,
  bulan,
  dm_name,
  total_score,
  item_scores,
  metrics,
  source_updated_at
)
SELECT
  b.id,
  seed.bulan,
  seed.dm_name,
  seed.total_score,
  seed.item_scores,
  seed.metrics,
  seed.source_updated_at
FROM seed
JOIN branches b
  ON lower(regexp_replace(b.name, '^Bagi Kopi\\s+', '')) = lower(seed.store_short)
ON CONFLICT (branch_id, bulan) DO UPDATE SET
  dm_name = EXCLUDED.dm_name,
  total_score = EXCLUDED.total_score,
  item_scores = EXCLUDED.item_scores,
  metrics = EXCLUDED.metrics,
  source_updated_at = EXCLUDED.source_updated_at,
  updated_at = now();
`
}

const data = readKpiData()
const rows = buildSeedRows(data)
const sql = renderSql(data, rows)

fs.writeFileSync(OUT_FILE, sql, 'utf8')

console.log(`Written ${rows.length} KPI rows -> ${OUT_FILE}`)
