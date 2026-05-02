CREATE OR REPLACE FUNCTION public.get_operational_leaderboards(
  p_period TEXT,
  p_today DATE DEFAULT ((now() AT TIME ZONE 'Asia/Jakarta')::date)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT := my_role();
  v_start_date DATE;
  v_end_date DATE;
  v_days_in_month INTEGER;
  v_elapsed_days INTEGER;
  v_expected_checklist_days INTEGER;
  v_expected_preparation_days INTEGER;
  v_expected_head_store_report_days INTEGER;
  v_expected_head_store_deposit_days INTEGER;
  v_expected_head_store_opex_days INTEGER;
  v_result JSONB;
BEGIN
  IF v_role NOT IN (
    'staff','barista','kitchen','waitress',
    'asst_head_store','head_store',
    'district_manager','area_manager','ops_manager',
    'finance_supervisor','trainer',
    'support_spv','support_admin'
  ) THEN
    RAISE EXCEPTION 'leaderboard access denied for role %', COALESCE(v_role, 'unknown');
  END IF;

  IF p_period IS NULL OR p_period !~ '^[0-9]{4}-[0-9]{2}$' THEN
    RAISE EXCEPTION 'invalid leaderboard period: %', COALESCE(p_period, 'null');
  END IF;

  v_start_date := to_date(p_period || '-01', 'YYYY-MM-DD');
  v_end_date := (v_start_date + INTERVAL '1 month - 1 day')::date;
  v_days_in_month := EXTRACT(DAY FROM v_end_date)::INTEGER;

  IF p_today IS NULL THEN
    p_today := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  END IF;

  IF to_char(p_today, 'YYYY-MM') = p_period THEN
    v_elapsed_days := GREATEST(EXTRACT(DAY FROM p_today)::INTEGER, 0);
  ELSE
    v_elapsed_days := v_days_in_month;
  END IF;

  v_expected_checklist_days := v_elapsed_days * 4;
  v_expected_preparation_days := v_elapsed_days * 4;
  v_expected_head_store_report_days := GREATEST(v_elapsed_days - 1, 0);
  v_expected_head_store_deposit_days := GREATEST(v_elapsed_days - 1, 0);
  v_expected_head_store_opex_days := v_elapsed_days;

  WITH active_branches AS (
    SELECT
      b.id,
      b.name,
      b.store_id,
      regexp_replace(COALESCE(b.name, '-'), '^Bagi Kopi\s+', '', 'i') AS short_name
    FROM branches b
    WHERE b.is_active = true
  ),
  staff_profiles AS (
    SELECT p.id, p.full_name, p.role, p.branch_id
    FROM profiles p
    JOIN active_branches b ON b.id = p.branch_id
    WHERE p.is_active = true
      AND p.role IN ('staff', 'barista', 'kitchen', 'waitress', 'asst_head_store')
  ),
  head_store_profiles AS (
    SELECT p.id, p.full_name, p.branch_id
    FROM profiles p
    JOIN active_branches b ON b.id = p.branch_id
    WHERE p.is_active = true
      AND p.role = 'head_store'
  ),
  checklist_by_branch AS (
    SELECT
      c.branch_id,
      COUNT(*)::INTEGER AS checklist_count,
      COUNT(*) FILTER (WHERE COALESCE(c.is_late, false) = false)::INTEGER AS checklist_on_time
    FROM daily_checklists c
    JOIN active_branches b ON b.id = c.branch_id
    WHERE c.tanggal >= v_start_date
      AND c.tanggal <= v_end_date
    GROUP BY c.branch_id
  ),
  checklist_by_staff AS (
    SELECT
      c.submitted_by,
      COUNT(*)::INTEGER AS checklist_count,
      COUNT(*) FILTER (WHERE COALESCE(c.is_late, false) = false)::INTEGER AS checklist_on_time
    FROM daily_checklists c
    JOIN active_branches b ON b.id = c.branch_id
    WHERE c.tanggal >= v_start_date
      AND c.tanggal <= v_end_date
    GROUP BY c.submitted_by
  ),
  preparation_by_branch AS (
    SELECT
      p.branch_id,
      COUNT(*)::INTEGER AS preparation_count,
      COUNT(*) FILTER (
        WHERE COALESCE(p.updated_at, p.created_at) <= (
          CASE p.shift
            WHEN 'opening' THEN (p.tanggal::timestamp AT TIME ZONE 'UTC') + INTERVAL '1 hour'
            WHEN 'middle' THEN (p.tanggal::timestamp AT TIME ZONE 'UTC') + INTERVAL '8 hours 30 minutes'
            WHEN 'malam' THEN (p.tanggal::timestamp AT TIME ZONE 'UTC') + INTERVAL '12 hours 30 minutes'
            WHEN 'closing' THEN (p.tanggal::timestamp AT TIME ZONE 'UTC') + INTERVAL '21 hour'
            ELSE NULL
          END
        )
      )::INTEGER AS preparation_on_time
    FROM daily_preparation p
    JOIN active_branches b ON b.id = p.branch_id
    WHERE p.tanggal >= v_start_date
      AND p.tanggal <= v_end_date
    GROUP BY p.branch_id
  ),
  report_best AS (
    SELECT
      r.submitted_by,
      r.tanggal,
      MIN(r.submitted_at) AS submitted_at
    FROM daily_reports r
    JOIN active_branches b ON b.id = r.branch_id
    WHERE r.tanggal >= v_start_date
      AND r.tanggal <= v_end_date
      AND r.submitted_by IS NOT NULL
    GROUP BY r.submitted_by, r.tanggal
  ),
  report_by_head_store AS (
    SELECT
      submitted_by,
      COUNT(*)::INTEGER AS report_count,
      COUNT(*) FILTER (
        WHERE submitted_at <= (((tanggal + 1)::timestamp AT TIME ZONE 'UTC') + INTERVAL '7 hour')
      )::INTEGER AS report_on_time
    FROM report_best
    GROUP BY submitted_by
  ),
  deposit_best AS (
    SELECT
      d.submitted_by,
      d.tanggal,
      MIN(d.submitted_at) AS submitted_at
    FROM daily_deposits d
    JOIN active_branches b ON b.id = d.branch_id
    WHERE d.tanggal >= v_start_date
      AND d.tanggal <= v_end_date
      AND d.submitted_by IS NOT NULL
    GROUP BY d.submitted_by, d.tanggal
  ),
  deposit_by_head_store AS (
    SELECT
      submitted_by,
      COUNT(*)::INTEGER AS deposit_count,
      COUNT(*) FILTER (
        WHERE submitted_at <= (((tanggal + 1)::timestamp AT TIME ZONE 'UTC') + INTERVAL '7 hour')
      )::INTEGER AS deposit_on_time
    FROM deposit_best
    GROUP BY submitted_by
  ),
  opex_best AS (
    SELECT
      o.submitted_by,
      o.tanggal,
      MIN(o.created_at) AS created_at
    FROM operational_expenses o
    JOIN active_branches b ON b.id = o.branch_id
    WHERE o.tanggal >= v_start_date
      AND o.tanggal <= v_end_date
      AND o.submitted_by IS NOT NULL
    GROUP BY o.submitted_by, o.tanggal
  ),
  opex_by_head_store AS (
    SELECT
      submitted_by,
      COUNT(*)::INTEGER AS opex_count,
      COUNT(*) FILTER (
        WHERE (created_at AT TIME ZONE 'Asia/Jakarta')::date = tanggal
      )::INTEGER AS opex_on_time
    FROM opex_best
    GROUP BY submitted_by
  ),
  store_rows AS (
    SELECT
      b.id,
      b.short_name AS title,
      b.store_id,
      COALESCE(cb.checklist_count, 0) AS checklist_count,
      COALESCE(cb.checklist_on_time, 0) AS checklist_on_time,
      COALESCE(pb.preparation_count, 0) AS preparation_count,
      COALESCE(pb.preparation_on_time, 0) AS preparation_on_time,
      CASE
        WHEN (v_expected_checklist_days + v_expected_preparation_days) <= 0 THEN 0
        ELSE ROUND(
          ((COALESCE(cb.checklist_count, 0) + COALESCE(pb.preparation_count, 0))::NUMERIC
            / (v_expected_checklist_days + v_expected_preparation_days)::NUMERIC) * 100
        )::INTEGER
      END AS completion_pct,
      CASE
        WHEN (v_expected_checklist_days + v_expected_preparation_days) <= 0 THEN 0
        ELSE ROUND(
          ((COALESCE(cb.checklist_on_time, 0) + COALESCE(pb.preparation_on_time, 0))::NUMERIC
            / (v_expected_checklist_days + v_expected_preparation_days)::NUMERIC) * 100
        )::INTEGER
      END AS on_time_pct
    FROM active_branches b
    LEFT JOIN checklist_by_branch cb ON cb.branch_id = b.id
    LEFT JOIN preparation_by_branch pb ON pb.branch_id = b.id
  ),
  store_rows_final AS (
    SELECT
      id,
      title,
      (COALESCE(store_id, '-') || ' · Ceklis ' || checklist_count || '/' || v_expected_checklist_days ||
        ' · Prep ' || preparation_count || '/' || v_expected_preparation_days) AS subtitle,
      ROUND((completion_pct * 0.7) + (on_time_pct * 0.3))::INTEGER AS score,
      ('On time ' || on_time_pct || '%') AS metrics,
      (checklist_on_time || '/' || checklist_count || ' ceklis · ' ||
        preparation_on_time || '/' || preparation_count || ' prep tepat waktu') AS note,
      on_time_pct
    FROM store_rows
  ),
  staff_rows AS (
    SELECT
      p.id,
      p.full_name AS title,
      p.role,
      b.store_id,
      b.short_name,
      COALESCE(cs.checklist_count, 0) AS checklist_count,
      COALESCE(cs.checklist_on_time, 0) AS checklist_on_time,
      CASE
        WHEN v_expected_checklist_days <= 0 THEN 0
        ELSE ROUND((COALESCE(cs.checklist_count, 0)::NUMERIC / v_expected_checklist_days::NUMERIC) * 100)::INTEGER
      END AS completion_pct,
      CASE
        WHEN v_expected_checklist_days <= 0 THEN 0
        ELSE ROUND((COALESCE(cs.checklist_on_time, 0)::NUMERIC / v_expected_checklist_days::NUMERIC) * 100)::INTEGER
      END AS on_time_pct
    FROM staff_profiles p
    JOIN active_branches b ON b.id = p.branch_id
    LEFT JOIN checklist_by_staff cs ON cs.submitted_by = p.id
  ),
  staff_rows_final AS (
    SELECT
      id,
      title,
      (
        CASE role
          WHEN 'staff' THEN 'Staff'
          WHEN 'barista' THEN 'Barista'
          WHEN 'kitchen' THEN 'Kitchen'
          WHEN 'waitress' THEN 'Waitress'
          WHEN 'asst_head_store' THEN 'Asst. Head Store'
          ELSE role
        END
        || ' · ' || COALESCE(store_id, '-') || ' · ' || COALESCE(short_name, '-')
      ) AS subtitle,
      ROUND((completion_pct * 0.7) + (on_time_pct * 0.3))::INTEGER AS score,
      ('On time ' || on_time_pct || '%') AS metrics,
      (checklist_count || '/' || v_expected_checklist_days || ' checklist · ' ||
        checklist_on_time || '/' || checklist_count || ' tepat waktu') AS note,
      on_time_pct
    FROM staff_rows
  ),
  head_store_rows AS (
    SELECT
      p.id,
      p.full_name AS title,
      b.store_id,
      b.short_name,
      COALESCE(r.report_count, 0) AS report_count,
      COALESCE(r.report_on_time, 0) AS report_on_time,
      COALESCE(d.deposit_count, 0) AS deposit_count,
      COALESCE(d.deposit_on_time, 0) AS deposit_on_time,
      COALESCE(o.opex_count, 0) AS opex_count,
      COALESCE(o.opex_on_time, 0) AS opex_on_time,
      CASE
        WHEN (v_expected_head_store_report_days + v_expected_head_store_deposit_days + v_expected_head_store_opex_days) <= 0 THEN 0
        ELSE ROUND(
          (
            (COALESCE(r.report_count, 0) + COALESCE(d.deposit_count, 0) + COALESCE(o.opex_count, 0))::NUMERIC
            / (v_expected_head_store_report_days + v_expected_head_store_deposit_days + v_expected_head_store_opex_days)::NUMERIC
          ) * 100
        )::INTEGER
      END AS completion_pct,
      CASE
        WHEN (v_expected_head_store_report_days + v_expected_head_store_deposit_days + v_expected_head_store_opex_days) <= 0 THEN 0
        ELSE ROUND(
          (
            (COALESCE(r.report_on_time, 0) + COALESCE(d.deposit_on_time, 0) + COALESCE(o.opex_on_time, 0))::NUMERIC
            / (v_expected_head_store_report_days + v_expected_head_store_deposit_days + v_expected_head_store_opex_days)::NUMERIC
          ) * 100
        )::INTEGER
      END AS on_time_pct
    FROM head_store_profiles p
    JOIN active_branches b ON b.id = p.branch_id
    LEFT JOIN report_by_head_store r ON r.submitted_by = p.id
    LEFT JOIN deposit_by_head_store d ON d.submitted_by = p.id
    LEFT JOIN opex_by_head_store o ON o.submitted_by = p.id
  ),
  head_store_rows_final AS (
    SELECT
      id,
      title,
      (COALESCE(store_id, '-') || ' · ' || COALESCE(short_name, '-')) AS subtitle,
      ROUND((completion_pct * 0.7) + (on_time_pct * 0.3))::INTEGER AS score,
      ('On time ' || on_time_pct || '%') AS metrics,
      (
        'Laporan ' || report_count || '/' || v_expected_head_store_report_days ||
        ' · Setoran ' || deposit_count || '/' || v_expected_head_store_deposit_days ||
        ' · Opex ' || opex_count || '/' || v_expected_head_store_opex_days
      ) AS note,
      on_time_pct
    FROM head_store_rows
  )
  SELECT jsonb_build_object(
    'staffTop',
      COALESCE((SELECT jsonb_agg(to_jsonb(s) - 'on_time_pct') FROM (
        SELECT * FROM staff_rows_final ORDER BY score DESC, on_time_pct DESC, title ASC LIMIT 10
      ) s), '[]'::jsonb),
    'staffBottom',
      COALESCE((SELECT jsonb_agg(to_jsonb(s) - 'on_time_pct') FROM (
        SELECT * FROM staff_rows_final ORDER BY score ASC, on_time_pct ASC, title ASC LIMIT 10
      ) s), '[]'::jsonb),
    'storesTop',
      COALESCE((SELECT jsonb_agg(to_jsonb(s) - 'on_time_pct') FROM (
        SELECT * FROM store_rows_final ORDER BY score DESC, on_time_pct DESC, title ASC LIMIT 10
      ) s), '[]'::jsonb),
    'storesBottom',
      COALESCE((SELECT jsonb_agg(to_jsonb(s) - 'on_time_pct') FROM (
        SELECT * FROM store_rows_final ORDER BY score ASC, on_time_pct ASC, title ASC LIMIT 10
      ) s), '[]'::jsonb),
    'headStoresTop',
      COALESCE((SELECT jsonb_agg(to_jsonb(s) - 'on_time_pct') FROM (
        SELECT * FROM head_store_rows_final ORDER BY score DESC, on_time_pct DESC, title ASC LIMIT 10
      ) s), '[]'::jsonb),
    'headStoresBottom',
      COALESCE((SELECT jsonb_agg(to_jsonb(s) - 'on_time_pct') FROM (
        SELECT * FROM head_store_rows_final ORDER BY score ASC, on_time_pct ASC, title ASC LIMIT 10
      ) s), '[]'::jsonb),
    'staffAll',
      COALESCE((SELECT jsonb_agg(to_jsonb(s) - 'on_time_pct') FROM (
        SELECT * FROM staff_rows_final ORDER BY score DESC, on_time_pct DESC, title ASC
      ) s), '[]'::jsonb),
    'headStoresAll',
      COALESCE((SELECT jsonb_agg(to_jsonb(s) - 'on_time_pct') FROM (
        SELECT * FROM head_store_rows_final ORDER BY score DESC, on_time_pct DESC, title ASC
      ) s), '[]'::jsonb),
    'storesAll',
      COALESCE((SELECT jsonb_agg(to_jsonb(s) - 'on_time_pct') FROM (
        SELECT * FROM store_rows_final ORDER BY score DESC, on_time_pct DESC, title ASC
      ) s), '[]'::jsonb)
  )
  INTO v_result;

  RETURN COALESCE(v_result, jsonb_build_object(
    'staffTop', '[]'::jsonb,
    'staffBottom', '[]'::jsonb,
    'storesTop', '[]'::jsonb,
    'storesBottom', '[]'::jsonb,
    'headStoresTop', '[]'::jsonb,
    'headStoresBottom', '[]'::jsonb,
    'staffAll', '[]'::jsonb,
    'headStoresAll', '[]'::jsonb,
    'storesAll', '[]'::jsonb
  ));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_operational_leaderboards(TEXT, DATE) TO authenticated;
