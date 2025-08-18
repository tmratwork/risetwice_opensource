import { createClient } from '@supabase/supabase-js';
import { auth } from './firebase';
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY
} from '@env';

// Debug log to confirm Supabase environment variables are loaded
console.log('Supabase config loaded:', {
  url: SUPABASE_URL ? `${SUPABASE_URL.substring(0, 20)}...` : 'undefined',
  anonKey: SUPABASE_ANON_KEY ? `${SUPABASE_ANON_KEY.substring(0, 20)}...` : 'undefined'
});

// Validate required environment variables
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ CRITICAL: Missing Supabase environment variables');
  console.error('SUPABASE_URL:', SUPABASE_URL ? 'defined' : 'undefined');
  console.error('SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? 'defined' : 'undefined');
  throw new Error('Missing required Supabase environment variables');
}

console.log('✅ Creating Supabase client with validated environment variables');

// Create Supabase client without Firebase auth integration for now
// This prevents URL protocol errors in React Native
console.log('Creating Supabase client for React Native...');

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: undefined, // Let Supabase use default storage
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false // Important for React Native
  },
});

console.log('✅ Supabase client created successfully');