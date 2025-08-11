import { createClient } from '@supabase/supabase-js';
import { auth } from './firebase';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  accessToken: async () => {
    const user = auth.currentUser;
    if (user) {
      try {
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