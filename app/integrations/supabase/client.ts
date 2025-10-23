import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Database } from './types';
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = "https://bnyyfypaudhisookytoq.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJueXlmeXBhdWRoaXNvb2t5dG9xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyMjgzMzYsImV4cCI6MjA3NjgwNDMzNn0.hVohhc8A5JppFVXC2ztZtj1sxmio34q5VYB6XG1N4cw";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
