// functions/public-request.js
// POST /api/public-request
// Submits a "Request a time" when customer can't find a slot

const { getSupabase } = require('./utils/supabase');
const {
    jsonResponse, corsHeaders, validateRequestInput,
    rateLimit, getClientIP, isUUID
} = require('./utils/validate');

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

    const errors = validateRequestInput(body);
    if (errors.length > 0) {
        return jsonResponse(400, { error: errors[0], errors });
    }

    try {
        const supabase = getSupabase();

        // Resolve business
        const { data: business } = await supabase
            .from('businesses')
            .select('id')
            .eq('slug', body.business_slug)
            .single();

        if (!business) return jsonResponse(404, { error: 'Business not found' });

        // Build request items (snapshot service/add-on names)
        let requestItems = [];
        if (body.service_ids?.length) {
            const { data: services } = await supabase
                .from('services')
                .select('id, name, price_display, duration_minutes')
                .eq('business_id', business.id)
                .in('id', body.service_ids.filter(id => isUUID(id)));

            requestItems = (services || []).map(s => ({
                type: 'service', id: s.id, name: s.name,
                price: s.price_display, minutes: s.duration_minutes
            }));
        }
        if (body.add_on_ids?.length) {
            const { data: addOns } = await supabase
                .from('add_ons')
                .select('id, name, price_display, add_minutes')
                .eq('business_id', business.id)
                .in('id', body.add_on_ids.filter(id => isUUID(id)));

            for (const a of (addOns || [])) {
                requestItems.push({
                    type: 'add_on', id: a.id, name: a.name,
                    price: a.price_display, minutes: a.add_minutes
                });
            }
        }

        // Validate preferred_time_windows values
        const validWindows = ['morning', 'afternoon', 'evening'];
        const windows = (body.preferred_time_windows || []).filter(w =>
            typeof w === 'string' && (validWindows.includes(w) || /^\d{1,2}:\d{2}/.test(w))
        );

        const { data: request, error: reqErr } = await supabase
            .from('booking_requests')
            .insert({
                business_id: business.id,
                preferred_days: body.preferred_days || [],
                preferred_time_windows: windows,
                customer_name: body.customer_name.trim(),
                customer_email: body.customer_email?.trim() || null,
                customer_phone: body.customer_phone?.trim() || null,
                is_new_client: !!body.is_new_client,
                request_items: requestItems,
                status: 'new',
                notes_non_medical: body.notes_non_medical?.trim() || null
            })
            .select()
            .single();

        if (reqErr) {
            console.error('Request insert error:', reqErr);
            return jsonResponse(500, { error: 'Unable to submit request. Please try again.' });
        }

        return jsonResponse(201, {
            request_id: request.id,
            message: "Your request has been submitted! We'll reach out to you soon to find the best time."
        });
    } catch (err) {
        console.error('Request error:', err);
        return jsonResponse(500, { error: 'Unable to submit request. Please try again.' });
    }
};
