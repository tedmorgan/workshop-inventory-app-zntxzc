/**
 * RLS Policy Tests
 * Tests to verify the SQL RLS policy structure and logic
 * These tests validate the policy definitions are correct
 * Created: 2026-01-08
 */

import * as fs from 'fs';
import * as path from 'path';

describe('RLS Policy SQL Migration', () => {
  let sqlContent: string;

  beforeAll(() => {
    const sqlPath = path.join(__dirname, '../../supabase/migrations/001_secure_rls_policies.sql');
    sqlContent = fs.readFileSync(sqlPath, 'utf-8');
  });

  describe('Policy Existence', () => {
    it('should drop existing insecure policies', () => {
      // Check that we drop the old insecure policies
      expect(sqlContent).toContain('DROP POLICY IF EXISTS "Allow users to delete their own inventory"');
      expect(sqlContent).toContain('DROP POLICY IF EXISTS "Allow users to insert inventory"');
      expect(sqlContent).toContain('DROP POLICY IF EXISTS "Allow users to update their own inventory"');
      expect(sqlContent).toContain('DROP POLICY IF EXISTS "Allow users to view their own inventory"');
    });

    it('should create secure SELECT policy', () => {
      expect(sqlContent).toContain('CREATE POLICY "secure_select_own_inventory"');
      expect(sqlContent).toContain('ON public.tool_inventory');
      expect(sqlContent).toContain('FOR SELECT');
    });

    it('should create secure INSERT policy', () => {
      expect(sqlContent).toContain('CREATE POLICY "secure_insert_own_inventory"');
      expect(sqlContent).toContain('FOR INSERT');
      expect(sqlContent).toContain('WITH CHECK');
    });

    it('should create secure UPDATE policy', () => {
      expect(sqlContent).toContain('CREATE POLICY "secure_update_own_inventory"');
      expect(sqlContent).toContain('FOR UPDATE');
      // UPDATE policies need both USING and WITH CHECK
      const updatePolicySection = sqlContent.substring(
        sqlContent.indexOf('CREATE POLICY "secure_update_own_inventory"'),
        sqlContent.indexOf('CREATE POLICY "secure_delete_own_inventory"')
      );
      expect(updatePolicySection).toContain('USING');
      expect(updatePolicySection).toContain('WITH CHECK');
    });

    it('should create secure DELETE policy', () => {
      expect(sqlContent).toContain('CREATE POLICY "secure_delete_own_inventory"');
      expect(sqlContent).toContain('FOR DELETE');
    });
  });

  describe('Policy Security', () => {
    it('should NOT use USING (true) - insecure pattern in active policies', () => {
      // Check that the secure policies (not in rollback comments) don't use USING (true)
      // Split content at ROLLBACK SCRIPT comment to only check active policies
      const activeContent = sqlContent.split('ROLLBACK SCRIPT')[0];
      
      // Extract just the CREATE POLICY statements from active content
      const createPolicyStatements = activeContent.split('CREATE POLICY');
      
      for (const statement of createPolicyStatements.slice(1)) { // Skip first split part
        // Check that the statement doesn't contain just USING (true)
        const usingMatch = statement.match(/USING\s*\(\s*true\s*\)/i);
        // The secure policies should NOT have USING (true)
        expect(usingMatch).toBeNull();
      }
    });

    it('should NOT use WITH CHECK (true) - insecure pattern in active policies', () => {
      // Check that the secure policies (not in rollback comments) don't use WITH CHECK (true)
      // Split content at ROLLBACK SCRIPT comment to only check active policies
      const activeContent = sqlContent.split('ROLLBACK SCRIPT')[0];
      
      // Extract just the CREATE POLICY statements from active content
      const createPolicyStatements = activeContent.split('CREATE POLICY');
      
      for (const statement of createPolicyStatements.slice(1)) { // Skip first split part
        // Check that the statement doesn't contain just WITH CHECK (true)
        const withCheckMatch = statement.match(/WITH CHECK\s*\(\s*true\s*\)/i);
        // The secure policies should NOT have WITH CHECK (true)
        expect(withCheckMatch).toBeNull();
      }
    });

    it('should check device_id against x-device-id header', () => {
      // All policies should check device_id against the header
      expect(sqlContent).toContain("device_id = COALESCE");
      expect(sqlContent).toContain("current_setting('request.headers', true)::json->>'x-device-id'");
    });

    it('should use COALESCE with fallback for missing header', () => {
      // Should have NULLIF to handle empty strings
      expect(sqlContent).toContain('NULLIF(');
      
      // Should have a fallback UUID that will never match real data
      expect(sqlContent).toContain("'00000000-0000-0000-0000-000000000000'");
    });

    it('should enable RLS on the table', () => {
      expect(sqlContent).toContain('ALTER TABLE public.tool_inventory ENABLE ROW LEVEL SECURITY');
    });
  });

  describe('Policy Logic Verification', () => {
    it('should have consistent logic across all policies', () => {
      // Count occurrences of the device_id check pattern
      const deviceIdCheckPattern = /device_id\s*=\s*COALESCE/g;
      const matches = sqlContent.match(deviceIdCheckPattern);
      
      // Should have at least 4 occurrences (SELECT, INSERT, UPDATE USING, UPDATE WITH CHECK, DELETE)
      // UPDATE has 2 - one in USING and one in WITH CHECK
      expect(matches).toBeDefined();
      expect(matches!.length).toBeGreaterThanOrEqual(4);
    });

    it('should target the correct table', () => {
      // All policies should be on public.tool_inventory
      // Only count active policies (before ROLLBACK section)
      const activeContent = sqlContent.split('ROLLBACK SCRIPT')[0];
      const onTablePattern = /ON\s+public\.tool_inventory/g;
      const matches = activeContent.match(onTablePattern);
      
      // Should have at least 4 occurrences (one for each policy, plus ALTER TABLE)
      expect(matches).toBeDefined();
      expect(matches!.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('Documentation', () => {
    it('should include rollback instructions', () => {
      expect(sqlContent).toContain('ROLLBACK SCRIPT');
      expect(sqlContent).toContain('DROP POLICY IF EXISTS "secure_');
    });

    it('should include verification query', () => {
      expect(sqlContent).toContain('VERIFICATION QUERY');
      expect(sqlContent).toContain('pg_policies');
    });

    it('should have creation date', () => {
      expect(sqlContent).toContain('2026-01-08');
    });
  });
});
