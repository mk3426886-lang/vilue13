/**
 * Vilue — Supabase client
 * The backend always connects with the service_role key (full access,
 * bypasses Row Level Security) — this key must never be sent to the
 * frontend or committed to git. Every table access in /backend goes
 * through this one client.
 */

const { createClient } = require('@supabase/supabase-js');

let client = null;

function getSupabase() {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Supabase not configured — set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env'
    );
  }

  client = createClient(url, key, {
    auth: { persistSession: false },
  });

  return client;
}

module.exports = { getSupabase };
