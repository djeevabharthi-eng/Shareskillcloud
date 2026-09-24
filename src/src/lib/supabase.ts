import { createClient } from '@supabase/supabase-js';
import type { UserProfile } from '../types.ts';

// Public (browser-safe) values. Override on your host with
// VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY if you ever change project.
const SUPABASE_URL: string =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ||
  'https://ztoxgqzpizbruegitgpd.supabase.co';
const SUPABASE_ANON_KEY: string =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ||
  'sb_publishable_0-yfYSxRRHOJwIS5t61cPA_N7rPinpc';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// Keep the latest access token in memory so API calls (and the SSE stream)
// can use it synchronously.
let accessToken = '';
supabase.auth.onAuthStateChange((_event, session) => {
  accessToken = session?.access_token || '';
});
export const getAccessToken = () => accessToken;

/** Fallback profile built from the Supabase auth user (used if /api/profile fails). */
export function formatSupabaseUser(user: any): UserProfile {
  const meta = user?.user_metadata || {};
  const email: string = user?.email || '';
  return {
    id: user.id,
    name: meta.full_name || meta.name || (email ? email.split('@')[0].replace(/[._-]/g, ' ') : 'Member'),
    email,
    city: meta.city || 'Online',
    country: meta.country || 'Global',
    bio: meta.bio || '',
    avatarUrl: meta.avatar_url || meta.picture || '',
    teachSkills: [],
    learnSkills: [],
    availability: 'Flexible / anytime',
    locationPreference: 'Online',
  };
}
