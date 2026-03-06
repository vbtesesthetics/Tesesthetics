// functions/public-config.js
// GET /api/public-config?business_slug=...
// Returns public configuration for booking widget

const { getSupabase } = require('./utils/supabase');
const { jsonResponse, corsHeaders, isSlug, rateLimit, getClientIP } = require('./utils/validate');

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return corsHeaders();
    if (event.httpMethod !== 'GET') return jsonResponse(405, { error: 'Method not allowed' });

    const ip = getClientIP(event);
    if (!rateLimit(ip)) return jsonResponse(429, { error: 'Too many requests. Please try again shortly.' });

    const slug = event.queryStringParameters?.business_slug;
    if (!slug || !isSlug(slug)) {
        return jsonResponse(400, { error: 'Invalid business identifier' });
    }

    try {
        const supabase = getSupabase();

        // Fetch business
        const { data: business, error: bizErr } = await supabase
            .from('businesses')
            .select('id, slug, name, timezone, location_text, contact_email, contact_phone')
            .eq('slug', slug)
            .single();

        if (bizErr || !business) {
            return jsonResponse(404, { error: 'Business not found' });
        }

        const businessId = business.id;

        // Fetch all config in parallel
        const [servicesRes, addOnsRes, settingsRes, hoursRes, brandingRes, linksRes, exclusionsRes, svcExclRes] = await Promise.all([
            supabase
                .from('services')
                .select('id, category, name, price_display, duration_minutes, is_inquiry_only, sort_order, is_seasonal, seasonal_badge, seasonal_end_date')
                .eq('business_id', businessId)
                .eq('is_active', true)
                .order('sort_order', { ascending: true }),
            supabase
                .from('add_ons')
                .select('id, service_id, name, price_display, add_minutes, sort_order, is_global')
                .eq('business_id', businessId)
                .eq('is_active', true)
                .order('sort_order', { ascending: true }),
            supabase
                .from('settings')
                .select('slot_increment_minutes, ask_new_client, new_client_extra_minutes, allow_request_if_no_slots, add_on_policy_line, cancellation_policy_text, intake_form_url, intake_form_label')
                .eq('business_id', businessId)
                .single(),
            supabase
                .from('availability_rules')
                .select('day_of_week, open_time, close_time, is_closed')
                .eq('business_id', businessId)
                .order('day_of_week', { ascending: true }),
            supabase
                .from('branding')
                .select('*')
                .eq('business_id', businessId)
                .single(),
            supabase
                .from('service_addon_links')
                .select('service_id, add_on_id, max_quantity')
                .eq('business_id', businessId)
                .eq('is_active', true),
            supabase
                .from('addon_exclusions')
                .select('add_on_id_a, add_on_id_b')
                .eq('business_id', businessId),
            supabase
                .from('service_exclusions')
                .select('service_id_a, service_id_b')
                .eq('business_id', businessId)
        ]);

        // Group services by category
        const services = servicesRes.data || [];
        const categories = [...new Set(services.map(s => s.category))];

        return jsonResponse(200, {
            business: {
                name: business.name,
                slug: business.slug,
                timezone: business.timezone,
                location_text: business.location_text
            },
            services: services,
            categories: categories,
            add_ons: addOnsRes.data || [],
            addon_links: linksRes.data || [],
            addon_exclusions: exclusionsRes.data || [],
            service_exclusions: svcExclRes.data || [],
            settings: {
                slot_increment_minutes: settingsRes.data?.slot_increment_minutes || 15,
                ask_new_client: settingsRes.data?.ask_new_client ?? true,
                allow_request_if_no_slots: settingsRes.data?.allow_request_if_no_slots ?? true,
                add_on_policy_line: settingsRes.data?.add_on_policy_line || '',
                cancellation_policy_text: settingsRes.data?.cancellation_policy_text || 'Cancellations within 24 hours may be subject to a fee.',
                intake_form_url: settingsRes.data?.intake_form_url || null,
                intake_form_label: settingsRes.data?.intake_form_label || 'Please complete your intake form before your appointment'
            },
            hours: hoursRes.data || [],
            branding: brandingRes.data || {}
        });
    } catch (err) {
        console.error('Config error:', err);
        return jsonResponse(500, { error: 'Unable to load booking information' });
    }
};
