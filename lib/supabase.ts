import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://mdorxlwvitfixbzajksw.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1kb3J4bHd2aXRmaXhiemFqa3N3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NzE2NTcsImV4cCI6MjEwMTQ0NzY1N30.HXoHD3JGXmq_kIkcJ0XJJaMX_BCyukwG7EawZb738mw';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  global: {
    fetch: (url, options = {}) => {
      return fetch(url, {
        ...options,
        cache: 'no-store',
      });
    },
  },
});
