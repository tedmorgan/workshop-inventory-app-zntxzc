-- ============================================
-- SECURE RLS POLICIES FOR tool_inventory
-- 
-- This migration replaces the insecure RLS policies
-- that used USING (true) with proper device-based
-- security policies.
--
-- The policies check the 'x-device-id' header passed
-- by the client to ensure users can only access
-- their own inventory data.
--
-- Created: 2026-01-08
-- ============================================

-- First, drop the existing insecure policies
DROP POLICY IF EXISTS "Allow users to delete their own inventory" ON public.tool_inventory;
DROP POLICY IF EXISTS "Allow users to insert inventory" ON public.tool_inventory;
DROP POLICY IF EXISTS "Allow users to update their own inventory" ON public.tool_inventory;
DROP POLICY IF EXISTS "Allow users to view their own inventory" ON public.tool_inventory;

-- Also drop any other common policy names that might exist
DROP POLICY IF EXISTS "Users can view their own inventory" ON public.tool_inventory;
DROP POLICY IF EXISTS "Users can insert their own inventory" ON public.tool_inventory;
DROP POLICY IF EXISTS "Users can update their own inventory" ON public.tool_inventory;
DROP POLICY IF EXISTS "Users can delete their own inventory" ON public.tool_inventory;

-- Ensure RLS is enabled on the table
ALTER TABLE public.tool_inventory ENABLE ROW LEVEL SECURITY;

-- ============================================
-- CREATE SECURE SELECT POLICY
-- Users can only view their own inventory items
-- ============================================
CREATE POLICY "secure_select_own_inventory"
ON public.tool_inventory
FOR SELECT
USING (
  device_id = COALESCE(
    NULLIF(current_setting('request.headers', true)::json->>'x-device-id', ''),
    '00000000-0000-0000-0000-000000000000'
  )
);

-- ============================================
-- CREATE SECURE INSERT POLICY
-- Users can only insert records with their own device_id
-- ============================================
CREATE POLICY "secure_insert_own_inventory"
ON public.tool_inventory
FOR INSERT
WITH CHECK (
  device_id = COALESCE(
    NULLIF(current_setting('request.headers', true)::json->>'x-device-id', ''),
    '00000000-0000-0000-0000-000000000000'
  )
);

-- ============================================
-- CREATE SECURE UPDATE POLICY
-- Users can only update their own records
-- The USING clause checks existing rows
-- The WITH CHECK clause checks the new values
-- ============================================
CREATE POLICY "secure_update_own_inventory"
ON public.tool_inventory
FOR UPDATE
USING (
  device_id = COALESCE(
    NULLIF(current_setting('request.headers', true)::json->>'x-device-id', ''),
    '00000000-0000-0000-0000-000000000000'
  )
)
WITH CHECK (
  device_id = COALESCE(
    NULLIF(current_setting('request.headers', true)::json->>'x-device-id', ''),
    '00000000-0000-0000-0000-000000000000'
  )
);

-- ============================================
-- CREATE SECURE DELETE POLICY
-- Users can only delete their own records
-- ============================================
CREATE POLICY "secure_delete_own_inventory"
ON public.tool_inventory
FOR DELETE
USING (
  device_id = COALESCE(
    NULLIF(current_setting('request.headers', true)::json->>'x-device-id', ''),
    '00000000-0000-0000-0000-000000000000'
  )
);

-- ============================================
-- VERIFICATION QUERY
-- Run this to verify policies were created correctly
-- ============================================
-- SELECT 
--   schemaname, 
--   tablename, 
--   policyname, 
--   permissive, 
--   roles, 
--   cmd, 
--   qual, 
--   with_check 
-- FROM pg_policies 
-- WHERE tablename = 'tool_inventory'
-- ORDER BY policyname;

-- ============================================
-- ROLLBACK SCRIPT (if needed)
-- ============================================
-- To rollback to the original (insecure) policies, run:
--
-- DROP POLICY IF EXISTS "secure_select_own_inventory" ON public.tool_inventory;
-- DROP POLICY IF EXISTS "secure_insert_own_inventory" ON public.tool_inventory;
-- DROP POLICY IF EXISTS "secure_update_own_inventory" ON public.tool_inventory;
-- DROP POLICY IF EXISTS "secure_delete_own_inventory" ON public.tool_inventory;
--
-- CREATE POLICY "Allow users to view their own inventory" ON public.tool_inventory FOR SELECT USING (true);
-- CREATE POLICY "Allow users to insert inventory" ON public.tool_inventory FOR INSERT WITH CHECK (true);
-- CREATE POLICY "Allow users to update their own inventory" ON public.tool_inventory FOR UPDATE USING (true) WITH CHECK (true);
-- CREATE POLICY "Allow users to delete their own inventory" ON public.tool_inventory FOR DELETE USING (true);
