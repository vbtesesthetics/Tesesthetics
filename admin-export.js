// functions/public-availability.js
// POST /api/public-availability
// Returns available time slots for a date range
// IMPORTANT: Never reveals WHY a slot is unavailable

const { getSupabase } = require('./utils/supabase');
const { jsonResponse, corsHeaders, isSlug, isUUID, rateLimit, getClientIP } = require('./utils/validate');
const { generateAvailableSlots, computeTotalDuration, findNextSuggestions } = require('./utils/availability');

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return corsHeaders();
    if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });

    const ip = getClientIP(event);
    if (!rateLimit(ip)) return jsonResponse(429, { error: 'Too many requests. Please try again shortly.' });

    let body;
    try {
        body = JSON.parse(event.body);
    } catch {
        return jsonResponse(400, { error: 'Invalid request' });
    }

    const { business_slug, date_from, date_to, service_ids, add_on_ids, is_new_client } = body;

    // Validate inputs
    if (!business_slug || !isSlug(business_slug)) {
        return jsonResponse(400, { error: 'Invalid business identifier' });
    }
    if (!date_from || !date_to) {
        return jsonResponse(400, { error: 'Date range is required' });
    }
    if (!Array.isArray(service_ids) || service_ids.length === 0 || service_ids.some(id => !isUUID(id))) {
        return jsonResponse(400, { error: 'Please select at least one service' });
    }

    // Limit date range to 7 days for performance
    const from = new Date(date_from);
    const to = new Date(date_to);
    if (isNaN(from) || isNaN(to)) {
        return jsonResponse(400, { error: 'Invalid date range' });
    }
    const daysDiff = (to - from) / 86400000;
    if (daysDiff > 7 || daysDiff < 0) {
        return jsonResponse(400, { error: 'Date range must be 1-7 days' });
    }

    try {
        const supabase = getSupabase();

        // Resolve business
        const { data: business } = await supabase
            .from('businesses')
            .select('id, timezone')
            .eq('slug', business_slug)
            .single();

        if (!business) return jsonResponse(404, { error: 'Business not found' });
        const businessId = business.id;
        const timezone = business.timezone;

        // Fetch all needed data in parallel
        const [servicesRes, addOnsRes, settingsRes, rulesRes, blackoutsRes, oneOffsRes, bookingsRes] = await Promise.all([
            supabase.from('services').select('*').eq('business_id', businessId).in('id', service_ids),
            add_on_ids?.length
                ? supabase.from('add_ons').select('*').eq('business_id', businessId).in('id', add_on_ids)
                : { data: [] },
            supabase.from('settings').select('*').eq('business_id', businessId).single(),
            supabase.from('availability_rules').select('*').eq('business_id', businessId),
            supabase.from('blackout_blocks').select('*').eq('business_id', businessId).eq('is_active', true),
            supabase.from('one_off_blocks').select('*').eq('business_id', businessId),
            supabase.from('bookings').select('id, start_at, end_at, status')
                .eq('business_id', businessId)
                .eq('status', 'confirmed')
                .gte('start_at', new Date(date_from + 'T00:00:00Z').toISOString())
                .lte('start_at', new Date(date_to + 'T23:59:59Z').toISOString())
        ]);

        const services = servicesRes.data || [];
        const addOns = addOnsRes.data || [];
        const settings = settingsRes.data || {};

        if (services.length !== service_ids.length) {
            return jsonResponse(400, { error: 'One or more selected services are not available' });
        }

        // Compute total appointment duration
        const totalDuration = computeTotalDuration(services, addOns, settings, !!is_new_client);

        // Generate available slots
        const available_slots = generateAvailableSlots({
            businessId,
            timezone,
            dateFrom: date_from,
            dateTo: date_to,
            totalDurationMinutes: totalDuration,
            settings,
            availabilityRules: rulesRes.data || [],
            blackoutBlocks: blackoutsRes.data || [],
            oneOffBlocks: oneOffsRes.data || [],
            existingBookings: bookingsRes.data || []
        });

        // If no slots found, find next suggestions
        let next_suggestions = [];
        if (available_slots.length === 0) {
            next_suggestions = await findNextSuggestions(supabase, {
                businessId,
                timezone,
                startDate: date_to, // Start looking from end of requested range
                totalDurationMinutes: totalDuration,
                settings
            }, 5);
        }

        return jsonResponse(200, {
            available_slots,
            next_suggestions,
            total_duration_minutes: totalDuration
        });
    } catch (err) {
        console.error('Availability error:', err);
        return jsonResponse(500, { error: 'Unable to check availability' });
    }
};
