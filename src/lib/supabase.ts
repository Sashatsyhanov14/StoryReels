import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder_key';

// Keep the singleton for backwards compatibility in existing code
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false
  },
  global: {
    fetch: (url, options) => {
      const headers = new Headers(options?.headers);
      headers.set('Connection', 'close');
      return fetch(url, {
        ...options,
        headers
      });
    }
  }
});

// Factory function to ensure clean, non-reused socket connections
export function getSupabaseAdmin() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false
    },
    global: {
      fetch: (url, options) => {
        const headers = new Headers(options?.headers);
        headers.set('Connection', 'close');
        return fetch(url, {
          ...options,
          headers
        });
      }
    }
  });
}
