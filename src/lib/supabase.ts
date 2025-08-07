// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import { auth } from './firebase';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Create a Supabase client with Firebase authentication integration
// This enables RLS policies to work with Firebase auth via auth.uid()
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  accessToken: async () => {
    const user = auth.currentUser;
    if (user) {
      try {
        // Force refresh to get updated custom claims (role: 'authenticated')
        // This is essential for Supabase RLS policies to recognize Firebase users
        const token = await user.getIdToken(true);
        return token;
      } catch (error) {
        console.error('Error getting Firebase ID token:', error);
        return null;
      }
    }
    return null;
  },
});