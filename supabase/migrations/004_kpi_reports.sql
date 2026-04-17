-- ============================================================
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
  (
    'Kranggan',
    DATE '2026-01-01',
    'Nadine',
    0.89,
    '{"Net Sales":4,"AVG":5,"Large":4,"Oatside":5,"Snack Platter":3,"B. Asik":5,"Audit":5,"M. Shopper":5,"Complain":5}'::jsonb,
    '{"sales":{"target":320000000,"actual":314527882},"avg":{"target":55000,"actual":58267},"audit":90.04,"mysteryShopper":5,"large":{"small":2622,"large":3817,"total":6439,"rate":0.5928},"oatside":{"drinks":7878,"oat":932,"rate":0.1183},"bundling":{"total":2709,"asik":144,"rate":0.0532},"complain":{"trx":5398,"count":4,"rate":0.000741},"retention":{"total":16,"resign":0,"rate":0},"hpp":{"gross":333725473,"hpp":156221807,"rate":0.4681}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Kota Wisata',
    DATE '2026-01-01',
    'Nadine',
    0.87,
    '{"Net Sales":5,"AVG":5,"Large":5,"Oatside":5,"Snack Platter":4,"B. Asik":4,"Audit":4,"M. Shopper":5,"Complain":1}'::jsonb,
    '{"sales":{"target":170000000,"actual":172679392},"avg":{"target":55000,"actual":57273},"audit":86.11,"mysteryShopper":5,"large":{"small":1236,"large":3022,"total":4258,"rate":0.7097},"oatside":{"drinks":4310,"oat":702,"rate":0.1629},"bundling":{"total":1289,"asik":55,"rate":0.0427},"complain":{"trx":3015,"count":5,"rate":0.001658},"retention":{"total":10,"resign":0,"rate":0},"hpp":{"gross":177989781,"hpp":81876709,"rate":0.46}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Metro',
    DATE '2026-01-01',
    'Risti',
    0.85,
    '{"Net Sales":5,"AVG":4,"Large":1,"Oatside":5,"Snack Platter":2,"B. Asik":2,"Audit":4,"M. Shopper":5,"Complain":5}'::jsonb,
    '{"sales":{"target":145000000,"actual":146225634},"avg":{"target":55000,"actual":53858},"audit":88.31,"mysteryShopper":4.58,"large":{"small":1612,"large":1229,"total":2841,"rate":0.4326},"oatside":{"drinks":3659,"oat":549,"rate":0.15},"bundling":{"total":1391,"asik":31,"rate":0.0223},"complain":{"trx":2715,"count":1,"rate":0.000368},"retention":{"total":7,"resign":0,"rate":0},"hpp":{"gross":156045631,"hpp":69694693,"rate":0.4466}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Kiara Artha',
    DATE '2026-01-01',
    'Risti',
    0.84,
    '{"Net Sales":5,"AVG":4,"Large":1,"Oatside":5,"Snack Platter":1,"B. Asik":2,"Audit":4,"M. Shopper":5,"Complain":5}'::jsonb,
    '{"sales":{"target":180000000,"actual":199659046},"avg":{"target":55000,"actual":53889},"audit":86.89,"mysteryShopper":4.38,"large":{"small":2864,"large":1957,"total":4821,"rate":0.4059},"oatside":{"drinks":5355,"oat":892,"rate":0.1666},"bundling":{"total":1563,"asik":38,"rate":0.0243},"complain":{"trx":3705,"count":1,"rate":0.00027},"retention":{"total":12,"resign":1,"rate":0.0833},"hpp":{"gross":208840087,"hpp":93756063,"rate":0.4489}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Cimahi',
    DATE '2026-01-01',
    'Sohib',
    0.75,
    '{"Net Sales":4,"AVG":5,"Large":1,"Oatside":5,"Snack Platter":2,"B. Asik":1,"Audit":3,"M. Shopper":5,"Complain":5}'::jsonb,
    '{"sales":{"target":340000000,"actual":335336105},"avg":{"target":55000,"actual":55492},"audit":82.59,"mysteryShopper":4.32,"large":{"small":4030,"large":2801,"total":6831,"rate":0.41},"oatside":{"drinks":8448,"oat":1108,"rate":0.1312},"bundling":{"total":2749,"asik":39,"rate":0.0142},"complain":{"trx":6043,"count":0,"rate":0},"retention":{"total":15,"resign":1,"rate":0.0667},"hpp":{"gross":344612180,"hpp":159821336,"rate":0.4638}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Ujung Berung',
    DATE '2026-01-01',
    'Risti',
    0.68,
    '{"Net Sales":3,"AVG":5,"Large":2,"Oatside":5,"Snack Platter":2,"B. Asik":2,"Audit":4,"M. Shopper":5,"Complain":3}'::jsonb,
    '{"sales":{"target":275000000,"actual":266147448},"avg":{"target":55000,"actual":56102},"audit":86.03,"mysteryShopper":3.96,"large":{"small":3024,"large":2663,"total":5687,"rate":0.4683},"oatside":{"drinks":6157,"oat":1545,"rate":0.2509},"bundling":{"total":2322,"asik":51,"rate":0.022},"complain":{"trx":4744,"count":7,"rate":0.001476},"retention":{"total":14,"resign":1,"rate":0.0714},"hpp":{"gross":284141517,"hpp":130373387,"rate":0.4588}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Peta',
    DATE '2026-01-01',
    'Sohib',
    0.68,
    '{"Net Sales":3,"AVG":4,"Large":1,"Oatside":5,"Snack Platter":2,"B. Asik":1,"Audit":4,"M. Shopper":5,"Complain":5}'::jsonb,
    '{"sales":{"target":310000000,"actual":299781881},"avg":{"target":55000,"actual":54625},"audit":87.95,"mysteryShopper":4.31,"large":{"small":3750,"large":2598,"total":6348,"rate":0.4093},"oatside":{"drinks":7087,"oat":1622,"rate":0.2289},"bundling":{"total":2445,"asik":46,"rate":0.0188},"complain":{"trx":5488,"count":3,"rate":0.000547},"retention":{"total":16,"resign":0,"rate":0},"hpp":{"gross":316763987,"hpp":144600494,"rate":0.4565}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Kalimalang',
    DATE '2026-01-01',
    'Bagas',
    0.68,
    '{"Net Sales":4,"AVG":5,"Large":1,"Oatside":1,"Snack Platter":1,"B. Asik":1,"Audit":3,"M. Shopper":5,"Complain":4}'::jsonb,
    '{"sales":{"target":425000000,"actual":420660123},"avg":{"target":55000,"actual":56785},"audit":82,"mysteryShopper":4.9,"large":{"small":5474,"large":4312,"total":9786,"rate":0.4406},"oatside":{"drinks":11468,"oat":87,"rate":0.0076},"bundling":{"total":3486,"asik":46,"rate":0.0132},"complain":{"trx":7408,"count":8,"rate":0.00108},"retention":{"total":15,"resign":0,"rate":0},"hpp":{"gross":427922298,"hpp":201377149,"rate":0.4706}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Ciledug',
    DATE '2026-01-01',
    'Ryan',
    0.67,
    '{"Net Sales":4,"AVG":5,"Large":1,"Oatside":1,"Snack Platter":1,"B. Asik":1,"Audit":2,"M. Shopper":5,"Complain":5}'::jsonb,
    '{"sales":{"target":330000000,"actual":329784772},"avg":{"target":55000,"actual":59917},"audit":79.5,"mysteryShopper":5,"large":{"small":4081,"large":3320,"total":7401,"rate":0.4486},"oatside":{"drinks":9350,"oat":135,"rate":0.0144},"bundling":{"total":2624,"asik":46,"rate":0.0175},"complain":{"trx":5504,"count":4,"rate":0.000727},"retention":{"total":14,"resign":1,"rate":0.0714},"hpp":{"gross":331089547,"hpp":156619357,"rate":0.473}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Melong',
    DATE '2026-01-01',
    'Sohib',
    0.66,
    '{"Net Sales":4,"AVG":1,"Large":1,"Oatside":5,"Snack Platter":1,"B. Asik":1,"Audit":3,"M. Shopper":5,"Complain":5}'::jsonb,
    '{"sales":{"target":150000000,"actual":146659740},"avg":{"target":55000,"actual":47310},"audit":84.62,"mysteryShopper":4.48,"large":{"small":1756,"large":985,"total":2741,"rate":0.3594},"oatside":{"drinks":4290,"oat":529,"rate":0.1233},"bundling":{"total":1389,"asik":25,"rate":0.018},"complain":{"trx":3100,"count":0,"rate":0},"retention":{"total":8,"resign":0,"rate":0},"hpp":{"gross":157612789,"hpp":72101113,"rate":0.4575}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Lebak Bulus',
    DATE '2026-01-01',
    'Bagas',
    0.61,
    '{"Net Sales":3,"AVG":2,"Large":2,"Oatside":5,"Snack Platter":1,"B. Asik":1,"Audit":3,"M. Shopper":5,"Complain":5}'::jsonb,
    '{"sales":{"target":145000000,"actual":138339449},"avg":{"target":55000,"actual":51389},"audit":82.88,"mysteryShopper":4.7,"large":{"small":802,"large":722,"total":1524,"rate":0.4738},"oatside":{"drinks":3873,"oat":201,"rate":0.0519},"bundling":{"total":1040,"asik":0,"rate":0},"complain":{"trx":2692,"count":1,"rate":0.000371},"retention":{"total":9,"resign":0,"rate":0},"hpp":{"gross":140197587,"hpp":66583598,"rate":0.4749}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Pekayon',
    DATE '2026-01-01',
    'Nadine',
    0.57,
    '{"Net Sales":2,"AVG":5,"Large":2,"Oatside":1,"Snack Platter":2,"B. Asik":2,"Audit":3,"M. Shopper":5,"Complain":5}'::jsonb,
    '{"sales":{"target":240000000,"actual":225520618},"avg":{"target":55000,"actual":63171},"audit":81.43,"mysteryShopper":5,"large":{"small":2859,"large":2356,"total":5215,"rate":0.4518},"oatside":{"drinks":6352,"oat":105,"rate":0.0165},"bundling":{"total":1678,"asik":41,"rate":0.0244},"complain":{"trx":3570,"count":3,"rate":0.00084},"retention":{"total":13,"resign":0,"rate":0},"hpp":{"gross":231746016,"hpp":106381309,"rate":0.459}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Setu Cipayung',
    DATE '2026-01-01',
    'Bagas',
    0.56,
    '{"Net Sales":2,"AVG":4,"Large":1,"Oatside":4,"Snack Platter":2,"B. Asik":1,"Audit":3,"M. Shopper":5,"Complain":5}'::jsonb,
    '{"sales":{"target":230000000,"actual":217597884},"avg":{"target":55000,"actual":54838},"audit":83.02,"mysteryShopper":4.26,"large":{"small":2921,"large":2142,"total":5063,"rate":0.4231},"oatside":{"drinks":5947,"oat":242,"rate":0.0407},"bundling":{"total":1806,"asik":27,"rate":0.015},"complain":{"trx":3968,"count":0,"rate":0},"retention":{"total":14,"resign":0,"rate":0},"hpp":{"gross":224297341,"hpp":102938351,"rate":0.4589}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Lenteng Agung',
    DATE '2026-01-01',
    'Nadine',
    0.56,
    '{"Net Sales":2,"AVG":2,"Large":1,"Oatside":5,"Snack Platter":2,"B. Asik":1,"Audit":4,"M. Shopper":5,"Complain":5}'::jsonb,
    '{"sales":{"target":240000000,"actual":220771426},"avg":{"target":55000,"actual":49645},"audit":89.47,"mysteryShopper":4.9,"large":{"small":2821,"large":2223,"total":5044,"rate":0.4407},"oatside":{"drinks":5955,"oat":506,"rate":0.085},"bundling":{"total":2166,"asik":34,"rate":0.0157},"complain":{"trx":4447,"count":1,"rate":0.000225},"retention":{"total":12,"resign":1,"rate":0.0833},"hpp":{"gross":226598964,"hpp":110291299,"rate":0.4867}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Jatinangor',
    DATE '2026-01-01',
    'Risti',
    0.55,
    '{"Net Sales":1,"AVG":5,"Large":1,"Oatside":5,"Snack Platter":2,"B. Asik":2,"Audit":4,"M. Shopper":5,"Complain":5}'::jsonb,
    '{"sales":{"target":225000000,"actual":153420086},"avg":{"target":55000,"actual":59053},"audit":89.73,"mysteryShopper":4.56,"large":{"small":1708,"large":1332,"total":3040,"rate":0.4382},"oatside":{"drinks":3668,"oat":630,"rate":0.1718},"bundling":{"total":1247,"asik":27,"rate":0.0217},"complain":{"trx":2598,"count":1,"rate":0.000385},"retention":{"total":13,"resign":1,"rate":0.0769},"hpp":{"gross":163085837,"hpp":77284891,"rate":0.4739}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Pengumben',
    DATE '2026-01-01',
    'Bagas',
    0.53,
    '{"Net Sales":1,"AVG":5,"Large":2,"Oatside":5,"Snack Platter":2,"B. Asik":1,"Audit":4,"M. Shopper":5,"Complain":4}'::jsonb,
    '{"sales":{"target":235000000,"actual":208003840},"avg":{"target":55000,"actual":57795},"audit":85.36,"mysteryShopper":5,"large":{"small":2574,"large":2156,"total":4730,"rate":0.4558},"oatside":{"drinks":5278,"oat":559,"rate":0.1059},"bundling":{"total":1475,"asik":19,"rate":0.0129},"complain":{"trx":3599,"count":4,"rate":0.001111},"retention":{"total":10,"resign":0,"rate":0},"hpp":{"gross":211490006,"hpp":101706155,"rate":0.4809}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Margonda',
    DATE '2026-01-01',
    'Nadine',
    0.52,
    '{"Net Sales":2,"AVG":2,"Large":1,"Oatside":3,"Snack Platter":2,"B. Asik":2,"Audit":3,"M. Shopper":5,"Complain":5}'::jsonb,
    '{"sales":{"target":260000000,"actual":242197236},"avg":{"target":55000,"actual":51996},"audit":81.89,"mysteryShopper":5,"large":{"small":3450,"large":2509,"total":5959,"rate":0.421},"oatside":{"drinks":7054,"oat":218,"rate":0.0309},"bundling":{"total":2072,"asik":60,"rate":0.029},"complain":{"trx":4658,"count":1,"rate":0.000215},"retention":{"total":13,"resign":0,"rate":0},"hpp":{"gross":251714439,"hpp":116613748,"rate":0.4633}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Buah Batu',
    DATE '2026-01-01',
    'Risti',
    0.52,
    '{"Net Sales":2,"AVG":5,"Large":1,"Oatside":5,"Snack Platter":1,"B. Asik":1,"Audit":1,"M. Shopper":5,"Complain":5}'::jsonb,
    '{"sales":{"target":320000000,"actual":296807050},"avg":{"target":55000,"actual":56309},"audit":70.88,"mysteryShopper":4.28,"large":{"small":4107,"large":2848,"total":6955,"rate":0.4095},"oatside":{"drinks":8448,"oat":630,"rate":0.0746},"bundling":{"total":2280,"asik":22,"rate":0.0096},"complain":{"trx":5271,"count":4,"rate":0.000759},"retention":{"total":17,"resign":1,"rate":0.0588},"hpp":{"gross":305563269,"hpp":141653624,"rate":0.4636}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Kemang Utara',
    DATE '2026-01-01',
    'Bagas',
    0.49,
    '{"Net Sales":2,"AVG":5,"Large":1,"Oatside":1,"Snack Platter":1,"B. Asik":2,"Audit":1,"M. Shopper":5,"Complain":5}'::jsonb,
    '{"sales":{"target":350000000,"actual":332121353},"avg":{"target":55000,"actual":56608},"audit":73.32,"mysteryShopper":5,"large":{"small":4320,"large":3531,"total":7851,"rate":0.4498},"oatside":{"drinks":10015,"oat":77,"rate":0.0077},"bundling":{"total":2925,"asik":64,"rate":0.0219},"complain":{"trx":5867,"count":4,"rate":0.000682},"retention":{"total":16,"resign":0,"rate":0},"hpp":{"gross":335442145,"hpp":156754746,"rate":0.4673}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Ciputat Jombang',
    DATE '2026-01-01',
    'Ryan',
    0.47,
    '{"Net Sales":1,"AVG":2,"Large":1,"Oatside":3,"Snack Platter":2,"B. Asik":2,"Audit":4,"M. Shopper":5,"Complain":5}'::jsonb,
    '{"sales":{"target":210000000,"actual":187113298},"avg":{"target":55000,"actual":51947},"audit":85.38,"mysteryShopper":5,"large":{"small":2584,"large":1514,"total":4098,"rate":0.3694},"oatside":{"drinks":5217,"oat":173,"rate":0.0332},"bundling":{"total":1578,"asik":47,"rate":0.0298},"complain":{"trx":3602,"count":2,"rate":0.000555},"retention":{"total":11,"resign":0,"rate":0},"hpp":{"gross":194033495,"hpp":90313794,"rate":0.4655}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Pamulang',
    DATE '2026-01-01',
    'Ryan',
    0.44,
    '{"Net Sales":1,"AVG":5,"Large":1,"Oatside":2,"Snack Platter":1,"B. Asik":1,"Audit":2,"M. Shopper":5,"Complain":5}'::jsonb,
    '{"sales":{"target":200000000,"actual":173049992},"avg":{"target":55000,"actual":59427},"audit":78.92,"mysteryShopper":4.9,"large":{"small":2390,"large":1564,"total":3954,"rate":0.3955},"oatside":{"drinks":4868,"oat":100,"rate":0.0205},"bundling":{"total":1488,"asik":22,"rate":0.0148},"complain":{"trx":2912,"count":1,"rate":0.000343},"retention":{"total":12,"resign":0,"rate":0},"hpp":{"gross":177250971,"hpp":88166322,"rate":0.4974}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Cilandak Barat',
    DATE '2026-01-01',
    'Bagas',
    0.44,
    '{"Net Sales":1,"AVG":2,"Large":3,"Oatside":5,"Snack Platter":2,"B. Asik":1,"Audit":2,"M. Shopper":5,"Complain":5}'::jsonb,
    '{"sales":{"target":105000000,"actual":84712958},"avg":{"target":55000,"actual":52227},"audit":76.86,"mysteryShopper":4.9,"large":{"small":858,"large":872,"total":1730,"rate":0.504},"oatside":{"drinks":2297,"oat":180,"rate":0.0784},"bundling":{"total":838,"asik":6,"rate":0.0072},"complain":{"trx":1622,"count":1,"rate":0.000617},"retention":{"total":10,"resign":0,"rate":0},"hpp":{"gross":87433146,"hpp":41318613,"rate":0.4726}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Cawang',
    DATE '2026-01-01',
    'Bagas',
    0.42,
    '{"Net Sales":1,"AVG":4,"Large":1,"Oatside":5,"Snack Platter":2,"B. Asik":1,"Audit":2,"M. Shopper":5,"Complain":3}'::jsonb,
    '{"sales":{"target":245000000,"actual":210611522},"avg":{"target":55000,"actual":54478},"audit":78.76,"mysteryShopper":4.95,"large":{"small":2915,"large":2244,"total":5159,"rate":0.435},"oatside":{"drinks":5686,"oat":392,"rate":0.0689},"bundling":{"total":1475,"asik":29,"rate":0.0197},"complain":{"trx":3866,"count":5,"rate":0.001293},"retention":{"total":13,"resign":0,"rate":0},"hpp":{"gross":216452296,"hpp":100966290,"rate":0.4665}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Ciumbuleuit',
    DATE '2026-01-01',
    'Sohib',
    0.41,
    '{"Net Sales":1,"AVG":1,"Large":2,"Oatside":5,"Snack Platter":1,"B. Asik":2,"Audit":2,"M. Shopper":5,"Complain":5}'::jsonb,
    '{"sales":{"target":282000000,"actual":228555370},"avg":{"target":55000,"actual":46999},"audit":78.84,"mysteryShopper":4.42,"large":{"small":2780,"large":2449,"total":5229,"rate":0.4683},"oatside":{"drinks":6625,"oat":496,"rate":0.0749},"bundling":{"total":1829,"asik":37,"rate":0.0202},"complain":{"trx":4863,"count":0,"rate":0},"retention":{"total":13,"resign":3,"rate":0.2308},"hpp":{"gross":242624723,"hpp":118174990,"rate":0.4871}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Ciputat Juanda',
    DATE '2026-01-01',
    'Ryan',
    0.41,
    '{"Net Sales":1,"AVG":1,"Large":2,"Oatside":2,"Snack Platter":2,"B. Asik":1,"Audit":3,"M. Shopper":5,"Complain":5}'::jsonb,
    '{"sales":{"target":185000000,"actual":138853818},"avg":{"target":55000,"actual":49082},"audit":84.63,"mysteryShopper":4.96,"large":{"small":1817,"large":1493,"total":3310,"rate":0.4511},"oatside":{"drinks":4228,"oat":105,"rate":0.0248},"bundling":{"total":1090,"asik":21,"rate":0.0193},"complain":{"trx":2829,"count":2,"rate":0.000707},"retention":{"total":13,"resign":0,"rate":0},"hpp":{"gross":145741256,"hpp":69920652,"rate":0.4798}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Karawaci',
    DATE '2026-01-01',
    'Ryan',
    0.38,
    '{"Net Sales":1,"AVG":5,"Large":1,"Oatside":1,"Snack Platter":1,"B. Asik":1,"Audit":1,"M. Shopper":5,"Complain":4}'::jsonb,
    '{"sales":{"target":200000000,"actual":158190541},"avg":{"target":55000,"actual":57047},"audit":72.65,"mysteryShopper":4.95,"large":{"small":2236,"large":1419,"total":3655,"rate":0.3882},"oatside":{"drinks":4483,"oat":57,"rate":0.0127},"bundling":{"total":1320,"asik":16,"rate":0.0121},"complain":{"trx":2773,"count":3,"rate":0.001082},"retention":{"total":12,"resign":2,"rate":0.1667},"hpp":{"gross":163327660,"hpp":74858734,"rate":0.4583}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Bintaro',
    DATE '2026-01-01',
    'Ryan',
    0.36,
    '{"Net Sales":1,"AVG":1,"Large":1,"Oatside":3,"Snack Platter":2,"B. Asik":1,"Audit":2,"M. Shopper":5,"Complain":4}'::jsonb,
    '{"sales":{"target":275000000,"actual":113030114},"avg":{"target":55000,"actual":46343},"audit":75.55,"mysteryShopper":4.75,"large":{"small":1601,"large":1039,"total":2640,"rate":0.3936},"oatside":{"drinks":3349,"oat":107,"rate":0.0319},"bundling":{"total":1026,"asik":19,"rate":0.0185},"complain":{"trx":2439,"count":3,"rate":0.00123},"retention":{"total":6,"resign":1,"rate":0.1667},"hpp":{"gross":117863358,"hpp":55079213,"rate":0.4673}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Margorejo',
    DATE '2026-01-01',
    'Ismail',
    0.35,
    '{"Net Sales":1,"AVG":1,"Large":1,"Oatside":1,"Snack Platter":1,"B. Asik":1,"Audit":2,"M. Shopper":5,"Complain":5}'::jsonb,
    '{"sales":{"target":95000000,"actual":69736127},"avg":{"target":55000,"actual":43504},"audit":79.52,"mysteryShopper":5,"large":{"small":1087,"large":806,"total":1893,"rate":0.4258},"oatside":{"drinks":2364,"oat":14,"rate":0.0059},"bundling":{"total":658,"asik":5,"rate":0.0076},"complain":{"trx":1603,"count":0,"rate":0},"retention":{"total":6,"resign":0,"rate":0},"hpp":{"gross":72955697,"hpp":36656056,"rate":0.5024}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Kayu Putih',
    DATE '2026-01-01',
    'Bagas',
    0.33,
    '{"Net Sales":1,"AVG":1,"Large":1,"Oatside":1,"Snack Platter":1,"B. Asik":1,"Audit":2,"M. Shopper":5,"Complain":4}'::jsonb,
    '{"sales":{"target":160000000,"actual":143275206},"avg":{"target":55000,"actual":47902},"audit":76.82,"mysteryShopper":5,"large":{"small":1999,"large":1596,"total":3595,"rate":0.4439},"oatside":{"drinks":4470,"oat":25,"rate":0.0056},"bundling":{"total":1141,"asik":14,"rate":0.0123},"complain":{"trx":2991,"count":3,"rate":0.001003},"retention":{"total":8,"resign":0,"rate":0},"hpp":{"gross":146155608,"hpp":69957761,"rate":0.4787}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Citraland',
    DATE '2026-01-01',
    'Ismail',
    0.3,
    '{"Net Sales":1,"AVG":1,"Large":1,"Oatside":1,"Snack Platter":1,"B. Asik":1,"Audit":1,"M. Shopper":5,"Complain":4}'::jsonb,
    '{"sales":{"target":225000000,"actual":189346845},"avg":{"target":55000,"actual":47420},"audit":69.45,"mysteryShopper":5,"large":{"small":3240,"large":2117,"total":5357,"rate":0.3952},"oatside":{"drinks":6256,"oat":10,"rate":0.0016},"bundling":{"total":1655,"asik":4,"rate":0.0024},"complain":{"trx":3993,"count":4,"rate":0.001002},"retention":{"total":13,"resign":0,"rate":0},"hpp":{"gross":196894389,"hpp":87873248,"rate":0.4463}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Ujung Berung',
    DATE '2026-02-01',
    'Risti',
    0.92,
    '{"Net Sales":5,"AVG":5,"Large":2,"Oatside":5,"Add On Telur":5,"B. Asik":3,"Audit":4,"M. Shopper":5,"Complain":5}'::jsonb,
    '{"sales":{"target":220000000,"actual":222853058},"avg":{"target":55000,"actual":57083},"audit":88.21,"mysteryShopper":3.96,"large":{"small":2466,"large":2161,"total":4627,"rate":0.467},"oatside":{"drinks":2666,"oat":1215,"rate":0.4557},"bundling":{"total":968,"asik":36,"rate":0.0372},"complain":{"trx":3904,"count":1,"rate":0.000256},"retention":{"total":15,"resign":2,"rate":0.1333},"hpp":{"gross":239046312,"hpp":111051624,"rate":0.4646}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Cimahi',
    DATE '2026-02-01',
    'Sohib',
    0.87,
    '{"Net Sales":5,"AVG":5,"Large":1,"Oatside":5,"Add On Telur":2,"B. Asik":2,"Audit":4,"M. Shopper":5,"Complain":5}'::jsonb,
    '{"sales":{"target":260000000,"actual":290748668},"avg":{"target":55000,"actual":56434},"audit":86.28,"mysteryShopper":4.63,"large":{"small":3543,"large":2364,"total":5907,"rate":0.4002},"oatside":{"drinks":3531,"oat":879,"rate":0.2489},"bundling":{"total":1109,"asik":29,"rate":0.0261},"complain":{"trx":5152,"count":5,"rate":0.00097},"retention":{"total":15,"resign":2,"rate":0.1333},"hpp":{"gross":302667043,"hpp":141536904,"rate":0.4676}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Lenteng Agung',
    DATE '2026-02-01',
    'Nadine',
    0.86,
    '{"Net Sales":4,"AVG":3,"Large":5,"Oatside":5,"Add On Telur":5,"B. Asik":3,"Audit":5,"M. Shopper":5,"Complain":5}'::jsonb,
    '{"sales":{"target":195000000,"actual":192467933},"avg":{"target":55000,"actual":53139},"audit":92.03,"mysteryShopper":5,"large":{"small":1576,"large":2619,"total":4195,"rate":0.6243},"oatside":{"drinks":2487,"oat":685,"rate":0.2754},"bundling":{"total":858,"asik":34,"rate":0.0396},"complain":{"trx":3622,"count":0,"rate":0},"retention":{"total":12,"resign":0,"rate":0},"hpp":{"gross":204873145,"hpp":91740625,"rate":0.4478}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Metro',
    DATE '2026-02-01',
    'Risti',
    0.82,
    '{"Net Sales":5,"AVG":2,"Large":1,"Oatside":5,"Add On Telur":2,"B. Asik":3,"Audit":4,"M. Shopper":5,"Complain":5}'::jsonb,
    '{"sales":{"target":120000000,"actual":120927995},"avg":{"target":55000,"actual":49826},"audit":87.36,"mysteryShopper":4.23,"large":{"small":1375,"large":887,"total":2262,"rate":0.3921},"oatside":{"drinks":1237,"oat":491,"rate":0.3969},"bundling":{"total":464,"asik":15,"rate":0.0323},"complain":{"trx":2427,"count":1,"rate":0.000412},"retention":{"total":7,"resign":1,"rate":0.1429},"hpp":{"gross":131913713,"hpp":64371607,"rate":0.488}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Margonda',
    DATE '2026-02-01',
    'Nadine',
    0.78,
    '{"Net Sales":4,"AVG":4,"Large":1,"Oatside":5,"Add On Telur":3,"B. Asik":5,"Audit":3,"M. Shopper":5,"Complain":5}'::jsonb,
    '{"sales":{"target":220000000,"actual":218770351},"avg":{"target":55000,"actual":54191},"audit":82,"mysteryShopper":5,"large":{"small":3225,"large":2154,"total":5379,"rate":0.4004},"oatside":{"drinks":3627,"oat":369,"rate":0.1017},"bundling":{"total":966,"asik":50,"rate":0.0518},"complain":{"trx":4037,"count":0,"rate":0},"retention":{"total":12,"resign":0,"rate":0},"hpp":{"gross":233757598,"hpp":108051532,"rate":0.4622}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Melong',
    DATE '2026-02-01',
    'Sohib',
    0.77,
    '{"Net Sales":5,"AVG":1,"Large":1,"Oatside":5,"Add On Telur":1,"B. Asik":4,"Audit":3,"M. Shopper":5,"Complain":5}'::jsonb,
    '{"sales":{"target":130000000,"actual":133582293},"avg":{"target":55000,"actual":48155},"audit":84.57,"mysteryShopper":4.21,"large":{"small":1457,"large":974,"total":2431,"rate":0.4007},"oatside":{"drinks":1367,"oat":438,"rate":0.3204},"bundling":{"total":302,"asik":14,"rate":0.0464},"complain":{"trx":2774,"count":2,"rate":0.000721},"retention":{"total":8,"resign":0,"rate":0},"hpp":{"gross":144162932,"hpp":66336970,"rate":0.4602}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Kranggan',
    DATE '2026-02-01',
    'Nadine',
    0.64,
    '{"Net Sales":1,"AVG":5,"Large":5,"Oatside":5,"Add On Telur":5,"B. Asik":4,"Audit":4,"M. Shopper":5,"Complain":5}'::jsonb,
    '{"sales":{"target":300000000,"actual":268122070},"avg":{"target":55000,"actual":58580},"audit":87.58,"mysteryShopper":5,"large":{"small":1229,"large":4130,"total":5359,"rate":0.7707},"oatside":{"drinks":2906,"oat":1046,"rate":0.3599},"bundling":{"total":1194,"asik":52,"rate":0.0436},"complain":{"trx":4577,"count":1,"rate":0.000218},"retention":{"total":15,"resign":0,"rate":0},"hpp":{"gross":296158878,"hpp":135668110,"rate":0.4581}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Kiara Artha',
    DATE '2026-02-01',
    'Risti',
    0.63,
    '{"Net Sales":2,"AVG":4,"Large":1,"Oatside":5,"Add On Telur":3,"B. Asik":3,"Audit":4,"M. Shopper":5,"Complain":5}'::jsonb,
    '{"sales":{"target":170000000,"actual":153898884},"avg":{"target":55000,"actual":53698},"audit":87.41,"mysteryShopper":4.65,"large":{"small":2202,"large":1474,"total":3676,"rate":0.401},"oatside":{"drinks":2043,"oat":644,"rate":0.3152},"bundling":{"total":509,"asik":19,"rate":0.0373},"complain":{"trx":2866,"count":1,"rate":0.000349},"retention":{"total":10,"resign":1,"rate":0.1},"hpp":{"gross":161556736,"hpp":77066799,"rate":0.477}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Peta',
    DATE '2026-02-01',
    'Sohib',
    0.63,
    '{"Net Sales":2,"AVG":5,"Large":1,"Oatside":5,"Add On Telur":2,"B. Asik":4,"Audit":4,"M. Shopper":5,"Complain":4}'::jsonb,
    '{"sales":{"target":270000000,"actual":254030403},"avg":{"target":55000,"actual":55164},"audit":87.85,"mysteryShopper":3.36,"large":{"small":3031,"large":2324,"total":5355,"rate":0.434},"oatside":{"drinks":3038,"oat":1065,"rate":0.3506},"bundling":{"total":1118,"asik":49,"rate":0.0438},"complain":{"trx":4605,"count":5,"rate":0.001086},"retention":{"total":16,"resign":0,"rate":0},"hpp":{"gross":270969538,"hpp":128485870,"rate":0.4742}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Kota Wisata',
    DATE '2026-02-01',
    'Nadine',
    0.62,
    '{"Net Sales":2,"AVG":5,"Large":5,"Oatside":5,"Add On Telur":5,"B. Asik":5,"Audit":3,"M. Shopper":5,"Complain":1}'::jsonb,
    '{"sales":{"target":160000000,"actual":145140653},"avg":{"target":55000,"actual":59802},"audit":83.42,"mysteryShopper":5,"large":{"small":1107,"large":2287,"total":3394,"rate":0.6738},"oatside":{"drinks":1719,"oat":675,"rate":0.3927},"bundling":{"total":376,"asik":46,"rate":0.1223},"complain":{"trx":2427,"count":6,"rate":0.002472},"retention":{"total":8,"resign":0,"rate":0},"hpp":{"gross":151311187,"hpp":70399205,"rate":0.4653}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Jatinangor',
    DATE '2026-02-01',
    'Risti',
    0.59,
    '{"Net Sales":1,"AVG":5,"Large":1,"Oatside":5,"Add On Telur":3,"B. Asik":2,"Audit":5,"M. Shopper":5,"Complain":5}'::jsonb,
    '{"sales":{"target":240000000,"actual":153550620},"avg":{"target":55000,"actual":60004},"audit":93.33,"mysteryShopper":4.38,"large":{"small":1740,"large":1194,"total":2934,"rate":0.407},"oatside":{"drinks":1805,"oat":528,"rate":0.2925},"bundling":{"total":938,"asik":25,"rate":0.0267},"complain":{"trx":2559,"count":0,"rate":0},"retention":{"total":14,"resign":2,"rate":0.1429},"hpp":{"gross":167022088,"hpp":74280552,"rate":0.4447}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Buah Batu',
    DATE '2026-02-01',
    'Risti',
    0.52,
    '{"Net Sales":1,"AVG":5,"Large":1,"Oatside":5,"Add On Telur":1,"B. Asik":3,"Audit":3,"M. Shopper":5,"Complain":5}'::jsonb,
    '{"sales":{"target":305000000,"actual":252449540},"avg":{"target":55000,"actual":55084},"audit":82.59,"mysteryShopper":4.6,"large":{"small":3412,"large":2477,"total":5889,"rate":0.4206},"oatside":{"drinks":3634,"oat":802,"rate":0.2207},"bundling":{"total":1010,"asik":32,"rate":0.0317},"complain":{"trx":4583,"count":1,"rate":0.000218},"retention":{"total":17,"resign":0,"rate":0},"hpp":{"gross":265684760,"hpp":122066671,"rate":0.4594}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Pengumben',
    DATE '2026-02-01',
    'Bagas',
    0.52,
    '{"Net Sales":1,"AVG":5,"Large":2,"Oatside":5,"Add On Telur":5,"B. Asik":5,"Audit":2,"M. Shopper":5,"Complain":3}'::jsonb,
    '{"sales":{"target":230000000,"actual":176047584},"avg":{"target":55000,"actual":59516},"audit":77.36,"mysteryShopper":5,"large":{"small":2052,"large":1889,"total":3941,"rate":0.4793},"oatside":{"drinks":2438,"oat":513,"rate":0.2104},"bundling":{"total":688,"asik":37,"rate":0.0538},"complain":{"trx":2958,"count":4,"rate":0.001352},"retention":{"total":11,"resign":3,"rate":0.2727},"hpp":{"gross":184417138,"hpp":89193908,"rate":0.4837}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Kalimalang',
    DATE '2026-02-01',
    'Bagas',
    0.51,
    '{"Net Sales":1,"AVG":5,"Large":2,"Oatside":5,"Add On Telur":2,"B. Asik":3,"Audit":2,"M. Shopper":5,"Complain":5}'::jsonb,
    '{"sales":{"target":430000000,"actual":322598069},"avg":{"target":55000,"actual":59203},"audit":79.54,"mysteryShopper":5,"large":{"small":3808,"large":3311,"total":7119,"rate":0.4651},"oatside":{"drinks":4502,"oat":437,"rate":0.0971},"bundling":{"total":1725,"asik":55,"rate":0.0319},"complain":{"trx":5449,"count":4,"rate":0.000734},"retention":{"total":18,"resign":0,"rate":0},"hpp":{"gross":338384468,"hpp":159841955,"rate":0.4724}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Kemang Utara',
    DATE '2026-02-01',
    'Bagas',
    0.5,
    '{"Net Sales":1,"AVG":5,"Large":1,"Oatside":5,"Add On Telur":2,"B. Asik":3,"Audit":2,"M. Shopper":5,"Complain":5}'::jsonb,
    '{"sales":{"target":330000000,"actual":271302970},"avg":{"target":55000,"actual":58673},"audit":79.61,"mysteryShopper":5,"large":{"small":3613,"large":2874,"total":6487,"rate":0.443},"oatside":{"drinks":4711,"oat":281,"rate":0.0596},"bundling":{"total":1174,"asik":41,"rate":0.0349},"complain":{"trx":4624,"count":0,"rate":0},"retention":{"total":14,"resign":0,"rate":0},"hpp":{"gross":287611930,"hpp":134974890,"rate":0.4693}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Pamulang',
    DATE '2026-02-01',
    'Ryan',
    0.5,
    '{"Net Sales":1,"AVG":5,"Large":1,"Oatside":4,"Add On Telur":1,"B. Asik":2,"Audit":3,"M. Shopper":5,"Complain":5}'::jsonb,
    '{"sales":{"target":180000000,"actual":130144779},"avg":{"target":55000,"actual":59076},"audit":80.91,"mysteryShopper":4.75,"large":{"small":1773,"large":1218,"total":2991,"rate":0.4072},"oatside":{"drinks":2088,"oat":99,"rate":0.0474},"bundling":{"total":593,"asik":12,"rate":0.0202},"complain":{"trx":2203,"count":1,"rate":0.000454},"retention":{"total":12,"resign":1,"rate":0.0833},"hpp":{"gross":136834830,"hpp":74104456,"rate":0.5416}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Cilandak Barat',
    DATE '2026-02-01',
    'Bagas',
    0.5,
    '{"Net Sales":1,"AVG":3,"Large":5,"Oatside":5,"Add On Telur":5,"B. Asik":3,"Audit":3,"M. Shopper":5,"Complain":2}'::jsonb,
    '{"sales":{"target":100000000,"actual":66837271},"avg":{"target":55000,"actual":53257},"audit":82.94,"mysteryShopper":4.4,"large":{"small":529,"large":849,"total":1378,"rate":0.6161},"oatside":{"drinks":859,"oat":189,"rate":0.22},"bundling":{"total":296,"asik":11,"rate":0.0372},"complain":{"trx":1255,"count":2,"rate":0.001594},"retention":{"total":8,"resign":1,"rate":0.125},"hpp":{"gross":70193821,"hpp":36226153,"rate":0.5161}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Ciledug',
    DATE '2026-02-01',
    'Ryan',
    0.48,
    '{"Net Sales":1,"AVG":5,"Large":1,"Oatside":5,"Add On Telur":1,"B. Asik":2,"Audit":2,"M. Shopper":5,"Complain":5}'::jsonb,
    '{"sales":{"target":310000000,"actual":256663268},"avg":{"target":55000,"actual":60893},"audit":77.86,"mysteryShopper":5,"large":{"small":3339,"large":2496,"total":5835,"rate":0.4278},"oatside":{"drinks":4176,"oat":288,"rate":0.069},"bundling":{"total":935,"asik":28,"rate":0.0299},"complain":{"trx":4215,"count":0,"rate":0},"retention":{"total":14,"resign":2,"rate":0.1429},"hpp":{"gross":263796689,"hpp":126697071,"rate":0.4803}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Pekayon',
    DATE '2026-02-01',
    'Nadine',
    0.48,
    '{"Net Sales":1,"AVG":5,"Large":2,"Oatside":5,"Add On Telur":2,"B. Asik":2,"Audit":4,"M. Shopper":5,"Complain":1}'::jsonb,
    '{"sales":{"target":220000000,"actual":180999366},"avg":{"target":55000,"actual":64025},"audit":85.2,"mysteryShopper":5,"large":{"small":2115,"large":1927,"total":4042,"rate":0.4767},"oatside":{"drinks":2738,"oat":149,"rate":0.0544},"bundling":{"total":823,"asik":19,"rate":0.0231},"complain":{"trx":2827,"count":6,"rate":0.002122},"retention":{"total":13,"resign":2,"rate":0.1538},"hpp":{"gross":192138137,"hpp":91842175,"rate":0.478}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Setu Cipayung',
    DATE '2026-02-01',
    'Bagas',
    0.48,
    '{"Net Sales":1,"AVG":5,"Large":1,"Oatside":5,"Add On Telur":3,"B. Asik":2,"Audit":2,"M. Shopper":5,"Complain":4}'::jsonb,
    '{"sales":{"target":215000000,"actual":169827438},"avg":{"target":55000,"actual":57725},"audit":77.58,"mysteryShopper":5,"large":{"small":2129,"large":1701,"total":3830,"rate":0.4441},"oatside":{"drinks":2420,"oat":249,"rate":0.1029},"bundling":{"total":753,"asik":21,"rate":0.0279},"complain":{"trx":2942,"count":3,"rate":0.00102},"retention":{"total":14,"resign":2,"rate":0.1429},"hpp":{"gross":178772552,"hpp":78137076,"rate":0.4371}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Ciumbuleuit',
    DATE '2026-02-01',
    'Sohib',
    0.48,
    '{"Net Sales":1,"AVG":1,"Large":2,"Oatside":5,"Add On Telur":2,"B. Asik":5,"Audit":3,"M. Shopper":5,"Complain":5}'::jsonb,
    '{"sales":{"target":225000000,"actual":183473662},"avg":{"target":55000,"actual":48706},"audit":80.72,"mysteryShopper":4.5,"large":{"small":2258,"large":1950,"total":4208,"rate":0.4634},"oatside":{"drinks":2312,"oat":731,"rate":0.3162},"bundling":{"total":658,"asik":40,"rate":0.0608},"complain":{"trx":3767,"count":1,"rate":0.000265},"retention":{"total":12,"resign":1,"rate":0.0833},"hpp":{"gross":196565708,"hpp":100180733,"rate":0.5097}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Cawang',
    DATE '2026-02-01',
    'Bagas',
    0.45,
    '{"Net Sales":1,"AVG":5,"Large":1,"Oatside":5,"Add On Telur":2,"B. Asik":1,"Audit":1,"M. Shopper":5,"Complain":5}'::jsonb,
    '{"sales":{"target":230000000,"actual":160425281},"avg":{"target":55000,"actual":55568},"audit":74.79,"mysteryShopper":4.8,"large":{"small":2297,"large":1477,"total":3774,"rate":0.3914},"oatside":{"drinks":2577,"oat":181,"rate":0.0702},"bundling":{"total":862,"asik":9,"rate":0.0104},"complain":{"trx":2887,"count":1,"rate":0.000346},"retention":{"total":12,"resign":0,"rate":0},"hpp":{"gross":168800802,"hpp":78749513,"rate":0.4665}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Lebak Bulus',
    DATE '2026-02-01',
    'Bagas',
    0.44,
    '{"Net Sales":1,"AVG":2,"Large":3,"Oatside":5,"Add On Telur":3,"B. Asik":5,"Audit":3,"M. Shopper":5,"Complain":1}'::jsonb,
    '{"sales":{"target":130000000,"actual":111143970},"avg":{"target":55000,"actual":51171},"audit":80.58,"mysteryShopper":4.3,"large":{"small":925,"large":995,"total":1920,"rate":0.5182},"oatside":{"drinks":1155,"oat":214,"rate":0.1853},"bundling":{"total":361,"asik":22,"rate":0.0609},"complain":{"trx":2172,"count":4,"rate":0.001842},"retention":{"total":11,"resign":0,"rate":0},"hpp":{"gross":115998752,"hpp":51264765,"rate":0.4419}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Ciputat Jombang',
    DATE '2026-02-01',
    'Ryan',
    0.43,
    '{"Net Sales":1,"AVG":2,"Large":1,"Oatside":5,"Add On Telur":2,"B. Asik":2,"Audit":2,"M. Shopper":5,"Complain":5}'::jsonb,
    '{"sales":{"target":195000000,"actual":146615274},"avg":{"target":55000,"actual":49734},"audit":79.68,"mysteryShopper":4.95,"large":{"small":2097,"large":1331,"total":3428,"rate":0.3883},"oatside":{"drinks":2224,"oat":176,"rate":0.0791},"bundling":{"total":710,"asik":21,"rate":0.0296},"complain":{"trx":2948,"count":1,"rate":0.000339},"retention":{"total":11,"resign":1,"rate":0.0909},"hpp":{"gross":156509865,"hpp":74298274,"rate":0.4747}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Bintaro',
    DATE '2026-02-01',
    'Ryan',
    0.41,
    '{"Net Sales":1,"AVG":1,"Large":1,"Oatside":5,"Add On Telur":1,"B. Asik":5,"Audit":2,"M. Shopper":5,"Complain":4}'::jsonb,
    '{"sales":{"target":115000000,"actual":87754076},"avg":{"target":55000,"actual":45468},"audit":78.48,"mysteryShopper":4.9,"large":{"small":1141,"large":826,"total":1967,"rate":0.4199},"oatside":{"drinks":1279,"oat":154,"rate":0.1204},"bundling":{"total":363,"asik":25,"rate":0.0689},"complain":{"trx":1930,"count":2,"rate":0.001036},"retention":{"total":7,"resign":0,"rate":0},"hpp":{"gross":94453846,"hpp":44912564,"rate":0.4755}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Karawaci',
    DATE '2026-02-01',
    'Ryan',
    0.4,
    '{"Net Sales":1,"AVG":4,"Large":1,"Oatside":3,"Add On Telur":1,"B. Asik":1,"Audit":1,"M. Shopper":5,"Complain":5}'::jsonb,
    '{"sales":{"target":230000000,"actual":125061048},"avg":{"target":55000,"actual":54731},"audit":67.45,"mysteryShopper":5,"large":{"small":1892,"large":1243,"total":3135,"rate":0.3965},"oatside":{"drinks":2192,"oat":82,"rate":0.0374},"bundling":{"total":585,"asik":9,"rate":0.0154},"complain":{"trx":2285,"count":1,"rate":0.000438},"retention":{"total":10,"resign":5,"rate":0.5},"hpp":{"gross":131327525,"hpp":64195615,"rate":0.4888}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Margorejo',
    DATE '2026-02-01',
    'Ismail',
    0.4,
    '{"Net Sales":1,"AVG":1,"Large":1,"Oatside":5,"Add On Telur":1,"B. Asik":5,"Audit":3,"M. Shopper":5,"Complain":2}'::jsonb,
    '{"sales":{"target":75000000,"actual":59904150},"avg":{"target":55000,"actual":47393},"audit":80.3,"mysteryShopper":5,"large":{"small":909,"large":586,"total":1495,"rate":0.392},"oatside":{"drinks":839,"oat":109,"rate":0.1299},"bundling":{"total":157,"asik":8,"rate":0.051},"complain":{"trx":1264,"count":2,"rate":0.001582},"retention":{"total":7,"resign":1,"rate":0.1429},"hpp":{"gross":62515471,"hpp":38954405,"rate":0.6231}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Citraland',
    DATE '2026-02-01',
    'Ismail',
    0.37,
    '{"Net Sales":1,"AVG":1,"Large":1,"Oatside":5,"Add On Telur":1,"B. Asik":2,"Audit":1,"M. Shopper":5,"Complain":5}'::jsonb,
    '{"sales":{"target":210000000,"actual":154378504},"avg":{"target":55000,"actual":48516},"audit":57.82,"mysteryShopper":5,"large":{"small":2521,"large":1819,"total":4340,"rate":0.4191},"oatside":{"drinks":2510,"oat":127,"rate":0.0506},"bundling":{"total":587,"asik":13,"rate":0.0221},"complain":{"trx":3182,"count":1,"rate":0.000314},"retention":{"total":12,"resign":2,"rate":0.1667},"hpp":{"gross":160818127,"hpp":80123741,"rate":0.4982}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Ciputat Juanda',
    DATE '2026-02-01',
    'Ryan',
    0.36,
    '{"Net Sales":1,"AVG":2,"Large":3,"Oatside":5,"Add On Telur":1,"B. Asik":2,"Audit":2,"M. Shopper":5,"Complain":1}'::jsonb,
    '{"sales":{"target":175000000,"actual":122437518},"avg":{"target":55000,"actual":50511},"audit":78.49,"mysteryShopper":4.8,"large":{"small":1364,"large":1467,"total":2831,"rate":0.5182},"oatside":{"drinks":1844,"oat":247,"rate":0.1339},"bundling":{"total":533,"asik":13,"rate":0.0244},"complain":{"trx":2424,"count":7,"rate":0.002888},"retention":{"total":13,"resign":1,"rate":0.0769},"hpp":{"gross":133943230,"hpp":56597407,"rate":0.4225}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Kayu Putih',
    DATE '2026-02-01',
    'Bagas',
    0.24,
    '{"Net Sales":1,"AVG":1,"Large":1,"Oatside":1,"Add On Telur":1,"B. Asik":1,"Audit":1,"M. Shopper":5,"Complain":1}'::jsonb,
    '{"sales":{"target":145000000,"actual":109437921},"avg":{"target":55000,"actual":47936},"audit":63.07,"mysteryShopper":5,"large":{"small":1678,"large":1235,"total":2913,"rate":0.424},"oatside":{"drinks":1909,"oat":23,"rate":0.012},"bundling":{"total":372,"asik":7,"rate":0.0188},"complain":{"trx":2283,"count":15,"rate":0.00657},"retention":{"total":8,"resign":3,"rate":0.375},"hpp":{"gross":113545202,"hpp":60580833,"rate":0.5335}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Kranggan',
    DATE '2026-03-01',
    'Nadine',
    0.97,
    '{"Net Sales":5,"AVG":5,"Large":5,"Oatside":5,"Add On Telur":5,"B. Asik":5,"Audit":4,"M. Shopper":5,"Complain":5}'::jsonb,
    '{"sales":{"target":330000000,"actual":358869180},"avg":{"target":55000,"actual":65981},"audit":87.04,"mysteryShopper":5,"large":{"small":2099,"large":6196,"total":8295,"rate":0.747},"oatside":{"drinks":4375,"oat":1483,"rate":0.339},"bundling":{"total":1534,"asik":233,"rate":0.1519},"complain":{"trx":5439,"count":0,"rate":0},"retention":{"total":15,"resign":0,"rate":0},"hpp":{"gross":398582346,"hpp":167086827,"rate":0.4192}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Ujung Berung',
    DATE '2026-03-01',
    'Risti',
    0.94,
    '{"Net Sales":5,"AVG":5,"Large":2,"Oatside":5,"Add On Telur":5,"B. Asik":5,"Audit":4,"M. Shopper":5,"Complain":5}'::jsonb,
    '{"sales":{"target":270000000,"actual":337834900},"avg":{"target":55000,"actual":65958},"audit":88.72,"mysteryShopper":4.29,"large":{"small":3752,"large":3381,"total":7133,"rate":0.474},"oatside":{"drinks":3517,"oat":1962,"rate":0.5579},"bundling":{"total":1431,"asik":140,"rate":0.0978},"complain":{"trx":5122,"count":1,"rate":0.000195},"retention":{"total":15,"resign":2,"rate":0.1333},"hpp":{"gross":367609365,"hpp":156670523,"rate":0.4262}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Kota Wisata',
    DATE '2026-03-01',
    'Nadine',
    0.92,
    '{"Net Sales":5,"AVG":5,"Large":5,"Oatside":5,"Add On Telur":5,"B. Asik":5,"Audit":3,"M. Shopper":5,"Complain":4}'::jsonb,
    '{"sales":{"target":170000000,"actual":197593377},"avg":{"target":55000,"actual":69722},"audit":84.46,"mysteryShopper":5,"large":{"small":1493,"large":3289,"total":4782,"rate":0.6878},"oatside":{"drinks":2104,"oat":1054,"rate":0.501},"bundling":{"total":832,"asik":128,"rate":0.1538},"complain":{"trx":2834,"count":3,"rate":0.001059},"retention":{"total":9,"resign":0,"rate":0},"hpp":{"gross":213571215,"hpp":89621249,"rate":0.4196}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Setu Cipayung',
    DATE '2026-03-01',
    'Bagas',
    0.91,
    '{"Net Sales":5,"AVG":5,"Large":1,"Oatside":5,"Add On Telur":3,"B. Asik":5,"Audit":4,"M. Shopper":5,"Complain":5}'::jsonb,
    '{"sales":{"target":230000000,"actual":237591106},"avg":{"target":55000,"actual":64774},"audit":88.36,"mysteryShopper":4.83,"large":{"small":3226,"large":2359,"total":5585,"rate":0.4224},"oatside":{"drinks":3531,"oat":234,"rate":0.0663},"bundling":{"total":1081,"asik":56,"rate":0.0518},"complain":{"trx":3668,"count":3,"rate":0.000818},"retention":{"total":14,"resign":2,"rate":0.1429},"hpp":{"gross":252709547,"hpp":100989927,"rate":0.3996}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Lenteng Agung',
    DATE '2026-03-01',
    'Nadine',
    0.91,
    '{"Net Sales":5,"AVG":5,"Large":3,"Oatside":5,"Add On Telur":5,"B. Asik":5,"Audit":4,"M. Shopper":1,"Complain":5}'::jsonb,
    '{"sales":{"target":235000000,"actual":248550222},"avg":{"target":55000,"actual":60637},"audit":88.61,"mysteryShopper":0,"large":{"small":2751,"large":3021,"total":5772,"rate":0.5234},"oatside":{"drinks":3368,"oat":818,"rate":0.2429},"bundling":{"total":1078,"asik":129,"rate":0.1197},"complain":{"trx":4099,"count":1,"rate":0.000244},"retention":{"total":12,"resign":1,"rate":0.0833},"hpp":{"gross":277178187,"hpp":113281069,"rate":0.4087}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Metro',
    DATE '2026-03-01',
    'Risti',
    0.91,
    '{"Net Sales":5,"AVG":5,"Large":1,"Oatside":5,"Add On Telur":3,"B. Asik":5,"Audit":4,"M. Shopper":5,"Complain":5}'::jsonb,
    '{"sales":{"target":145000000,"actual":190446310},"avg":{"target":55000,"actual":58998},"audit":86.75,"mysteryShopper":4,"large":{"small":2736,"large":1765,"total":4501,"rate":0.3921},"oatside":{"drinks":2735,"oat":643,"rate":0.2351},"bundling":{"total":793,"asik":75,"rate":0.0946},"complain":{"trx":3228,"count":2,"rate":0.00062},"retention":{"total":7,"resign":4,"rate":0.5714},"hpp":{"gross":214151765,"hpp":88702027,"rate":0.4142}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Kiara Artha',
    DATE '2026-03-01',
    'Risti',
    0.89,
    '{"Net Sales":5,"AVG":5,"Large":1,"Oatside":5,"Add On Telur":4,"B. Asik":5,"Audit":3,"M. Shopper":5,"Complain":5}'::jsonb,
    '{"sales":{"target":210000000,"actual":278330487},"avg":{"target":55000,"actual":63896},"audit":81.05,"mysteryShopper":4.49,"large":{"small":4282,"large":2821,"total":7103,"rate":0.3972},"oatside":{"drinks":3980,"oat":1110,"rate":0.2789},"bundling":{"total":1217,"asik":95,"rate":0.0781},"complain":{"trx":4356,"count":3,"rate":0.000689},"retention":{"total":10,"resign":3,"rate":0.3},"hpp":{"gross":300616793,"hpp":134675114,"rate":0.448}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Cimahi',
    DATE '2026-03-01',
    'Sohib',
    0.87,
    '{"Net Sales":5,"AVG":5,"Large":1,"Oatside":5,"Add On Telur":2,"B. Asik":2,"Audit":4,"M. Shopper":5,"Complain":5}'::jsonb,
    '{"sales":{"target":280000000,"actual":405351490},"avg":{"target":55000,"actual":63277},"audit":87.07,"mysteryShopper":4.35,"large":{"small":5981,"large":3862,"total":9843,"rate":0.3924},"oatside":{"drinks":5860,"oat":1236,"rate":0.2109},"bundling":{"total":1794,"asik":52,"rate":0.029},"complain":{"trx":6406,"count":0,"rate":0},"retention":{"total":15,"resign":1,"rate":0.0667},"hpp":{"gross":423597573,"hpp":186858814,"rate":0.4411}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Pekayon',
    DATE '2026-03-01',
    'Nadine',
    0.86,
    '{"Net Sales":5,"AVG":5,"Large":3,"Oatside":4,"Add On Telur":3,"B. Asik":5,"Audit":2,"M. Shopper":5,"Complain":5}'::jsonb,
    '{"sales":{"target":240000000,"actual":262226490},"avg":{"target":55000,"actual":71725},"audit":79.17,"mysteryShopper":5,"large":{"small":2790,"large":3096,"total":5886,"rate":0.526},"oatside":{"drinks":3928,"oat":179,"rate":0.0456},"bundling":{"total":1003,"asik":78,"rate":0.0778},"complain":{"trx":3656,"count":3,"rate":0.000821},"retention":{"total":13,"resign":2,"rate":0.1538},"hpp":{"gross":289887339,"hpp":126718632,"rate":0.4371}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Peta',
    DATE '2026-03-01',
    'Sohib',
    0.85,
    '{"Net Sales":5,"AVG":5,"Large":1,"Oatside":5,"Add On Telur":4,"B. Asik":5,"Audit":3,"M. Shopper":5,"Complain":3}'::jsonb,
    '{"sales":{"target":310000000,"actual":389392101},"avg":{"target":55000,"actual":65731},"audit":83.11,"mysteryShopper":3.69,"large":{"small":5351,"large":3702,"total":9053,"rate":0.4089},"oatside":{"drinks":4866,"oat":1632,"rate":0.3354},"bundling":{"total":1671,"asik":127,"rate":0.076},"complain":{"trx":5924,"count":8,"rate":0.00135},"retention":{"total":14,"resign":1,"rate":0.0714},"hpp":{"gross":424231322,"hpp":184904743,"rate":0.4359}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Buah Batu',
    DATE '2026-03-01',
    'Risti',
    0.83,
    '{"Net Sales":5,"AVG":5,"Large":1,"Oatside":5,"Add On Telur":3,"B. Asik":5,"Audit":2,"M. Shopper":5,"Complain":4}'::jsonb,
    '{"sales":{"target":350000000,"actual":356629312},"avg":{"target":55000,"actual":68072},"audit":76.35,"mysteryShopper":4.29,"large":{"small":4776,"large":3426,"total":8202,"rate":0.4177},"oatside":{"drinks":4501,"oat":1541,"rate":0.3424},"bundling":{"total":1423,"asik":115,"rate":0.0808},"complain":{"trx":5239,"count":6,"rate":0.001145},"retention":{"total":15,"resign":5,"rate":0.3333},"hpp":{"gross":401738604,"hpp":164716818,"rate":0.41}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Melong',
    DATE '2026-03-01',
    'Sohib',
    0.83,
    '{"Net Sales":5,"AVG":2,"Large":1,"Oatside":5,"Add On Telur":3,"B. Asik":3,"Audit":4,"M. Shopper":5,"Complain":5}'::jsonb,
    '{"sales":{"target":145000000,"actual":188395447},"avg":{"target":55000,"actual":52014},"audit":85.36,"mysteryShopper":4.4,"large":{"small":2985,"large":2267,"total":5252,"rate":0.4316},"oatside":{"drinks":2952,"oat":841,"rate":0.2849},"bundling":{"total":990,"asik":36,"rate":0.0364},"complain":{"trx":3622,"count":0,"rate":0},"retention":{"total":8,"resign":1,"rate":0.125},"hpp":{"gross":203587542,"hpp":87070548,"rate":0.4277}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Lebak Bulus',
    DATE '2026-03-01',
    'Bagas',
    0.82,
    '{"Net Sales":5,"AVG":5,"Large":1,"Oatside":5,"Add On Telur":2,"B. Asik":3,"Audit":2,"M. Shopper":5,"Complain":5}'::jsonb,
    '{"sales":{"target":150000000,"actual":151572220},"avg":{"target":55000,"actual":57175},"audit":79.67,"mysteryShopper":4.6,"large":{"small":2156,"large":1627,"total":3783,"rate":0.4301},"oatside":{"drinks":2299,"oat":413,"rate":0.1796},"bundling":{"total":715,"asik":25,"rate":0.035},"complain":{"trx":2651,"count":1,"rate":0.000377},"retention":{"total":10,"resign":0,"rate":0},"hpp":{"gross":160326262,"hpp":64128323,"rate":0.4}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Pengumben',
    DATE '2026-03-01',
    'Bagas',
    0.82,
    '{"Net Sales":5,"AVG":5,"Large":3,"Oatside":5,"Add On Telur":5,"B. Asik":5,"Audit":1,"M. Shopper":1,"Complain":5}'::jsonb,
    '{"sales":{"target":250000000,"actual":252184133},"avg":{"target":55000,"actual":66715},"audit":71.67,"mysteryShopper":0,"large":{"small":2860,"large":3054,"total":5914,"rate":0.5164},"oatside":{"drinks":3607,"oat":761,"rate":0.211},"bundling":{"total":978,"asik":87,"rate":0.089},"complain":{"trx":3780,"count":2,"rate":0.000529},"retention":{"total":9,"resign":2,"rate":0.2222},"hpp":{"gross":288517805,"hpp":116031483,"rate":0.4022}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Cawang',
    DATE '2026-03-01',
    'Bagas',
    0.79,
    '{"Net Sales":5,"AVG":5,"Large":2,"Oatside":2,"Add On Telur":2,"B. Asik":5,"Audit":1,"M. Shopper":5,"Complain":5}'::jsonb,
    '{"sales":{"target":240000000,"actual":245953493},"avg":{"target":55000,"actual":70534},"audit":71.46,"mysteryShopper":4.9,"large":{"small":2973,"large":2515,"total":5488,"rate":0.4583},"oatside":{"drinks":3738,"oat":85,"rate":0.0227},"bundling":{"total":816,"asik":69,"rate":0.0846},"complain":{"trx":3487,"count":0,"rate":0},"retention":{"total":10,"resign":3,"rate":0.3},"hpp":{"gross":291238715,"hpp":113327367,"rate":0.3891}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Ciledug',
    DATE '2026-03-01',
    'Ryan',
    0.78,
    '{"Net Sales":5,"AVG":5,"Large":1,"Oatside":3,"Add On Telur":1,"B. Asik":5,"Audit":1,"M. Shopper":5,"Complain":5}'::jsonb,
    '{"sales":{"target":340000000,"actual":354749572},"avg":{"target":55000,"actual":69682},"audit":72.56,"mysteryShopper":4.25,"large":{"small":4704,"large":3730,"total":8434,"rate":0.4423},"oatside":{"drinks":5829,"oat":222,"rate":0.0381},"bundling":{"total":1468,"asik":91,"rate":0.062},"complain":{"trx":5091,"count":1,"rate":0.000196},"retention":{"total":12,"resign":0,"rate":0},"hpp":{"gross":382818881,"hpp":177587509,"rate":0.4639}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Margonda',
    DATE '2026-03-01',
    'Nadine',
    0.75,
    '{"Net Sales":5,"AVG":5,"Large":1,"Oatside":5,"Add On Telur":5,"B. Asik":5,"Audit":2,"M. Shopper":1,"Complain":1}'::jsonb,
    '{"sales":{"target":295000000,"actual":305020918},"avg":{"target":55000,"actual":64201},"audit":78.8,"mysteryShopper":0,"large":{"small":4185,"large":3185,"total":7370,"rate":0.4322},"oatside":{"drinks":4533,"oat":769,"rate":0.1696},"bundling":{"total":1380,"asik":166,"rate":0.1203},"complain":{"trx":4751,"count":10,"rate":0.002105},"retention":{"total":12,"resign":4,"rate":0.3333},"hpp":{"gross":335577488,"hpp":142339122,"rate":0.4242}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Kalimalang',
    DATE '2026-03-01',
    'Bagas',
    0.73,
    '{"Net Sales":3,"AVG":5,"Large":2,"Oatside":5,"Add On Telur":3,"B. Asik":5,"Audit":3,"M. Shopper":5,"Complain":5}'::jsonb,
    '{"sales":{"target":450000000,"actual":435204393},"avg":{"target":55000,"actual":71544},"audit":80.66,"mysteryShopper":5,"large":{"small":5374,"large":4490,"total":9864,"rate":0.4552},"oatside":{"drinks":6166,"oat":812,"rate":0.1317},"bundling":{"total":1774,"asik":188,"rate":0.106},"complain":{"trx":6083,"count":4,"rate":0.000658},"retention":{"total":18,"resign":3,"rate":0.1667},"hpp":{"gross":486165153,"hpp":201535654,"rate":0.4145}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Pamulang',
    DATE '2026-03-01',
    'Ryan',
    0.71,
    '{"Net Sales":5,"AVG":5,"Large":1,"Oatside":3,"Add On Telur":2,"B. Asik":5,"Audit":1,"M. Shopper":5,"Complain":1}'::jsonb,
    '{"sales":{"target":205000000,"actual":224242619},"avg":{"target":55000,"actual":70185},"audit":64.28,"mysteryShopper":4.84,"large":{"small":3099,"large":2196,"total":5295,"rate":0.4147},"oatside":{"drinks":3510,"oat":115,"rate":0.0328},"bundling":{"total":829,"asik":75,"rate":0.0905},"complain":{"trx":3195,"count":7,"rate":0.002191},"retention":{"total":12,"resign":0,"rate":0},"hpp":{"gross":253544544,"hpp":107878170,"rate":0.4255}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Ciumbuleuit',
    DATE '2026-03-01',
    'Sohib',
    0.69,
    '{"Net Sales":3,"AVG":4,"Large":1,"Oatside":5,"Add On Telur":2,"B. Asik":5,"Audit":3,"M. Shopper":5,"Complain":5}'::jsonb,
    '{"sales":{"target":270000000,"actual":256835476},"avg":{"target":55000,"actual":53686},"audit":80.56,"mysteryShopper":4.38,"large":{"small":4210,"large":2561,"total":6771,"rate":0.3782},"oatside":{"drinks":4186,"oat":520,"rate":0.1242},"bundling":{"total":1234,"asik":68,"rate":0.0551},"complain":{"trx":4784,"count":2,"rate":0.000418},"retention":{"total":12,"resign":3,"rate":0.25},"hpp":{"gross":276302354,"hpp":130255734,"rate":0.4714}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Jatinangor',
    DATE '2026-03-01',
    'Risti',
    0.66,
    '{"Net Sales":1,"AVG":5,"Large":3,"Oatside":5,"Add On Telur":5,"B. Asik":5,"Audit":5,"M. Shopper":5,"Complain":5}'::jsonb,
    '{"sales":{"target":320000000,"actual":263235458},"avg":{"target":55000,"actual":78648},"audit":91.7,"mysteryShopper":4.62,"large":{"small":2578,"large":2615,"total":5193,"rate":0.5036},"oatside":{"drinks":2996,"oat":706,"rate":0.2356},"bundling":{"total":782,"asik":153,"rate":0.1957},"complain":{"trx":3347,"count":1,"rate":0.000299},"retention":{"total":13,"resign":0,"rate":0},"hpp":{"gross":308111195,"hpp":119063899,"rate":0.3864}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Ciputat Jombang',
    DATE '2026-03-01',
    'Ryan',
    0.66,
    '{"Net Sales":4,"AVG":5,"Large":1,"Oatside":3,"Add On Telur":1,"B. Asik":5,"Audit":1,"M. Shopper":5,"Complain":3}'::jsonb,
    '{"sales":{"target":230000000,"actual":229863427},"avg":{"target":55000,"actual":62243},"audit":73.83,"mysteryShopper":4.95,"large":{"small":3333,"large":2103,"total":5436,"rate":0.3869},"oatside":{"drinks":3560,"oat":128,"rate":0.036},"bundling":{"total":829,"asik":63,"rate":0.076},"complain":{"trx":3693,"count":5,"rate":0.001354},"retention":{"total":11,"resign":1,"rate":0.0909},"hpp":{"gross":260949735,"hpp":104713380,"rate":0.4013}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Cilandak Barat',
    DATE '2026-03-01',
    'Bagas',
    0.59,
    '{"Net Sales":1,"AVG":5,"Large":2,"Oatside":5,"Add On Telur":5,"B. Asik":5,"Audit":3,"M. Shopper":5,"Complain":5}'::jsonb,
    '{"sales":{"target":105000000,"actual":81675734},"avg":{"target":55000,"actual":57276},"audit":83.63,"mysteryShopper":4.7,"large":{"small":941,"large":903,"total":1844,"rate":0.4897},"oatside":{"drinks":1060,"oat":192,"rate":0.1811},"bundling":{"total":382,"asik":33,"rate":0.0864},"complain":{"trx":1426,"count":0,"rate":0},"retention":{"total":7,"resign":0,"rate":0},"hpp":{"gross":93177038,"hpp":37616650,"rate":0.4037}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Margorejo',
    DATE '2026-03-01',
    'Ismail',
    0.48,
    '{"Net Sales":1,"AVG":3,"Large":1,"Oatside":5,"Add On Telur":2,"B. Asik":5,"Audit":2,"M. Shopper":5,"Complain":5}'::jsonb,
    '{"sales":{"target":90000000,"actual":67622328},"avg":{"target":55000,"actual":52583},"audit":79.39,"mysteryShopper":5,"large":{"small":1059,"large":769,"total":1828,"rate":0.4207},"oatside":{"drinks":1043,"oat":124,"rate":0.1189},"bundling":{"total":339,"asik":24,"rate":0.0708},"complain":{"trx":1286,"count":1,"rate":0.000778},"retention":{"total":7,"resign":0,"rate":0},"hpp":{"gross":71579739,"hpp":35962908,"rate":0.5024}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Citraland',
    DATE '2026-03-01',
    'Ismail',
    0.47,
    '{"Net Sales":1,"AVG":4,"Large":3,"Oatside":5,"Add On Telur":2,"B. Asik":3,"Audit":1,"M. Shopper":5,"Complain":5}'::jsonb,
    '{"sales":{"target":230000000,"actual":190746962},"avg":{"target":55000,"actual":54313},"audit":69.04,"mysteryShopper":4.8,"large":{"small":2565,"large":2935,"total":5500,"rate":0.5336},"oatside":{"drinks":2937,"oat":345,"rate":0.1175},"bundling":{"total":1051,"asik":39,"rate":0.0371},"complain":{"trx":3512,"count":3,"rate":0.000854},"retention":{"total":12,"resign":0,"rate":0},"hpp":{"gross":198429092,"hpp":89311820,"rate":0.4501}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Kemang Utara',
    DATE '2026-03-01',
    'Bagas',
    0.46,
    '{"Net Sales":1,"AVG":5,"Large":1,"Oatside":2,"Add On Telur":3,"B. Asik":5,"Audit":2,"M. Shopper":1,"Complain":5}'::jsonb,
    '{"sales":{"target":408000000,"actual":343698942},"avg":{"target":55000,"actual":66134},"audit":75.37,"mysteryShopper":0,"large":{"small":4799,"large":3762,"total":8561,"rate":0.4394},"oatside":{"drinks":6210,"oat":174,"rate":0.028},"bundling":{"total":1361,"asik":115,"rate":0.0845},"complain":{"trx":5197,"count":4,"rate":0.00077},"retention":{"total":14,"resign":1,"rate":0.0714},"hpp":{"gross":384722919,"hpp":159522102,"rate":0.4146}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Ciputat Juanda',
    DATE '2026-03-01',
    'Ryan',
    0.46,
    '{"Net Sales":1,"AVG":5,"Large":2,"Oatside":5,"Add On Telur":3,"B. Asik":5,"Audit":2,"M. Shopper":5,"Complain":1}'::jsonb,
    '{"sales":{"target":210000000,"actual":132713419},"avg":{"target":55000,"actual":56402},"audit":79.06,"mysteryShopper":4.68,"large":{"small":1604,"large":1600,"total":3204,"rate":0.4994},"oatside":{"drinks":2031,"oat":203,"rate":0.1},"bundling":{"total":580,"asik":58,"rate":0.1},"complain":{"trx":2353,"count":7,"rate":0.002975},"retention":{"total":11,"resign":1,"rate":0.0909},"hpp":{"gross":143766637,"hpp":60282446,"rate":0.4193}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Bintaro',
    DATE '2026-03-01',
    'Ryan',
    0.44,
    '{"Net Sales":2,"AVG":3,"Large":1,"Oatside":4,"Add On Telur":2,"B. Asik":5,"Audit":1,"M. Shopper":5,"Complain":1}'::jsonb,
    '{"sales":{"target":110000000,"actual":102866336},"avg":{"target":55000,"actual":53548},"audit":74.12,"mysteryShopper":4.55,"large":{"small":1417,"large":1125,"total":2542,"rate":0.4426},"oatside":{"drinks":1721,"oat":71,"rate":0.0413},"bundling":{"total":564,"asik":34,"rate":0.0603},"complain":{"trx":1921,"count":4,"rate":0.002082},"retention":{"total":9,"resign":2,"rate":0.2222},"hpp":{"gross":115159417,"hpp":57131277,"rate":0.4961}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Karawaci',
    DATE '2026-03-01',
    'Ryan',
    0.37,
    '{"Net Sales":1,"AVG":5,"Large":1,"Oatside":3,"Add On Telur":1,"B. Asik":4,"Audit":1,"M. Shopper":5,"Complain":1}'::jsonb,
    '{"sales":{"target":240000000,"actual":161600862},"avg":{"target":55000,"actual":68649},"audit":64.81,"mysteryShopper":4.95,"large":{"small":2165,"large":1637,"total":3802,"rate":0.4306},"oatside":{"drinks":2508,"oat":88,"rate":0.0351},"bundling":{"total":629,"asik":30,"rate":0.0477},"complain":{"trx":2354,"count":7,"rate":0.002974},"retention":{"total":9,"resign":2,"rate":0.2222},"hpp":{"gross":178106066,"hpp":80009616,"rate":0.4492}}'::jsonb,
    DATE '2026-04-16'
  ),
  (
    'Kayu Putih',
    DATE '2026-03-01',
    'Bagas',
    0.31,
    '{"Net Sales":1,"AVG":5,"Large":1,"Oatside":1,"Add On Telur":1,"B. Asik":4,"Audit":1,"M. Shopper":1,"Complain":1}'::jsonb,
    '{"sales":{"target":160000000,"actual":129865728},"avg":{"target":55000,"actual":55832},"audit":51.52,"mysteryShopper":0,"large":{"small":1915,"large":1521,"total":3436,"rate":0.4427},"oatside":{"drinks":2312,"oat":24,"rate":0.0104},"bundling":{"total":615,"asik":28,"rate":0.0455},"complain":{"trx":2326,"count":28,"rate":0.012038},"retention":{"total":5,"resign":0,"rate":0},"hpp":{"gross":142032305,"hpp":71087315,"rate":0.5005}}'::jsonb,
    DATE '2026-04-16'
  )
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
  ON lower(regexp_replace(b.name, '^Bagi Kopi\s+', '')) = lower(seed.store_short)
ON CONFLICT (branch_id, bulan) DO UPDATE SET
  dm_name = EXCLUDED.dm_name,
  total_score = EXCLUDED.total_score,
  item_scores = EXCLUDED.item_scores,
  metrics = EXCLUDED.metrics,
  source_updated_at = EXCLUDED.source_updated_at,
  updated_at = now();
