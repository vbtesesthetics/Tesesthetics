// functions/utils/auth.js
// Validates Supabase JWT for admin endpoints

const { createClient } = require('@supabase/supabase-js');

/**
 * Verify admin auth from Authorization header.
 * Returns { user, adminUser, businessId } or throws.
 */
async function requireAdmin(event, supabase) {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw { status: 401, message: 'Missing or invalid authorization header' };
    }

    const token = authHeader.replace('Bearer ', '');

    // Verify JWT with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
        throw { status: 401, message: 'Invalid or expired token' };
    }

    // Look up admin_users record
    const { data: adminUser, error: adminError } = await supabase
        .from('admin_users')
        .select('id, business_id, role, display_name')
        .eq('auth_user_id', user.id)
        .single();

    if (adminError || !adminUser) {
        throw { status: 403, message: 'User is not an admin' };
    }

    return {
        user,
        adminUser,
        businessId: adminUser.business_id
    };
}

module.exports = { requireAdmin };
