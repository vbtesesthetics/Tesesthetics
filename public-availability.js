// functions/send-reminders.js
// Scheduled function (Netlify Scheduled Functions or called via cron)
// Checks for upcoming bookings and sends reminders
// POST /api/send-reminders (called by cron or Netlify scheduled function)
// Requires a secret key to prevent unauthorized triggering

const { getSupabase } = require('./utils/supabase');
const { jsonResponse, corsHeaders } = require('./utils/validate');
const { localTimeToUtc, formatLocalDate, validateSlotAvailable } = require('./utils/availability');

// Verify cron secret to prevent public abuse
function verifyCronSecret(event) {
    const secret = event.headers['x-cron-secret'] || event.queryStringParameters?.secret;
    return secret === process.env.CRON_SECRET;
}

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return corsHeaders();
    if (!verifyCronSecret(event)) return jsonResponse(401, { error: 'Unauthorized' });

    const supabase = getSupabase();

    try {
        // Get all businesses with comms enabled
        const { data: commSettings } = await supabase
            .from('comm_settings').select('*, businesses(id, name, timezone, contact_phone)')
            .or('sms_enabled.eq.true,email_enabled.eq.true');

        if (!commSettings?.length) return jsonResponse(200, { message: 'No businesses with comms enabled' });

        let totalSent = 0;
        const errors = [];

        for (const cs of commSettings) {
            const business = cs.businesses;
            const businessId = cs.business_id;

            try {
                // Auto-generate recurring bookings
                await processRecurringBookings(supabase, business, businessId);

                // 24-hour reminders
                if (cs.reminder_24h_enabled) {
                    totalSent += await sendReminders(supabase, cs, business, businessId, 24, 23);
                }
                // 2-hour reminders
                if (cs.reminder_2h_enabled) {
                    totalSent += await sendReminders(supabase, cs, business, businessId, 2, 1.5);
                }
                // Review prompts (for past bookings)
                if (cs.review_prompt_enabled) {
                    totalSent += await sendReviewPrompts(supabase, cs, business, businessId);
                }
                // Rebook prompts
                if (cs.rebook_prompt_enabled) {
                    totalSent += await sendRebookPrompts(supabase, cs, business, businessId);
                }
                // Post-visit summaries (Feature 10)
                if (cs.post_visit_summary_enabled) {
                    totalSent += await sendPostVisitSummaries(supabase, cs, business, businessId);
                }
            } catch (err) {
                errors.push({ businessId, error: err.message });
            }
        }

        return jsonResponse(200, { sent: totalSent, errors });
    } catch (err) {
        console.error('Reminder error:', err);
        return jsonResponse(500, { error: 'Reminder processing failed' });
    }
};

async function sendReminders(supabase, cs, business, businessId, hoursAhead, hoursMin) {
    const now = new Date();
    const windowStart = new Date(now.getTime() + hoursMin * 3600000);
    const windowEnd = new Date(now.getTime() + hoursAhead * 3600000);
    const msgType = `reminder_${hoursAhead}h`;

    // Find bookings in window that haven't been reminded
    const { data: bookings } = await supabase
        .from('bookings')
        .select('id, start_at, end_at, customer_name, customer_phone, customer_email, booking_items(name_snapshot)')
        .eq('business_id', businessId)
        .eq('status', 'confirmed')
        .gte('start_at', windowStart.toISOString())
        .lt('start_at', windowEnd.toISOString());

    if (!bookings?.length) return 0;

    let sent = 0;
    for (const booking of bookings) {
        // Check if already sent
        const { data: existing } = await supabase.from('message_log')
            .select('id').eq('booking_id', booking.id).eq('message_type', msgType).limit(1);
        if (existing?.length) continue;

        const services = booking.booking_items?.map(i => i.name_snapshot).join(', ') || '';
        const startTime = new Date(booking.start_at).toLocaleString('en-US', {
            timeZone: business.timezone, weekday: 'short', month: 'short', day: 'numeric',
            hour: 'numeric', minute: '2-digit', hour12: true
        });

        const message = `Hi ${booking.customer_name}! Reminder: your appointment at ${business.name} is ${hoursAhead === 24 ? 'tomorrow' : 'in 2 hours'} at ${startTime}. Services: ${services}. Reply HELP for assistance.`;

        // Send SMS
        if (cs.sms_enabled && booking.customer_phone && cs.twilio_account_sid) {
            const success = await sendSMS(cs, booking.customer_phone, message);
            await logMessage(supabase, businessId, booking.id, null, 'sms', msgType, booking.customer_phone, success);
            if (success) sent++;
        }

        // Send Email
        if (cs.email_enabled && booking.customer_email && cs.sendgrid_api_key) {
            const subject = `Appointment Reminder - ${business.name}`;
            const htmlBody = `<p>Hi ${booking.customer_name},</p>
                <p>This is a reminder that your appointment at <strong>${business.name}</strong> is scheduled for <strong>${startTime}</strong>.</p>
                <p><strong>Services:</strong> ${services}</p>
                <p>If you need to cancel or reschedule, please do so at least 24 hours in advance.</p>
                <p>See you soon!</p>`;
            const success = await sendEmail(cs, booking.customer_email, subject, htmlBody);
            await logMessage(supabase, businessId, booking.id, null, 'email', msgType, booking.customer_email, success);
            if (success) sent++;
        }
    }
    return sent;
}

async function sendReviewPrompts(supabase, cs, business, businessId) {
    const delayHours = cs.review_prompt_delay_hours || 2;
    const cutoff = new Date(Date.now() - delayHours * 3600000);
    const windowStart = new Date(cutoff.getTime() - 3600000); // 1hr window

    const { data: branding } = await supabase.from('branding')
        .select('google_review_url').eq('business_id', businessId).single();
    if (!branding?.google_review_url) return 0;

    const { data: bookings } = await supabase.from('bookings')
        .select('id, end_at, customer_name, customer_phone, customer_email, client_id')
        .eq('business_id', businessId).eq('status', 'confirmed')
        .gte('end_at', windowStart.toISOString()).lt('end_at', cutoff.toISOString());

    let sent = 0;
    for (const booking of (bookings || [])) {
        const { data: existing } = await supabase.from('message_log')
            .select('id').eq('booking_id', booking.id).eq('message_type', 'review_prompt').limit(1);
        if (existing?.length) continue;

        const message = `Hi ${booking.customer_name}! Thanks for visiting ${business.name} today. We'd love your feedback! Leave a review here: ${branding.google_review_url}`;

        if (cs.sms_enabled && booking.customer_phone && cs.twilio_account_sid) {
            const success = await sendSMS(cs, booking.customer_phone, message);
            await logMessage(supabase, businessId, booking.id, booking.client_id, 'sms', 'review_prompt', booking.customer_phone, success);
            if (success) sent++;
        }
    }
    return sent;
}

async function sendRebookPrompts(supabase, cs, business, businessId) {
    // Find services with rebook_days set
    const { data: services } = await supabase.from('services')
        .select('id, name, rebook_days').eq('business_id', businessId).gt('rebook_days', 0);
    if (!services?.length) return 0;

    let sent = 0;
    for (const service of services) {
        const rebookDate = new Date(Date.now() - service.rebook_days * 86400000);
        const windowStart = new Date(rebookDate.getTime() - 86400000);

        // Find clients who had this service around rebook_days ago
        const { data: bookingItems } = await supabase.from('booking_items')
            .select('booking_id, bookings(id, end_at, customer_name, customer_phone, client_id, business_id)')
            .eq('service_id', service.id)
            .not('bookings', 'is', null);

        for (const item of (bookingItems || [])) {
            const b = item.bookings;
            if (!b || b.business_id !== businessId) continue;
            const endAt = new Date(b.end_at);
            if (endAt < windowStart || endAt > rebookDate) continue;

            // Check not already prompted
            const { data: existing } = await supabase.from('message_log')
                .select('id').eq('client_id', b.client_id).eq('message_type', 'rebook_prompt')
                .gte('sent_at', windowStart.toISOString()).limit(1);
            if (existing?.length) continue;

            // Check client doesn't have an upcoming booking
            const { data: upcoming } = await supabase.from('bookings')
                .select('id').eq('client_id', b.client_id).eq('status', 'confirmed')
                .gte('start_at', new Date().toISOString()).limit(1);
            if (upcoming?.length) continue;

            const message = `Hi ${b.customer_name}! It's been ${service.rebook_days} days since your last ${service.name} at ${business.name}. Ready to book again? Visit our booking page to schedule your next appointment!`;

            if (cs.sms_enabled && b.customer_phone && cs.twilio_account_sid) {
                const success = await sendSMS(cs, b.customer_phone, message);
                await logMessage(supabase, businessId, null, b.client_id, 'sms', 'rebook_prompt', b.customer_phone, success);
                if (success) sent++;
            }
        }
    }
    return sent;
}

// === POST-VISIT SUMMARY (Feature 10) ===
async function sendPostVisitSummaries(supabase, cs, business, businessId) {
    const delayHours = cs.post_visit_summary_delay_hours || 1;
    const cutoff = new Date(Date.now() - delayHours * 3600000);
    const windowStart = new Date(cutoff.getTime() - 3600000); // 1-hour window

    const { data: bookings } = await supabase.from('bookings')
        .select('id, end_at, customer_name, customer_phone, client_id, business_id, booking_items(name_snapshot, item_type, service_id)')
        .eq('business_id', businessId).eq('status', 'confirmed')
        .gte('end_at', windowStart.toISOString()).lt('end_at', cutoff.toISOString());

    let sent = 0;
    for (const booking of (bookings || [])) {
        const { data: existing } = await supabase.from('message_log')
            .select('id').eq('booking_id', booking.id).eq('message_type', 'post_visit_summary').limit(1);
        if (existing?.length) continue;

        // Build what-we-did list
        const items = booking.booking_items || [];
        const services = items.filter(i => i.item_type === 'service').map(i => i.name_snapshot);
        const addons = items.filter(i => i.item_type === 'add_on').map(i => i.name_snapshot);
        let whatWeDid = services.join(', ');
        if (addons.length) whatWeDid += ` + ${addons.join(', ')}`;

        // Find rebook recommendation from service's rebook_days
        let rebookLine = '';
        if (items.length > 0 && items[0].service_id) {
            const { data: svc } = await supabase.from('services')
                .select('rebook_days, name').eq('id', items[0].service_id).single();
            if (svc?.rebook_days > 0) {
                const weeks = Math.round(svc.rebook_days / 7);
                rebookLine = `\nNext recommended visit: ~${weeks > 0 ? weeks + ' week' + (weeks !== 1 ? 's' : '') : svc.rebook_days + ' days'}.`;
            }
        }

        const bookLink = `${process.env.URL || ''}/booking/?b=${business.slug || ''}`;
        const message = `Thanks for visiting ${business.name}, ${booking.customer_name}! 💛\nToday: ${whatWeDid}.${rebookLine}\nBook again: ${bookLink}`;

        if (cs.sms_enabled && booking.customer_phone && cs.twilio_account_sid) {
            const success = await sendSMS(cs, booking.customer_phone, message);
            await logMessage(supabase, businessId, booking.id, booking.client_id, 'sms', 'post_visit_summary', booking.customer_phone, success);
            if (success) sent++;
        }
    }
    return sent;
}

// === TWILIO SMS ===
async function sendSMS(cs, to, message) {
    try {
        const accountSid = cs.twilio_account_sid;
        const authToken = cs.twilio_auth_token;
        const from = cs.twilio_phone_number;

        const params = new URLSearchParams({ To: to, From: from, Body: message });
        const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
            method: 'POST',
            headers: {
                'Authorization': 'Basic ' + Buffer.from(accountSid + ':' + authToken).toString('base64'),
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: params.toString()
        });
        return resp.ok;
    } catch (err) {
        console.error('SMS error:', err);
        return false;
    }
}

// === SENDGRID EMAIL ===
async function sendEmail(cs, to, subject, htmlBody) {
    try {
        const resp = await fetch('https://api.sendgrid.com/v3/mail/send', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${cs.sendgrid_api_key}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                personalizations: [{ to: [{ email: to }] }],
                from: { email: cs.email_from_address || 'noreply@salon.com', name: cs.email_from_name || 'Salon' },
                subject,
                content: [{ type: 'text/html', value: htmlBody }]
            })
        });
        return resp.ok || resp.status === 202;
    } catch (err) {
        console.error('Email error:', err);
        return false;
    }
}

async function logMessage(supabase, businessId, bookingId, clientId, channel, type, recipient, success) {
    await supabase.from('message_log').insert({
        business_id: businessId, booking_id: bookingId, client_id: clientId,
        channel, message_type: type, recipient,
        status: success ? 'sent' : 'failed'
    });
}

// === RECURRING AUTO-BOOKING ===
async function processRecurringBookings(supabase, business, businessId) {
    const today = new Date().toISOString().split('T')[0];
    const tz = business.timezone || 'America/New_York';

    // Find recurring bookings due today or overdue
    const { data: recurring } = await supabase.from('recurring_bookings')
        .select('*')
        .eq('business_id', businessId)
        .eq('is_active', true)
        .lte('next_occurrence', today);

    if (!recurring?.length) return;

    const { data: settings } = await supabase.from('settings').select('*').eq('business_id', businessId).single();
    const { data: rules } = await supabase.from('availability_rules').select('*').eq('business_id', businessId);
    const { data: blackouts } = await supabase.from('blackout_blocks').select('*').eq('business_id', businessId).eq('is_active', true);

    for (const rec of recurring) {
        try {
            const dateStr = rec.next_occurrence;
            const timeMinutes = parseInt(rec.start_time.split(':')[0]) * 60 + parseInt(rec.start_time.split(':')[1]);
            const startUtc = localTimeToUtc(dateStr, timeMinutes, tz);
            const endUtc = new Date(startUtc.getTime() + rec.total_duration_minutes * 60000);

            // Validate slot is available
            const validation = await validateSlotAvailable(supabase, {
                businessId, timezone: tz,
                startAt: startUtc.toISOString(),
                totalDurationMinutes: rec.total_duration_minutes,
                settings: settings || {},
                availabilityRules: rules || [],
                blackoutBlocks: blackouts || []
            });

            if (validation.valid) {
                // Create the booking
                await supabase.from('bookings').insert({
                    business_id: businessId,
                    client_id: rec.client_id,
                    start_at: startUtc.toISOString(),
                    end_at: endUtc.toISOString(),
                    customer_name: rec.customer_name,
                    customer_phone: rec.customer_phone,
                    customer_email: rec.customer_email,
                    is_new_client: false,
                    status: 'confirmed'
                });

                // Advance next_occurrence
                const next = new Date(dateStr + 'T12:00:00');
                next.setDate(next.getDate() + rec.frequency_weeks * 7);
                await supabase.from('recurring_bookings').update({
                    next_occurrence: next.toISOString().split('T')[0],
                    last_booked_at: new Date().toISOString()
                }).eq('id', rec.id);
            } else {
                // Conflict — skip and advance (admin will see it wasn't booked)
                console.warn(`Recurring ${rec.id} conflict on ${dateStr}, skipping`);
                const next = new Date(dateStr + 'T12:00:00');
                next.setDate(next.getDate() + rec.frequency_weeks * 7);
                await supabase.from('recurring_bookings').update({
                    next_occurrence: next.toISOString().split('T')[0]
                }).eq('id', rec.id);
            }
        } catch (err) {
            console.error(`Recurring ${rec.id} error:`, err);
        }
    }
}
