
import 'react-native-url-polyfill/auto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getDeviceId } from '@/utils/deviceId';

const supabaseUrl = 'https://bnyyfypaudhisookytoq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJueXlmeXBhdWRoaXNvb2t5dG9xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyMjgzMzYsImV4cCI6MjA3NjgwNDMzNn0.hVohhc8A5JppFVXC2ztZtj1sxmio34q5VYB6XG1N4cw';

// Cache for the Supabase client instance with device ID
let supabaseInstance: SupabaseClient | null = null;
let currentDeviceId: string | null = null;
let initializationPromise: Promise<SupabaseClient> | null = null;

/**
 * Get or create a Supabase client with the device ID in headers.
 * This enables Row-Level Security (RLS) policies to verify device ownership.
 * 
 * The device ID is passed via the 'x-device-id' header and can be accessed
 * in RLS policies using: current_setting('request.headers', true)::json->>'x-device-id'
 */
export async function getSupabaseClient(): Promise<SupabaseClient> {
  // If we're already initializing, wait for that to complete
  if (initializationPromise) {
    return initializationPromise;
  }

  const deviceId = await getDeviceId();
  
  // Return cached instance if device ID hasn't changed
  if (supabaseInstance && currentDeviceId === deviceId) {
    return supabaseInstance;
  }

  // Create initialization promise to prevent race conditions
  initializationPromise = (async () => {
    try {
      currentDeviceId = deviceId;
      
      supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
        global: {
          headers: {
            'apikey': supabaseAnonKey,
            'x-device-id': deviceId,
          },
        },
      });
      
      console.log('✅ Supabase client initialized with device ID:', deviceId.substring(0, 8) + '...');
      return supabaseInstance;
    } finally {
      initializationPromise = null;
    }
  })();

  return initializationPromise;
}

/**
 * Reset the cached Supabase client.
 * Useful when device ID changes or for testing purposes.
 */
export function resetSupabaseClient(): void {
  supabaseInstance = null;
  currentDeviceId = null;
  initializationPromise = null;
  console.log('🔄 Supabase client cache cleared');
}

/**
 * @deprecated Use getSupabaseClient() instead for RLS-secured operations.
 * This synchronous client does NOT include the device ID header and should
 * only be used for operations that don't require RLS verification.
 * 
 * WARNING: Using this client may result in RLS policy failures once
 * secure policies are applied to the database.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  global: {
    headers: {
      'apikey': supabaseAnonKey,
    },
  },
});

// Export configuration for testing
export const SUPABASE_URL = supabaseUrl;
export const SUPABASE_ANON_KEY = supabaseAnonKey;

console.log('✅ Supabase module loaded');
console.log('📡 Supabase URL:', supabaseUrl);
console.log('🔑 Anon key configured (length:', supabaseAnonKey.length, ')');
