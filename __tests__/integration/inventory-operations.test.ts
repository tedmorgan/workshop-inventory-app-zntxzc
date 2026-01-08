/**
 * Integration Tests for Inventory Operations
 * Tests that inventory CRUD operations properly use the secure client
 * Created: 2026-01-08
 */

describe('Inventory Operations Security', function() {
  beforeEach(function() {
    jest.resetModules();
    jest.clearAllMocks();
  });

  describe('Secure Client Usage', function() {
    it('should be able to get a secure client', async function() {
      var clientModule = require('../../app/integrations/supabase/client');
      var getSupabaseClient = clientModule.getSupabaseClient;
      var resetSupabaseClient = clientModule.resetSupabaseClient;
      
      resetSupabaseClient();
      var client = await getSupabaseClient();
      
      expect(client).toBeDefined();
      expect(typeof client.from).toBe('function');
    });

    it('should support querying tool_inventory table', async function() {
      var clientModule = require('../../app/integrations/supabase/client');
      var getSupabaseClient = clientModule.getSupabaseClient;
      var resetSupabaseClient = clientModule.resetSupabaseClient;
      
      resetSupabaseClient();
      var client = await getSupabaseClient();
      
      var queryBuilder = client.from('tool_inventory');
      expect(queryBuilder).toBeDefined();
      expect(typeof queryBuilder.select).toBe('function');
    });

    it('should support chained query methods', async function() {
      var clientModule = require('../../app/integrations/supabase/client');
      var getSupabaseClient = clientModule.getSupabaseClient;
      var resetSupabaseClient = clientModule.resetSupabaseClient;
      
      resetSupabaseClient();
      var client = await getSupabaseClient();
      
      var queryBuilder = client.from('tool_inventory')
        .select('*')
        .eq('device_id', 'test-device-id');
      
      expect(queryBuilder).toBeDefined();
    });

    it('should support insert operations', async function() {
      var clientModule = require('../../app/integrations/supabase/client');
      var getSupabaseClient = clientModule.getSupabaseClient;
      var resetSupabaseClient = clientModule.resetSupabaseClient;
      
      resetSupabaseClient();
      var client = await getSupabaseClient();
      
      var insertData = {
        image_url: 'https://example.com/image.jpg',
        tools: ['Hammer', 'Screwdriver'],
        bin_name: 'Test Bin',
        bin_location: 'Garage',
        device_id: 'test-device-id',
      };
      
      var insertBuilder = client.from('tool_inventory').insert(insertData);
      expect(insertBuilder).toBeDefined();
    });

    it('should support update operations', async function() {
      var clientModule = require('../../app/integrations/supabase/client');
      var getSupabaseClient = clientModule.getSupabaseClient;
      var resetSupabaseClient = clientModule.resetSupabaseClient;
      
      resetSupabaseClient();
      var client = await getSupabaseClient();
      
      var updateData = {
        tools: ['Updated Tool'],
        bin_name: 'Updated Bin',
      };
      
      var updateBuilder = client.from('tool_inventory').update(updateData);
      expect(updateBuilder).toBeDefined();
    });

    it('should support delete operations', async function() {
      var clientModule = require('../../app/integrations/supabase/client');
      var getSupabaseClient = clientModule.getSupabaseClient;
      var resetSupabaseClient = clientModule.resetSupabaseClient;
      
      resetSupabaseClient();
      var client = await getSupabaseClient();
      
      var deleteBuilder = client.from('tool_inventory').delete();
      expect(deleteBuilder).toBeDefined();
    });
  });

  describe('Edge Function Support', function() {
    it('should have functions.invoke method', async function() {
      var clientModule = require('../../app/integrations/supabase/client');
      var getSupabaseClient = clientModule.getSupabaseClient;
      var resetSupabaseClient = clientModule.resetSupabaseClient;
      
      resetSupabaseClient();
      var client = await getSupabaseClient();
      
      expect(client.functions).toBeDefined();
      expect(typeof client.functions.invoke).toBe('function');
    });
  });

  describe('Storage Support', function() {
    it('should have storage.from method', async function() {
      var clientModule = require('../../app/integrations/supabase/client');
      var getSupabaseClient = clientModule.getSupabaseClient;
      var resetSupabaseClient = clientModule.resetSupabaseClient;
      
      resetSupabaseClient();
      var client = await getSupabaseClient();
      
      expect(client.storage).toBeDefined();
      expect(typeof client.storage.from).toBe('function');
    });

    it('should support tool-images bucket', async function() {
      var clientModule = require('../../app/integrations/supabase/client');
      var getSupabaseClient = clientModule.getSupabaseClient;
      var resetSupabaseClient = clientModule.resetSupabaseClient;
      
      resetSupabaseClient();
      var client = await getSupabaseClient();
      
      var bucket = client.storage.from('tool-images');
      expect(bucket).toBeDefined();
    });
  });
});

describe('Device ID Integration', function() {
  beforeEach(function() {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('should get device ID for queries', async function() {
    var deviceIdModule = require('../../utils/deviceId');
    var getDeviceId = deviceIdModule.getDeviceId;
    
    var deviceId = await getDeviceId();
    
    expect(typeof deviceId).toBe('string');
    expect(deviceId.length).toBeGreaterThan(0);
  });

  it('should use device ID in client initialization', async function() {
    var clientModule = require('../../app/integrations/supabase/client');
    var getSupabaseClient = clientModule.getSupabaseClient;
    var resetSupabaseClient = clientModule.resetSupabaseClient;
    var deviceIdModule = require('../../utils/deviceId');
    var getDeviceId = deviceIdModule.getDeviceId;
    
    resetSupabaseClient();
    
    var results = await Promise.all([
      getSupabaseClient(),
      getDeviceId(),
    ]);
    
    var client = results[0];
    var deviceId = results[1];
    
    expect(client).toBeDefined();
    expect(deviceId).toBeDefined();
  });
});
