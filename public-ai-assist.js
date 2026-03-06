// functions/admin-dashboard.js
// GET /api/admin-dashboard?date=YYYY-MM-DD&view=day|week
// Returns bookings and request counts for admin view

const { getSupabase } = require('./utils/supabase');
const { jsonResponse, corsHeaders } = require('./utils/validate');
const { requireAdmin } = require('./utils/auth');
const { localTimeToUtc, formatLocalDate } = require('./utils/availability');

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return corsHeaders();
    if (event.httpMethod !== 'GET') return jsonResponse(405, { error: 'Method not allowed' });

    try {
        const supabase = getSupabase();
        const { businessId } = await requireAdmin(event, supabase);

        const { data: business } = await supabase
            .from('businesses')
            .select('timezone')
            .eq('id', businessId)
            .single();

        const timezone = business?.timezone || 'America/New_York';
        const dateParam = event.queryStringParameters?.date || formatLocalDate(new Date());
        const viewType = event.queryStringParameters?.view || 'day';

        // Calculate date range
        let dateFrom = dateParam;
        let dateTo = dateParam;

        if (viewType === 'week') {
            const startDate = new Date(dateParam + 'T12:00:00');
            const day = startDate.getDay();
            const monday = new Date(startDate);
            monday.setDate(startDate.getDate() - ((day + 6) % 7));
            const sunday = new Date(monday);
            sunday.setDate(monday.getDate() + 6);
            dateFrom = formatLocalDate(monday);
            dateTo = formatLocalDate(sunday);
        }

        // Convert to UTC range for query
        const rangeStartUtc = localTimeToUtc(dateFrom, 0, timezone);
        const nextDay = new Date(dateTo + 'T00:00:00');
        nextDay.setDate(nextDay.getDate() + 1);
        const rangeEndUtc = localTimeToUtc(formatLocalDate(nextDay), 0, timezone);

        // Fetch bookings with items
        const { data: bookings } = await supabase
            .from('bookings')
            .select(`
                id, start_at, end_at, customer_name, customer_email,
                customer_phone, is_new_client, status, internal_notes,
                public_notes_non_medical, created_at,
                booking_items (
                    id, item_type, name_snapshot, price_snapshot, minutes_snapshot
                )
            `)
            .eq('business_id', businessId)
            .gte('start_at', rangeStartUtc.toISOString())
            .lt('start_at', rangeEndUtc.toISOString())
            .order('start_at', { ascending: true });

        // Fetch one-off blocks in range
        const { data: blocks } = await supabase
            .from('one_off_blocks')
            .select('id, name, start_at, end_at')
            .eq('business_id', businessId)
            .gte('start_at', rangeStartUtc.toISOString())
            .lt('start_at', rangeEndUtc.toISOString())
            .order('start_at', { ascending: true });

        // Count open requests
        const { count: openRequestCount } = await supabase
            .from('booking_requests')
            .select('id', { count: 'exact', head: true })
            .eq('business_id', businessId)
            .in('status', ['new', 'contacted']);

        // Fetch hours and blackouts for display
        const [hoursRes, blackoutsRes] = await Promise.all([
            supabase.from('availability_rules').select('*').eq('business_id', businessId),
            supabase.from('blackout_blocks').select('*').eq('business_id', businessId).eq('is_active', true)
        ]);

        return jsonResponse(200, {
            date: dateParam,
            view: viewType,
            date_from: dateFrom,
            date_to: dateTo,
            timezone,
            bookings: bookings || [],
            blocks: blocks || [],
            open_request_count: openRequestCount || 0,
            hours: hoursRes.data || [],
            blackouts: blackoutsRes.data || []
        });
    } catch (err) {
        if (err.status) return jsonResponse(err.status, { error: err.message });
        console.error('Dashboard error:', err);
        return jsonResponse(500, { error: 'Unable to load dashboard' });
    }
};
