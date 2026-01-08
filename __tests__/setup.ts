/**
 * Jest setup file for Workshop Inventory App tests
 * This file configures mocks and test environment
 * Created: 2026-01-08
 */

// Mock react-native-url-polyfill
jest.mock('react-native-url-polyfill/auto', function() { return {}; });

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', function() {
  return {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  };
});

// Mock expo-application
jest.mock('expo-application', function() {
  return {
    getIosIdForVendorAsync: jest.fn().mockResolvedValue('test-ios-device-id'),
    getAndroidId: jest.fn().mockReturnValue('test-android-device-id'),
    getDeviceNameAsync: jest.fn().mockResolvedValue('Test Device'),
  };
});

// Mock Platform
jest.mock('react-native', function() {
  return {
    Platform: {
      OS: 'ios',
      Version: '15.0',
    },
  };
});

// Mock the Supabase client creation
jest.mock('@supabase/supabase-js', function() {
  return {
    createClient: jest.fn().mockImplementation(function(url, key, options) {
      // Return a mock Supabase client
      var mockClient = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnThis(),
          insert: jest.fn().mockReturnThis(),
          update: jest.fn().mockReturnThis(),
          delete: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
        storage: {
          from: jest.fn().mockReturnValue({
            upload: jest.fn().mockResolvedValue({ data: { path: 'test.jpg' }, error: null }),
            getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: 'https://test.url/test.jpg' } }),
          }),
        },
        functions: {
          invoke: jest.fn().mockResolvedValue({ data: {}, error: null }),
        },
        auth: {
          getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
        },
        _options: options,
        _url: url,
        _key: key,
      };
      return mockClient;
    }),
  };
});

// Global test timeout
jest.setTimeout(10000);

// Cleanup after each test
afterEach(function() {
  jest.clearAllMocks();
});

console.log('✅ Jest setup complete - ' + new Date().toISOString());
