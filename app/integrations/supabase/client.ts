
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { getDeviceId } from '@/utils/deviceId';

const supabaseUrl = 'https://bnyyfypaudhisookytoq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJueXlmeXBhdWRoaXNvb2t5dG9xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY5NjU1NTUsImV4cCI6MjA1MjU0MTU1NX0.Xt_Uw-Ks5Ym0Uj-Ub9Ub9Ub9Ub9Ub9Ub9Ub9Ub9Ub9U';

// Create the Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
  },
  global: {
    headers: async () => {
      // Get the device ID and include it in all requests
      const deviceId = await getDeviceId();
      return {
        'x-device-id': deviceId,
      };
    },
  },
});

// Helper function to ensure device ID is set before making requests
export async function ensureDeviceId() {
  const deviceId = await getDeviceId();
  console.log('🔐 Device ID ready for requests:', deviceId.substring(0, 8) + '...');
  return deviceId;
}
