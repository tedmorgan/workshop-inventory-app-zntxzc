
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bnyyfypaudhisookytoq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJueXlmeXBhdWRoaXNvb2t5dG9xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY5NjU1NTUsImV4cCI6MjA1MjU0MTU1NX0.Xt_Uw-Ks5Ym0Uj-Ub9Ub9Ub9Ub9Ub9Ub9Ub9Ub9Ub9U';

// Create the Supabase client
// The client will automatically add the Authorization header with the anon key
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

console.log('✅ Supabase client initialized');
console.log('📡 Supabase URL:', supabaseUrl);
console.log('🔑 Anon key configured');
