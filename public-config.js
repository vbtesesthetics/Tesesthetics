// functions/utils/supabase.js
// Supabase client factory for serverless functions
// Uses service_role key (server-side only, never exposed to client)

const { createClient } = require('@supabase/supabase-js');

let _client = null;

function getSupabase() {
    if (!_client) {
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !key) {
            throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');
        }
        _client = createClient(url, key, {
            auth: { autoRefreshToken: false, persistSession: false }
        });
    }
    return _client;
}

// Get anon client (for public operations with RLS)
function getAnonSupabase() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    if (!url || !key) {
        throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY env vars');
    }
    return createClient(url, key);
}

module.exports = { getSupabase, getAnonSupabase };
