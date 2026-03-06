// functions/admin-manage.js
// POST /api/admin-manage
// Unified CRUD endpoint for admin configuration
// Body: { resource: "services"|"addons"|"hours"|"blackouts"|"settings"|"requests", method: "list"|"create"|"update"|"delete", ...data }

const { getSupabase } = require('./utils/supabase');
const { jsonResponse, corsHeaders, isUUID } = require('./utils/validate');
const { requireAdmin } = require('./utils/auth');

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return corsHeaders();
    if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });

    let body;
    try { body = JSON.parse(event.body); }
    catch { return jsonResponse(400, { error: 'Invalid request' }); }

    try {
        const supabase = getSupabase();
        const { businessId } = await requireAdmin(event, supabase);
        const { resource, method } = body;

        const handlers = {
            services: handleServices,
            addons: handleAddOns,
            hours: handleHours,
            blackouts: handleBlackouts,
            settings: handleSettings,
            requests: handleRequests,
            business: handleBusiness,
            clients: handleClients,
            branding: handleBranding,
            addon_links: handleAddonLinks,
            addon_exclusions: handleAddonExclusions,
            service_exclusions: handleServiceExclusions,
            recurring: handleRecurring,
            waitlist: handleWaitlist,
            revenue: handleRevenue,
            comm_settings: handleCommSettings
        };

        const handler = handlers[resource];
        if (!handler) return jsonResponse(400, { error: 'Unknown resource' });

        return await handler(supabase, businessId, method, body);
    } catch (err) {
        if (err.status) return jsonResponse(err.status, { error: err.message });
        console.error('Admin manage error:', err);
        return jsonResponse(500, { error: 'Operation failed' });
    }
};

// --- SERVICES ---
async function handleServices(supabase, businessId, method, body) {
    switch (method) {
        case 'list': {
            const { data } = await supabase
                .from('services')
                .select('*')
                .eq('business_id', businessId)
                .order('sort_order', { ascending: true });
            return jsonResponse(200, { services: data || [] });
        }
        case 'create': {
            const { name, category, price_display, duration_minutes, is_active, is_inquiry_only, sort_order, rebook_days, is_seasonal, seasonal_badge, seasonal_end_date } = body;
            if (!name || !duration_minutes) return jsonResponse(400, { error: 'Name and duration are required' });
            const { data, error } = await supabase.from('services').insert({
                business_id: businessId, name, category: category || 'General',
                price_display: price_display || '', duration_minutes: parseInt(duration_minutes),
                is_active: is_active !== false, is_inquiry_only: !!is_inquiry_only,
                sort_order: sort_order || 0, rebook_days: parseInt(rebook_days) || 0,
                is_seasonal: !!is_seasonal, seasonal_badge: seasonal_badge || null,
                seasonal_end_date: seasonal_end_date || null
            }).select().single();
            if (error) return jsonResponse(500, { error: 'Failed to create service' });
            return jsonResponse(201, { service: data });
        }
        case 'update': {
            if (!body.id || !isUUID(body.id)) return jsonResponse(400, { error: 'Invalid ID' });
            const updates = {};
            ['name', 'category', 'price_display', 'duration_minutes', 'is_active', 'is_inquiry_only', 'sort_order', 'rebook_days', 'is_seasonal', 'seasonal_badge', 'seasonal_end_date']
                .forEach(f => { if (body[f] !== undefined) updates[f] = body[f]; });
            if (updates.duration_minutes) updates.duration_minutes = parseInt(updates.duration_minutes);
            const { data, error } = await supabase.from('services').update(updates)
                .eq('id', body.id).eq('business_id', businessId).select().single();
            if (error || !data) return jsonResponse(404, { error: 'Service not found' });
            return jsonResponse(200, { service: data });
        }
        case 'delete': {
            if (!body.id || !isUUID(body.id)) return jsonResponse(400, { error: 'Invalid ID' });
            await supabase.from('services').delete().eq('id', body.id).eq('business_id', businessId);
            return jsonResponse(200, { deleted: true });
        }
        default: return jsonResponse(400, { error: 'Invalid method' });
    }
}

// --- ADD-ONS ---
async function handleAddOns(supabase, businessId, method, body) {
    switch (method) {
        case 'list': {
            const { data } = await supabase.from('add_ons').select('*')
                .eq('business_id', businessId).order('sort_order', { ascending: true });
            return jsonResponse(200, { add_ons: data || [] });
        }
        case 'create': {
            const { name, service_id, price_display, add_minutes, is_active, sort_order } = body;
            if (!name) return jsonResponse(400, { error: 'Name is required' });
            const { data, error } = await supabase.from('add_ons').insert({
                business_id: businessId, name,
                service_id: service_id || null,
                price_display: price_display || '',
                add_minutes: parseInt(add_minutes) || 0,
                is_active: is_active !== false,
                sort_order: sort_order || 0
            }).select().single();
            if (error) return jsonResponse(500, { error: 'Failed to create add-on' });
            return jsonResponse(201, { add_on: data });
        }
        case 'update': {
            if (!body.id || !isUUID(body.id)) return jsonResponse(400, { error: 'Invalid ID' });
            const updates = {};
            ['name', 'service_id', 'price_display', 'add_minutes', 'is_active', 'sort_order']
                .forEach(f => { if (body[f] !== undefined) updates[f] = body[f]; });
            const { data, error } = await supabase.from('add_ons').update(updates)
                .eq('id', body.id).eq('business_id', businessId).select().single();
            if (error || !data) return jsonResponse(404, { error: 'Add-on not found' });
            return jsonResponse(200, { add_on: data });
        }
        case 'delete': {
            if (!body.id || !isUUID(body.id)) return jsonResponse(400, { error: 'Invalid ID' });
            await supabase.from('add_ons').delete().eq('id', body.id).eq('business_id', businessId);
            return jsonResponse(200, { deleted: true });
        }
        default: return jsonResponse(400, { error: 'Invalid method' });
    }
}

// --- HOURS ---
async function handleHours(supabase, businessId, method, body) {
    switch (method) {
        case 'list': {
            const { data } = await supabase.from('availability_rules').select('*')
                .eq('business_id', businessId).order('day_of_week', { ascending: true });
            return jsonResponse(200, { hours: data || [] });
        }
        case 'update': {
            // Expects body.hours: [{ day_of_week, open_time, close_time, is_closed }]
            if (!Array.isArray(body.hours)) return jsonResponse(400, { error: 'Hours array required' });
            for (const h of body.hours) {
                await supabase.from('availability_rules')
                    .upsert({
                        business_id: businessId,
                        day_of_week: h.day_of_week,
                        open_time: h.open_time,
                        close_time: h.close_time,
                        is_closed: !!h.is_closed
                    }, { onConflict: 'business_id,day_of_week' });
            }
            const { data } = await supabase.from('availability_rules').select('*')
                .eq('business_id', businessId).order('day_of_week', { ascending: true });
            return jsonResponse(200, { hours: data || [] });
        }
        default: return jsonResponse(400, { error: 'Invalid method' });
    }
}

// --- BLACKOUTS ---
async function handleBlackouts(supabase, businessId, method, body) {
    switch (method) {
        case 'list': {
            const { data } = await supabase.from('blackout_blocks').select('*')
                .eq('business_id', businessId).order('day_of_week', { ascending: true });
            return jsonResponse(200, { blackouts: data || [] });
        }
        case 'create': {
            const { name, day_of_week, start_time, end_time, is_active } = body;
            if (day_of_week === undefined || !start_time || !end_time) {
                return jsonResponse(400, { error: 'Day, start time, and end time are required' });
            }
            const { data, error } = await supabase.from('blackout_blocks').insert({
                business_id: businessId, name: name || 'Break',
                day_of_week: parseInt(day_of_week),
                start_time, end_time, is_active: is_active !== false
            }).select().single();
            if (error) return jsonResponse(500, { error: 'Failed to create blackout' });
            return jsonResponse(201, { blackout: data });
        }
        case 'update': {
            if (!body.id || !isUUID(body.id)) return jsonResponse(400, { error: 'Invalid ID' });
            const updates = {};
            ['name', 'day_of_week', 'start_time', 'end_time', 'is_active']
                .forEach(f => { if (body[f] !== undefined) updates[f] = body[f]; });
            const { data } = await supabase.from('blackout_blocks').update(updates)
                .eq('id', body.id).eq('business_id', businessId).select().single();
            return jsonResponse(200, { blackout: data });
        }
        case 'delete': {
            if (!body.id || !isUUID(body.id)) return jsonResponse(400, { error: 'Invalid ID' });
            await supabase.from('blackout_blocks').delete().eq('id', body.id).eq('business_id', businessId);
            return jsonResponse(200, { deleted: true });
        }
        default: return jsonResponse(400, { error: 'Invalid method' });
    }
}

// --- SETTINGS ---
async function handleSettings(supabase, businessId, method, body) {
    switch (method) {
        case 'get': {
            const { data } = await supabase.from('settings').select('*').eq('business_id', businessId).single();
            return jsonResponse(200, { settings: data || {} });
        }
        case 'update': {
            const allowed = [
                'slot_increment_minutes', 'buffer_before_default', 'buffer_after_default',
                'ask_new_client', 'new_client_extra_minutes', 'pre_blackout_cutoff_minutes',
                'end_of_day_cutoff_minutes', 'allow_request_if_no_slots', 'add_on_policy_line',
                'cancellation_policy_text', 'intake_form_url', 'intake_form_label'
            ];
            const updates = {};
            allowed.forEach(f => { if (body[f] !== undefined) updates[f] = body[f]; });
            const { data, error } = await supabase.from('settings')
                .upsert({ business_id: businessId, ...updates }, { onConflict: 'business_id' })
                .select().single();
            if (error) return jsonResponse(500, { error: 'Failed to update settings' });
            return jsonResponse(200, { settings: data });
        }
        default: return jsonResponse(400, { error: 'Invalid method' });
    }
}

// --- REQUESTS ---
async function handleRequests(supabase, businessId, method, body) {
    switch (method) {
        case 'list': {
            const statusFilter = body.status_filter || ['new', 'contacted'];
            const { data } = await supabase.from('booking_requests').select('*')
                .eq('business_id', businessId)
                .in('status', statusFilter)
                .order('created_at', { ascending: false });
            // Also fetch booked requests that haven't passed yet
            const { data: booked } = await supabase.from('booking_requests').select('*')
                .eq('business_id', businessId)
                .eq('status', 'booked')
                .order('created_at', { ascending: false })
                .limit(20);
            return jsonResponse(200, { requests: data || [], booked_requests: booked || [] });
        }
        case 'update_status': {
            if (!body.id || !isUUID(body.id)) return jsonResponse(400, { error: 'Invalid ID' });
            const validStatuses = ['new', 'contacted', 'booked', 'closed'];
            if (!validStatuses.includes(body.status)) return jsonResponse(400, { error: 'Invalid status' });
            const { data } = await supabase.from('booking_requests')
                .update({ status: body.status })
                .eq('id', body.id).eq('business_id', businessId)
                .select().single();
            return jsonResponse(200, { request: data });
        }
        default: return jsonResponse(400, { error: 'Invalid method' });
    }
}

// --- BUSINESS PROFILE ---
async function handleBusiness(supabase, businessId, method, body) {
    switch (method) {
        case 'get': {
            const { data } = await supabase.from('businesses').select('*').eq('id', businessId).single();
            return jsonResponse(200, { business: data });
        }
        case 'update': {
            const allowed = ['name', 'timezone', 'location_text', 'contact_email', 'contact_phone'];
            const updates = {};
            allowed.forEach(f => { if (body[f] !== undefined) updates[f] = body[f]; });
            const { data } = await supabase.from('businesses').update(updates)
                .eq('id', businessId).select().single();
            return jsonResponse(200, { business: data });
        }
        default: return jsonResponse(400, { error: 'Invalid method' });
    }
}

// --- CLIENTS ---
async function handleClients(supabase, businessId, method, body) {
    switch (method) {
        case 'list': {
            const search = body.search?.trim();
            let query = supabase.from('clients').select('*', { count: 'exact' })
                .eq('business_id', businessId)
                .order('last_visit_at', { ascending: false });
            if (search) {
                query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`);
            }
            const limit = body.limit || 50;
            const offset = body.offset || 0;
            query = query.range(offset, offset + limit - 1);
            const { data, count } = await query;
            return jsonResponse(200, { clients: data || [], total: count || 0 });
        }
        case 'get': {
            if (!body.id || !isUUID(body.id)) return jsonResponse(400, { error: 'Invalid ID' });
            const { data: client } = await supabase.from('clients').select('*')
                .eq('id', body.id).eq('business_id', businessId).single();
            if (!client) return jsonResponse(404, { error: 'Client not found' });

            // Fetch booking history
            const { data: bookings } = await supabase.from('bookings')
                .select(`id, start_at, end_at, status, is_new_client, created_at,
                    booking_items(id, item_type, name_snapshot, price_snapshot, minutes_snapshot)`)
                .eq('client_id', client.id)
                .order('start_at', { ascending: false })
                .limit(50);

            return jsonResponse(200, { client, bookings: bookings || [] });
        }
        case 'update': {
            if (!body.id || !isUUID(body.id)) return jsonResponse(400, { error: 'Invalid ID' });
            const allowed = ['name', 'phone', 'email', 'admin_notes', 'tags', 'is_no_show_flagged'];
            const updates = {};
            allowed.forEach(f => { if (body[f] !== undefined) updates[f] = body[f]; });
            const { data } = await supabase.from('clients').update(updates)
                .eq('id', body.id).eq('business_id', businessId).select().single();
            return jsonResponse(200, { client: data });
        }
        case 'mark_no_show': {
            if (!body.booking_id || !isUUID(body.booking_id)) return jsonResponse(400, { error: 'Invalid booking ID' });
            const { data: booking } = await supabase.from('bookings')
                .update({ status: 'no_show' })
                .eq('id', body.booking_id).eq('business_id', businessId)
                .select().single();
            if (!booking) return jsonResponse(404, { error: 'Booking not found' });
            // Increment no-show count
            if (booking.client_id) {
                const { data: cl } = await supabase.from('clients').select('no_show_count')
                    .eq('id', booking.client_id).single();
                await supabase.from('clients').update({
                    no_show_count: (cl?.no_show_count || 0) + 1,
                    is_no_show_flagged: (cl?.no_show_count || 0) + 1 >= 2
                }).eq('id', booking.client_id);
            }
            return jsonResponse(200, { booking });
        }
        case 'reset_pin': {
            if (!body.id || !isUUID(body.id)) return jsonResponse(400, { error: 'Invalid ID' });
            await supabase.from('clients').update({ pin_hash: null })
                .eq('id', body.id).eq('business_id', businessId);
            return jsonResponse(200, { message: 'PIN reset' });
        }
        default: return jsonResponse(400, { error: 'Invalid method' });
    }
}

// --- BRANDING ---
async function handleBranding(supabase, businessId, method, body) {
    switch (method) {
        case 'get': {
            const { data } = await supabase.from('branding').select('*')
                .eq('business_id', businessId).single();
            return jsonResponse(200, { branding: data || {} });
        }
        case 'update': {
            const allowed = [
                'logo_url', 'favicon_url',
                'color_primary', 'color_accent', 'color_accent_light',
                'color_background', 'color_surface', 'color_text', 'color_text_muted',
                'welcome_title', 'welcome_subtitle', 'confirmation_message',
                'social_instagram', 'social_facebook', 'social_tiktok', 'social_x',
                'social_nextdoor', 'social_google', 'social_youtube', 'social_linkedin',
                'social_yelp', 'google_review_url',
                'card_headline', 'card_bio', 'card_photo_url', 'card_featured_service_ids'
            ];
            const updates = {};
            allowed.forEach(f => { if (body[f] !== undefined) updates[f] = body[f]; });
            const { data, error } = await supabase.from('branding')
                .upsert({ business_id: businessId, ...updates }, { onConflict: 'business_id' })
                .select().single();
            if (error) return jsonResponse(500, { error: 'Failed to update branding' });
            return jsonResponse(200, { branding: data });
        }
        default: return jsonResponse(400, { error: 'Invalid method' });
    }
}

// --- ADDON LINKS ---
async function handleAddonLinks(supabase, businessId, method, body) {
    switch (method) {
        case 'list': {
            const { data } = await supabase.from('service_addon_links')
                .select('*, services:service_id(name), add_ons:add_on_id(name)')
                .eq('business_id', businessId)
                .order('service_id');
            return jsonResponse(200, { links: data || [] });
        }
        case 'create': {
            const { service_id, add_on_id, max_quantity } = body;
            if (!service_id || !add_on_id) return jsonResponse(400, { error: 'Service and add-on are required' });
            const { data, error } = await supabase.from('service_addon_links').insert({
                business_id: businessId, service_id, add_on_id,
                max_quantity: parseInt(max_quantity) || 1, is_active: true
            }).select().single();
            if (error) {
                if (error.code === '23505') return jsonResponse(409, { error: 'This link already exists' });
                return jsonResponse(500, { error: 'Failed to create link' });
            }
            return jsonResponse(201, { link: data });
        }
        case 'update': {
            if (!body.id || !isUUID(body.id)) return jsonResponse(400, { error: 'Invalid ID' });
            const updates = {};
            if (body.max_quantity !== undefined) updates.max_quantity = parseInt(body.max_quantity);
            if (body.is_active !== undefined) updates.is_active = body.is_active;
            const { data } = await supabase.from('service_addon_links').update(updates)
                .eq('id', body.id).eq('business_id', businessId).select().single();
            return jsonResponse(200, { link: data });
        }
        case 'delete': {
            if (!body.id || !isUUID(body.id)) return jsonResponse(400, { error: 'Invalid ID' });
            await supabase.from('service_addon_links').delete().eq('id', body.id).eq('business_id', businessId);
            return jsonResponse(200, { deleted: true });
        }
        case 'sync': {
            // Batch: given a service_id, replace all its addon links
            const { service_id, add_on_ids } = body;
            if (!service_id) return jsonResponse(400, { error: 'Service ID required' });
            await supabase.from('service_addon_links').delete().eq('business_id', businessId).eq('service_id', service_id);
            if (add_on_ids?.length) {
                const rows = add_on_ids.map(aid => ({
                    business_id: businessId, service_id, add_on_id: aid, max_quantity: 1, is_active: true
                }));
                await supabase.from('service_addon_links').insert(rows);
            }
            return jsonResponse(200, { message: 'Synced' });
        }
        default: return jsonResponse(400, { error: 'Invalid method' });
    }
}

// --- ADDON EXCLUSIONS ---
async function handleAddonExclusions(supabase, businessId, method, body) {
    switch (method) {
        case 'list': {
            const { data } = await supabase.from('addon_exclusions')
                .select('*, a:add_on_id_a(name), b:add_on_id_b(name)')
                .eq('business_id', businessId);
            return jsonResponse(200, { exclusions: data || [] });
        }
        case 'create': {
            const { add_on_id_a, add_on_id_b } = body;
            if (!add_on_id_a || !add_on_id_b) return jsonResponse(400, { error: 'Two add-ons are required' });
            if (add_on_id_a === add_on_id_b) return jsonResponse(400, { error: 'Cannot exclude an add-on from itself' });
            // Normalize order to prevent duplicates
            const [idA, idB] = [add_on_id_a, add_on_id_b].sort();
            const { data, error } = await supabase.from('addon_exclusions').insert({
                business_id: businessId, add_on_id_a: idA, add_on_id_b: idB
            }).select().single();
            if (error) {
                if (error.code === '23505') return jsonResponse(409, { error: 'This exclusion already exists' });
                return jsonResponse(500, { error: 'Failed to create exclusion' });
            }
            return jsonResponse(201, { exclusion: data });
        }
        case 'delete': {
            if (!body.id || !isUUID(body.id)) return jsonResponse(400, { error: 'Invalid ID' });
            await supabase.from('addon_exclusions').delete().eq('id', body.id).eq('business_id', businessId);
            return jsonResponse(200, { deleted: true });
        }
        default: return jsonResponse(400, { error: 'Invalid method' });
    }
}

// --- COMM SETTINGS ---
async function handleCommSettings(supabase, businessId, method, body) {
    switch (method) {
        case 'get': {
            const { data } = await supabase.from('comm_settings').select('*').eq('business_id', businessId).single();
            // Mask sensitive keys
            if (data) {
                if (data.twilio_auth_token) data.twilio_auth_token = '••••' + data.twilio_auth_token.slice(-4);
                if (data.sendgrid_api_key) data.sendgrid_api_key = '••••' + data.sendgrid_api_key.slice(-4);
            }
            return jsonResponse(200, { comm_settings: data || {} });
        }
        case 'update': {
            const allowed = [
                'twilio_account_sid', 'twilio_auth_token', 'twilio_phone_number', 'sms_enabled',
                'sendgrid_api_key', 'email_from_address', 'email_from_name', 'email_enabled',
                'reminder_24h_enabled', 'reminder_2h_enabled',
                'review_prompt_enabled', 'review_prompt_delay_hours',
                'rebook_prompt_enabled',
                'post_visit_summary_enabled', 'post_visit_summary_delay_hours'
            ];
            const updates = {};
            allowed.forEach(f => {
                if (body[f] !== undefined) {
                    // Don't overwrite with masked values
                    if (typeof body[f] === 'string' && body[f].startsWith('••••')) return;
                    updates[f] = body[f];
                }
            });
            const { data, error } = await supabase.from('comm_settings')
                .upsert({ business_id: businessId, ...updates }, { onConflict: 'business_id' })
                .select().single();
            if (error) return jsonResponse(500, { error: 'Failed to update' });
            return jsonResponse(200, { comm_settings: data });
        }
        case 'test_sms': {
            // Send a test SMS
            const { data: cs } = await supabase.from('comm_settings').select('*').eq('business_id', businessId).single();
            if (!cs?.twilio_account_sid || !cs?.twilio_phone_number) return jsonResponse(400, { error: 'Twilio not configured' });
            const testPhone = body.test_phone;
            if (!testPhone) return jsonResponse(400, { error: 'Test phone number required' });
            try {
                const params = new URLSearchParams({ To: testPhone, From: cs.twilio_phone_number, Body: 'Test message from your salon scheduler!' });
                const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${cs.twilio_account_sid}/Messages.json`, {
                    method: 'POST',
                    headers: { 'Authorization': 'Basic ' + Buffer.from(cs.twilio_account_sid + ':' + cs.twilio_auth_token).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: params.toString()
                });
                if (resp.ok) return jsonResponse(200, { message: 'Test SMS sent!' });
                const err = await resp.json();
                return jsonResponse(400, { error: 'SMS failed: ' + (err.message || 'Unknown error') });
            } catch (e) { return jsonResponse(500, { error: 'SMS failed: ' + e.message }); }
        }
        default: return jsonResponse(400, { error: 'Invalid method' });
    }
}

// --- SERVICE EXCLUSIONS ---
async function handleServiceExclusions(supabase, businessId, method, body) {
    switch (method) {
        case 'list': {
            const { data } = await supabase.from('service_exclusions')
                .select('*, a:service_id_a(name), b:service_id_b(name)')
                .eq('business_id', businessId);
            return jsonResponse(200, { exclusions: data || [] });
        }
        case 'sync': {
            // Batch sync: given a service_id, replace all its exclusions
            const { service_id, excluded_service_ids } = body;
            if (!service_id) return jsonResponse(400, { error: 'Service ID required' });
            // Delete existing exclusions for this service (both directions)
            await supabase.from('service_exclusions')
                .delete()
                .eq('business_id', businessId)
                .or(`service_id_a.eq.${service_id},service_id_b.eq.${service_id}`);
            // Insert new ones
            if (excluded_service_ids?.length) {
                const rows = excluded_service_ids.map(eid => {
                    const [a, b] = [service_id, eid].sort();
                    return { business_id: businessId, service_id_a: a, service_id_b: b };
                });
                // Deduplicate
                const unique = rows.filter((r, i) => rows.findIndex(x => x.service_id_a === r.service_id_a && x.service_id_b === r.service_id_b) === i);
                if (unique.length) await supabase.from('service_exclusions').upsert(unique, { onConflict: 'service_id_a,service_id_b' });
            }
            return jsonResponse(200, { message: 'Synced' });
        }
        default: return jsonResponse(400, { error: 'Invalid method' });
    }
}

// --- RECURRING BOOKINGS ---
async function handleRecurring(supabase, businessId, method, body) {
    switch (method) {
        case 'list': {
            const { data } = await supabase.from('recurring_bookings').select('*')
                .eq('business_id', businessId).order('day_of_week').order('start_time');
            return jsonResponse(200, { recurring: data || [] });
        }
        case 'create': {
            const { client_id, service_ids, add_on_ids, day_of_week, start_time,
                frequency_weeks, customer_name, customer_phone, customer_email,
                is_new_client, total_duration_minutes } = body;
            if (!customer_name || day_of_week === undefined || !start_time || !total_duration_minutes) {
                return jsonResponse(400, { error: 'Name, day, time, and duration are required' });
            }
            // Calculate next occurrence
            const now = new Date();
            const today = now.getDay();
            let daysUntil = (parseInt(day_of_week) - today + 7) % 7;
            if (daysUntil === 0) daysUntil = 7;
            const next = new Date(now);
            next.setDate(now.getDate() + daysUntil);
            const nextDate = next.toISOString().split('T')[0];

            const { data, error } = await supabase.from('recurring_bookings').insert({
                business_id: businessId, client_id: client_id || null,
                service_ids: service_ids || [], add_on_ids: add_on_ids || [],
                day_of_week: parseInt(day_of_week), start_time: start_time + ':00',
                frequency_weeks: parseInt(frequency_weeks) || 4,
                customer_name, customer_phone: customer_phone || null,
                customer_email: customer_email || null,
                is_new_client: !!is_new_client,
                total_duration_minutes: parseInt(total_duration_minutes),
                is_active: true, next_occurrence: nextDate
            }).select().single();
            if (error) return jsonResponse(500, { error: 'Failed to create recurring booking' });
            return jsonResponse(201, { recurring: data });
        }
        case 'update': {
            if (!body.id || !isUUID(body.id)) return jsonResponse(400, { error: 'Invalid ID' });
            const allowed = ['is_active', 'frequency_weeks', 'day_of_week', 'start_time', 'next_occurrence'];
            const updates = {};
            allowed.forEach(f => { if (body[f] !== undefined) updates[f] = body[f]; });
            const { data } = await supabase.from('recurring_bookings').update(updates)
                .eq('id', body.id).eq('business_id', businessId).select().single();
            return jsonResponse(200, { recurring: data });
        }
        case 'delete': {
            if (!body.id || !isUUID(body.id)) return jsonResponse(400, { error: 'Invalid ID' });
            await supabase.from('recurring_bookings').delete().eq('id', body.id).eq('business_id', businessId);
            return jsonResponse(200, { deleted: true });
        }
        default: return jsonResponse(400, { error: 'Invalid method' });
    }
}

// --- WAITLIST ---
async function handleWaitlist(supabase, businessId, method, body) {
    switch (method) {
        case 'list': {
            const statusFilter = body.status_filter || ['waiting', 'notified'];
            const { data } = await supabase.from('waitlist').select('*')
                .eq('business_id', businessId).in('status', statusFilter)
                .order('preferred_date', { ascending: true });
            return jsonResponse(200, { waitlist: data || [] });
        }
        case 'create': {
            const { preferred_date, preferred_time_window, service_ids,
                customer_name, customer_phone, customer_email, client_id } = body;
            if (!customer_name || !preferred_date) return jsonResponse(400, { error: 'Name and date required' });
            const { data } = await supabase.from('waitlist').insert({
                business_id: businessId, client_id: client_id || null,
                preferred_date, preferred_time_window: preferred_time_window || null,
                service_ids: service_ids || [],
                customer_name, customer_phone: customer_phone || null,
                customer_email: customer_email || null
            }).select().single();
            return jsonResponse(201, { entry: data });
        }
        case 'update_status': {
            if (!body.id || !isUUID(body.id)) return jsonResponse(400, { error: 'Invalid ID' });
            const valid = ['waiting', 'notified', 'booked', 'expired'];
            if (!valid.includes(body.status)) return jsonResponse(400, { error: 'Invalid status' });
            const updates = { status: body.status };
            if (body.status === 'notified') updates.notified_at = new Date().toISOString();
            const { data } = await supabase.from('waitlist').update(updates)
                .eq('id', body.id).eq('business_id', businessId).select().single();
            return jsonResponse(200, { entry: data });
        }
        case 'delete': {
            if (!body.id || !isUUID(body.id)) return jsonResponse(400, { error: 'Invalid ID' });
            await supabase.from('waitlist').delete().eq('id', body.id).eq('business_id', businessId);
            return jsonResponse(200, { deleted: true });
        }
        default: return jsonResponse(400, { error: 'Invalid method' });
    }
}

// --- REVENUE DASHBOARD ---
async function handleRevenue(supabase, businessId, method, body) {
    const dateFrom = body.date_from || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const dateTo = body.date_to || new Date().toISOString().split('T')[0];

    const { data: bookings } = await supabase.from('bookings')
        .select('start_at, status, booking_items(name_snapshot, price_snapshot, item_type)')
        .eq('business_id', businessId)
        .in('status', ['confirmed', 'no_show'])
        .gte('start_at', dateFrom + 'T00:00:00Z')
        .lte('start_at', dateTo + 'T23:59:59Z');

    let totalBookings = 0, totalNoShows = 0, revMin = 0, revMax = 0, newClients = 0;
    const serviceCount = {};
    const dailyData = {};

    for (const b of (bookings || [])) {
        const date = b.start_at.split('T')[0];
        if (!dailyData[date]) dailyData[date] = { date, count: 0, revMin: 0, revMax: 0 };
        dailyData[date].count++;
        totalBookings++;
        if (b.status === 'no_show') totalNoShows++;
        for (const item of (b.booking_items || [])) {
            const p = parsePrice(item.price_snapshot);
            if (p) { revMin += p.min; revMax += p.max; dailyData[date].revMin += p.min; dailyData[date].revMax += p.max; }
            if (!serviceCount[item.name_snapshot]) serviceCount[item.name_snapshot] = 0;
            serviceCount[item.name_snapshot]++;
        }
    }

    const topServices = Object.entries(serviceCount).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const daily = Object.values(dailyData).sort((a, b) => a.date.localeCompare(b.date));

    // === Revenue Forecasting (Feature 5) ===
    const now = new Date();
    const in7 = new Date(now.getTime() + 7 * 86400000).toISOString();
    const in30 = new Date(now.getTime() + 30 * 86400000).toISOString();

    const { data: upcoming7 } = await supabase.from('bookings')
        .select('start_at, booking_items(price_snapshot)')
        .eq('business_id', businessId).eq('status', 'confirmed')
        .gte('start_at', now.toISOString()).lte('start_at', in7);

    const { data: upcoming30 } = await supabase.from('bookings')
        .select('start_at, booking_items(price_snapshot)')
        .eq('business_id', businessId).eq('status', 'confirmed')
        .gte('start_at', now.toISOString()).lte('start_at', in30);

    function calcForecast(bks) {
        let min = 0, max = 0;
        for (const b of (bks || [])) {
            for (const item of (b.booking_items || [])) {
                const p = parsePrice(item.price_snapshot);
                if (p) { min += p.min; max += p.max; }
            }
        }
        return { count: (bks || []).length, revMin: min, revMax: max };
    }

    const forecast = {
        next_7_days: calcForecast(upcoming7),
        next_30_days: calcForecast(upcoming30)
    };

    return jsonResponse(200, {
        summary: { totalBookings, totalNoShows, revMin, revMax, newClients, dateFrom, dateTo },
        topServices, daily, forecast
    });
}

function parsePrice(str) {
    if (!str) return null;
    const nums = str.match(/\d+(\.\d+)?/g);
    if (!nums?.length) return null;
    const values = nums.map(Number);
    return { min: Math.min(...values), max: Math.max(...values) };
}
