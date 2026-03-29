-- ============================================
-- Workshop Inventory App - System Stats Summary
-- ============================================
-- Run this in Supabase SQL Editor (or with service role) to bypass RLS
-- and see system-wide statistics.
--
-- Output:
--   unique_users     - Number of distinct users (device_ids) in the system
--   total_tools      - Total count of all tools across all bins/inventories
-- ============================================

SELECT
  COUNT(DISTINCT device_id) AS unique_users,
  COALESCE(
    SUM(jsonb_array_length(COALESCE(tools::jsonb, '[]'::jsonb))),
    0
  )::bigint AS total_tools
FROM public.tool_inventory;
