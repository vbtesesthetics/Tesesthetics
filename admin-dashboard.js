// functions/public-portal.js
// Client self-service portal: login with phone+PIN, view bookings, cancel/reschedule
// POST /api/public-portal
// Body: { action: "login"|"set_pin"|"history"|"cancel"|"reschedule"|"lookup_token", ... }

const { getSupabase } = require('./utils/supabase');
const { jsonResponse, corsHeaders, isPhone, rateLimit, getClientIP } = require('./utils/validate');
const { validateSlotAvailable, findNextSuggestions, naiveDatetimeToUtc } = require('./utils/availability');
const crypto = require('crypto');

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return corsHeaders();
    if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });

    const ip = getClientIP(event);
    if (!rateLimit(ip)) return jsonResponse(429, { error: 'Too many requests' });

    let body;
    try { body = JSON.parse(event.body); } catch { return jsonResponse(400, { error: 'Invalid request' }); }

    const supabase = getSupabase();

    try {
        switch (body.action) {
            case 'login': return await handleLogin(supabase, body);
            case 'set_pin': return await handleSetPin(supabase, body);
            case 'history': return await handleHistory(supabase, body);
            case 'cancel': return await handleCancel(supabase, body);
            case 'reschedule': return await handleReschedule(supabase, body);
            case 'lookup_token': return await handleLookupToken(supabase, body);
            default: return jsonResponse(400, { error: 'Unknown action' });
        }
    } catch (err) {
        console.error('Portal error:', err);
        return jsonResponse(500, { error: 'Something went wrong' });
    }
};

// Hash PIN with business-scoped salt
function hashPin(pin, clientId) {
    return crypto.createHash('sha256').update(pin + ':' + clientId).digest('hex');
}

async function resolveClient(supabase, businessSlug, phoneOrEmail) {
    const { data: business } = await supabase
        .from('businesses').select('id, timezone').eq('slug', businessSlug).single();
    if (!business) return { error: 'Business not found' };

    const lookup = (phoneOrEmail || '').trim();
    const isEmail = lookup.includes('@');

    let client = null;
    if (isEmail) {
        const { data } = await supabase
            .from('clients').select('*')
            .eq('business_id', business.id)
            .ilike('email', lookup)
            .maybeSingle();
        client = data;
    } else {
        const { data } = await supabase
            .from('clients').select('*')
            .eq('business_id', business.id)
            .eq('phone', lookup)
            .maybeSingle();
        client = data;
    }

    if (!client) return { error: isEmail ? 'No account found for this email address' : 'No account found for this phone number' };
    return { business, client };
}

async function handleLogin(supabase, body) {
    const { business_slug, phone, email, pin } = body;
    const identifier = phone || email;
    if (!business_slug || !identifier || !pin) return jsonResponse(400, { error: 'Phone or email and PIN are required' });

    const result = await resolveClient(supabase, business_slug, identifier);
    if (result.error) return jsonResponse(404, { error: result.error });
    const { client } = result;

    if (!client.pin_hash) {
        return jsonResponse(400, { error: 'No PIN set yet. Please set a PIN on your next booking.' });
    }

    const hash = hashPin(pin, client.id);
    if (hash !== client.pin_hash) {
        return jsonResponse(401, { error: 'Incorrect PIN' });
    }

    return jsonResponse(200, {
        client_id: client.id,
        name: client.name,
        phone: client.phone,
        email: client.email,
        total_visits: client.total_visits,
        session_token: hashPin(pin, client.id)
    });
}

async function handleSetPin(supabase, body) {
    const { business_slug, phone, email, pin } = body;
    const identifier = phone || email;
    if (!business_slug || !identifier || !pin) return jsonResponse(400, { error: 'Phone or email and PIN are required' });
    if (!/^\d{4}$/.test(pin)) return jsonResponse(400, { error: 'PIN must be exactly 4 digits' });

    const result = await resolveClient(supabase, business_slug, identifier);
    if (result.error) return jsonResponse(404, { error: result.error });
    const { client } = result;

    const hash = hashPin(pin, client.id);
    await supabase.from("clients").update({ pin_hash: hash }).eq("id", client.id);

    return jsonResponse(200, { message: 'PIN set successfully' });
}

async function handleHistory(supabase, body) {
    const { business_slug, phone, email, auth_hash } = body;
    const identifier = phone || email;
    if (!business_slug || !identifier || !auth_hash) return jsonResponse(401, { error: 'Authentication required' });

    const result = await resolveClient(supabase, business_slug, identifier);
    if (result.error) return jsonResponse(404, { error: result.error });
    const { client, business } = result;

    // Verify auth
    if (auth_hash !== client.pin_hash) return jsonResponse(401, { error: 'Invalid session' });

    // Get settings for cancel window
    const { data: settings } = await supabase.from('settings').select('client_cancel_window_hours, client_reschedule_window_hours').eq('business_id', business.id).single();
    const cancelWindowHrs = settings?.client_cancel_window_hours || 24;
    const reschedWindowHrs = settings?.client_reschedule_window_hours || 24;

    // Fetch upcoming and past bookings
    const now = new Date().toISOString();
    const { data: upcoming } = await supabase.from('bookings')
        .select('id, start_at, end_at, status, is_new_client, booking_items(name_snapshot, price_snapshot, minutes_snapshot)')
        .eq('client_id', client.id).gte('start_at', now).in('status', ['confirmed'])
        .order('start_at', { ascending: true }).limit(10);

    const { data: past } = await supabase.from('bookings')
        .select('id, start_at, end_at, status, booking_items(name_snapshot, price_snapshot, minutes_snapshot)')
        .eq('client_id', client.id).lt('start_at', now)
        .order('start_at', { ascending: false }).limit(20);

    // Mark which bookings can be cancelled/rescheduled
    const upcomingWithActions = (upcoming || []).map(b => {
        const hoursUntil = (new Date(b.start_at) - new Date()) / 3600000;
        return {
            ...b,
            can_cancel: hoursUntil >= cancelWindowHrs,
            can_reschedule: hoursUntil >= reschedWindowHrs,
            hours_until: Math.round(hoursUntil)
        };
    });

    return jsonResponse(200, {
        client: { name: client.name, phone: client.phone, email: client.email, total_visits: client.total_visits },
        upcoming: upcomingWithActions,
        past: past || [],
        cancel_window_hours: cancelWindowHrs,
        reschedule_window_hours: reschedWindowHrs,
        timezone: business.timezone
    });
}

async function handleCancel(supabase, body) {
    const { business_slug, phone, auth_hash, booking_id } = body;
    if (!business_slug || !phone || !auth_hash || !booking_id) return jsonResponse(400, { error: 'Missing required fields' });

    const result = await resolveClient(supabase, business_slug, phone);
    if (result.error) return jsonResponse(404, { error: result.error });
    const { client, business } = result;
    if (auth_hash !== client.pin_hash) return jsonResponse(401, { error: 'Invalid session' });

    // Verify booking belongs to client
    const { data: booking } = await supabase.from('bookings')
        .select('*').eq('id', booking_id).eq('client_id', client.id).eq('status', 'confirmed').single();
    if (!booking) return jsonResponse(404, { error: 'Booking not found' });

    // Check cancel window
    const { data: settings } = await supabase.from('settings')
        .select('client_cancel_window_hours').eq('business_id', business.id).single();
    const windowHrs = settings?.client_cancel_window_hours || 24;
    const hoursUntil = (new Date(booking.start_at) - new Date()) / 3600000;
    if (hoursUntil < windowHrs) {
        return jsonResponse(400, { error: `Cancellations must be made at least ${windowHrs} hours before your appointment. Please contact us directly.` });
    }

    await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', booking_id);
    return jsonResponse(200, { message: 'Your appointment has been cancelled.' });
}

async function handleReschedule(supabase, body) {
    const { business_slug, phone, auth_hash, booking_id, new_start_at } = body;
    if (!business_slug || !phone || !auth_hash || !booking_id || !new_start_at) {
        return jsonResponse(400, { error: 'Missing required fields' });
    }

    const result = await resolveClient(supabase, business_slug, phone);
    if (result.error) return jsonResponse(404, { error: result.error });
    const { client, business } = result;
    if (auth_hash !== client.pin_hash) return jsonResponse(401, { error: 'Invalid session' });

    const { data: booking } = await supabase.from('bookings')
        .select('*').eq('id', booking_id).eq('client_id', client.id).eq('status', 'confirmed').single();
    if (!booking) return jsonResponse(404, { error: 'Booking not found' });

    const { data: settings } = await supabase.from('settings')
        .select('client_reschedule_window_hours').eq('business_id', business.id).single();
    const windowHrs = settings?.client_reschedule_window_hours || 24;
    const hoursUntil = (new Date(booking.start_at) - new Date()) / 3600000;
    if (hoursUntil < windowHrs) {
        return jsonResponse(400, { error: `Rescheduling must be done at least ${windowHrs} hours before your appointment.` });
    }

    const origDuration = (new Date(booking.end_at) - new Date(booking.start_at)) / 60000;
    const newStart = new Date(new_start_at);
    const newEnd = new Date(newStart.getTime() + origDuration * 60000);

    // Temporarily cancel for collision check
    await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', booking_id);

    const [rulesRes, blackoutsRes] = await Promise.all([
        supabase.from('availability_rules').select('*').eq('business_id', business.id),
        supabase.from('blackout_blocks').select('*').eq('business_id', business.id).eq('is_active', true)
    ]);

    const settingsFull = (await supabase.from('settings').select('*').eq('business_id', business.id).single()).data || {};

    const validation = await validateSlotAvailable(supabase, {
        businessId: business.id, timezone: business.timezone,
        startAt: newStart.toISOString(), totalDurationMinutes: origDuration,
        settings: settingsFull, availabilityRules: rulesRes.data || [], blackoutBlocks: blackoutsRes.data || []
    });

    if (!validation.valid) {
        await supabase.from('bookings').update({ status: 'confirmed' }).eq('id', booking_id);
        return jsonResponse(409, { error: "Sorry, that time isn't available." });
    }

    await supabase.from('bookings').update({
        start_at: newStart.toISOString(), end_at: newEnd.toISOString(), status: 'confirmed'
    }).eq('id', booking_id);

    return jsonResponse(200, { message: 'Your appointment has been rescheduled!', new_start: newStart.toISOString(), new_end: newEnd.toISOString() });
}

async function handleLookupToken(supabase, body) {
    const { token } = body;
    if (!token) return jsonResponse(400, { error: 'Token required' });

    const { data: tokenData } = await supabase.from('booking_tokens')
        .select('*, bookings(id, start_at, end_at, customer_name, status, business_id, booking_items(name_snapshot, price_snapshot))')
        .eq('token', token).single();

    if (!tokenData) return jsonResponse(404, { error: 'Invalid or expired link' });
    if (tokenData.used_at) return jsonResponse(400, { error: 'This link has already been used' });
    if (new Date(tokenData.expires_at) < new Date()) return jsonResponse(400, { error: 'This link has expired' });

    const booking = tokenData.bookings;
    const { data: business } = await supabase.from('businesses')
        .select('name, timezone, location_text').eq('id', booking.business_id).single();

    return jsonResponse(200, {
        token_id: tokenData.id,
        action: tokenData.action,
        booking: {
            id: booking.id, start_at: booking.start_at, end_at: booking.end_at,
            customer_name: booking.customer_name, status: booking.status,
            items: booking.booking_items
        },
        business
    });
}
