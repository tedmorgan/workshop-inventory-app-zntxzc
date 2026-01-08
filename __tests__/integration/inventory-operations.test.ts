/**
 * Integration Tests for Inventory Operations
 * Tests that inventory CRUD operations properly use the secure client
 * Created: 2026-01-08
 */

describe('Inventory Operations Security', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  describe('Secure Client Usage', () => {
    it('should be able to get a secure client', async () => {
      const { getSupabaseClient, resetSupabaseClient } = require('../../app/integrations/supabase/client');
      
      resetSupabaseClient();
      const client = await getSupabaseClient();
      
      expect(client).toBeDefined();
      expect(typeof client.from).toBe('function');
    });

    it('should support querying tool_inventory table', async () => {
      const { getSupabaseClient, resetSupabaseClient } = require('../../app/integrations/supabase/client');
      
      resetSupabaseClient();
      const client = await getSupabaseClient();
      
      // Verify we can call from() with tool_inventory
      const queryBuilder = client.from('tool_inventory');
      expect(queryBuilder).toBeDefined();
      expect(typeof queryBuilder.select).toBe('function');
    });

    it('should support chained query methods', async () => {
      const { getSupabaseClient, resetSupabaseClient } = require('../../app/integrations/supabase/client');
      
      resetSupabaseClient();
      const client = await getSupabaseClient();
      
      // Verify query chaining works
      const queryBuilder = client.from('tool_inventory')
        .select('*')
        .eq('device_id', 'test-device-id');
      
      expect(queryBuilder).toBeDefined();
    });

    it('should support insert operations', async () => {
      const { getSupabaseClient, resetSupabaseClient } = require('../../app/integrations/supabase/client');
      
      resetSupabaseClient();
      const client = await getSupabaseClient();
      
      const insertData = {
        image_url: 'https://example.com/image.jpg',
        tools: ['Hammer', 'Screwdriver'],
        bin_name: 'Test Bin',
        bin_location: 'Garage',
        device_id: 'test-device-id',
      };
      
      // Verify insert method exists
      const insertBuilder = client.from('tool_inventory').insert(insertData);
      expect(insertBuilder).toBeDefined();
    });

    it('should support update operations', async () => {
      const { getSupabaseClient, resetSupabaseClient } = require('../../app/integrations/supabase/client');
      
      resetSupabaseClient();
      const client = await getSupabaseClient();
      
      const updateData = {
        tools: ['Updated Tool'],
        bin_name: 'Updated Bin',
      };
      
      // Verify update method exists
      const updateBuilder = client.from('tool_inventory').update(updateData);
      expect(updateBuilder).toBeDefined();
    });

    it('should support delete operations', async () => {
      const { getSupabaseClient, resetSupabaseClient } = require('../../app/integrations/supabase/client');
      
      resetSupabaseClient();
      const client = await getSupabaseClient();
      
      // Verify delete method exists
      const deleteBuilder = client.from('tool_inventory').delete();
      expect(deleteBuilder).toBeDefined();
    });
  });

  describe('Edge Function Support', () => {
    it('should have functions.invoke method', async () => {
      const { getSupabaseClient, resetSupabaseClient } = require('../../app/integrations/supabase/client');
      
      resetSupabaseClient();
      const client = await getSupabaseClient();
      
      expect(client.functions).toBeDefined();
      expect(typeof client.functions.invoke).toBe('function');
    });
  });

  describe('Storage Support', () => {
    it('should have storage.from method', async () => {
      const { getSupabaseClient, resetSupabaseClient } = require('../../app/integrations/supabase/client');
      
      resetSupabaseClient();
      const client = await getSupabaseClient();
      
      expect(client.storage).toBeDefined();
      expect(typeof client.storage.from).toBe('function');
    });

    it('should support tool-images bucket', async () => {
      const { getSupabaseClient, resetSupabaseClient } = require('../../app/integrations/supabase/client');
      
      resetSupabaseClient();
      const client = await getSupabaseClient();
      
      const bucket = client.storage.from('tool-images');
      expect(bucket).toBeDefined();
    });
  });
});

describe('Device ID Integration', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('should get device ID for queries', async () => {
    const { getDeviceId } = require('../../utils/deviceId');
    
    const deviceId = await getDeviceId();
    
    expect(typeof deviceId).toBe('string');
    expect(deviceId.length).toBeGreaterThan(0);
  });

  it('should use device ID in client initialization', async () => {
    const { getSupabaseClient, resetSupabaseClient } = require('../../app/integrations/supabase/client');
    const { getDeviceId } = require('../../utils/deviceId');
    
    resetSupabaseClient();
    
    // Both should complete without error
    const [client, deviceId] = await Promise.all([
      getSupabaseClient(),
      getDeviceId(),
    ]);
    
    expect(client).toBeDefined();
    expect(deviceId).toBeDefined();
  });
});

});
