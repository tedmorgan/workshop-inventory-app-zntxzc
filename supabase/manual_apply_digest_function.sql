-- Run this entire script in Supabase Dashboard → SQL Editor (your production project).
-- Fixes: PGRST202 Could not find get_inventory_digest_stats in the schema cache

CREATE OR REPLACE FUNCTION public.get_inventory_digest_stats(since_ts timestamptz)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT json_build_object(
    'new_users', (
      SELECT COUNT(*)::int
      FROM (
        SELECT device_id
        FROM public.tool_inventory
        GROUP BY device_id
        HAVING MIN(created_at) >= since_ts
      ) u
    ),
    'new_tools', (
      SELECT COALESCE(
        SUM(jsonb_array_length(COALESCE(tools::jsonb, '[]'::jsonb))),
        0
      )::bigint
      FROM public.tool_inventory
      WHERE created_at >= since_ts
    ),
    'total_users', (
      SELECT COUNT(DISTINCT device_id)::int
      FROM public.tool_inventory
    ),
    'total_tools', (
      SELECT COALESCE(
        SUM(jsonb_array_length(COALESCE(tools::jsonb, '[]'::jsonb))),
        0
      )::bigint
      FROM public.tool_inventory
    )
  );
$$;

REVOKE ALL ON FUNCTION public.get_inventory_digest_stats(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_inventory_digest_stats(timestamptz) TO service_role;

-- Refresh PostgREST so RPC appears immediately
NOTIFY pgrst, 'reload schema';
