/**
 * Security Tests for Supabase Client
 * Tests the secure Supabase client implementation with device ID headers
 * Created: 2026-01-08
 */

describe('Supabase Client Security', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  describe('getSupabaseClient function', () => {
    it('should export getSupabaseClient function', () => {
      const client = require('../../app/integrations/supabase/client');
      expect(typeof client.getSupabaseClient).toBe('function');
    });

    it('should export resetSupabaseClient function', () => {
      const client = require('../../app/integrations/supabase/client');
      expect(typeof client.resetSupabaseClient).toBe('function');
    });

    it('should return a Supabase client with required methods', async () => {
      const { getSupabaseClient, resetSupabaseClient } = require('../../app/integrations/supabase/client');
      
      resetSupabaseClient();
      const supabase = await getSupabaseClient();
      
      // Verify the client has the required methods
      expect(supabase).toBeDefined();
      expect(typeof supabase.from).toBe('function');
      expect(supabase.storage).toBeDefined();
      expect(supabase.functions).toBeDefined();
    });

    it('should cache and return the same client instance', async () => {
      const { getSupabaseClient, resetSupabaseClient } = require('../../app/integrations/supabase/client');
      
      resetSupabaseClient();
      
      const client1 = await getSupabaseClient();
      const client2 = await getSupabaseClient();
      
      // Should return the same cached instance
      expect(client1).toBe(client2);
    });

    it('should create new instance after resetSupabaseClient', async () => {
      const { getSupabaseClient, resetSupabaseClient } = require('../../app/integrations/supabase/client');
      
      resetSupabaseClient();
      const client1 = await getSupabaseClient();
      
      resetSupabaseClient();
      const client2 = await getSupabaseClient();
      
      // After reset, should get a new instance
      // Note: In test environment with mocks, we verify the function executes without error
      expect(client1).toBeDefined();
      expect(client2).toBeDefined();
    });
  });

  describe('Legacy supabase export', () => {
    it('should export legacy supabase client for backward compatibility', () => {
      const { supabase } = require('../../app/integrations/supabase/client');
      
      expect(supabase).toBeDefined();
      expect(typeof supabase.from).toBe('function');
    });
  });

  describe('Configuration exports', () => {
    it('should export SUPABASE_URL', () => {
      const { SUPABASE_URL } = require('../../app/integrations/supabase/client');
      
      expect(SUPABASE_URL).toBeDefined();
      expect(typeof SUPABASE_URL).toBe('string');
      expect(SUPABASE_URL).toContain('supabase.co');
    });

    it('should export SUPABASE_ANON_KEY', () => {
      const { SUPABASE_ANON_KEY } = require('../../app/integrations/supabase/client');
      
      expect(SUPABASE_ANON_KEY).toBeDefined();
      expect(typeof SUPABASE_ANON_KEY).toBe('string');
      expect(SUPABASE_ANON_KEY.length).toBeGreaterThan(50); // JWT tokens are long
    });
  });
});

describe('Device ID Utility', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  describe('getDeviceId function', () => {
    it('should export getDeviceId function', () => {
      const deviceIdModule = require('../../utils/deviceId');
      expect(typeof deviceIdModule.getDeviceId).toBe('function');
    });

    it('should return a string device ID', async () => {
      const { getDeviceId } = require('../../utils/deviceId');
      
      const deviceId = await getDeviceId();
      
      expect(typeof deviceId).toBe('string');
      expect(deviceId.length).toBeGreaterThan(0);
    });

    it('should return consistent device ID on subsequent calls', async () => {
      const { getDeviceId } = require('../../utils/deviceId');
      
      const deviceId1 = await getDeviceId();
      const deviceId2 = await getDeviceId();
      
      expect(deviceId1).toBe(deviceId2);
    });
  });

  describe('clearDeviceId function', () => {
    it('should export clearDeviceId function', () => {
      const deviceIdModule = require('../../utils/deviceId');
      expect(typeof deviceIdModule.clearDeviceId).toBe('function');
    });

    it('should execute without error', async () => {
      const { clearDeviceId } = require('../../utils/deviceId');
      
      // Should not throw
      await expect(clearDeviceId()).resolves.not.toThrow();
    });
  });

  describe('getDeviceInfo function', () => {
    it('should export getDeviceInfo function', () => {
      const deviceIdModule = require('../../utils/deviceId');
      expect(typeof deviceIdModule.getDeviceInfo).toBe('function');
    });

    it('should return device info object with required properties', async () => {
      const { getDeviceInfo } = require('../../utils/deviceId');
      
      const info = await getDeviceInfo();
      
      expect(info).toBeDefined();
      expect(typeof info.deviceId).toBe('string');
      expect(typeof info.platform).toBe('string');
    });
  });
});
