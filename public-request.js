// functions/send-daily-summary.js
// Sends a morning summary of today's schedule to the business owner
// Called by cron at ~7AM in each business timezone (or once daily, filtered)

const { getSupabase } = require('./utils/supabase');
const { jsonResponse, corsHeaders } = require('./utils/validate');
const { localTimeToUtc, formatLocalDate } = require('./utils/availability');

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return corsHeaders();
    const secret = event.headers['x-cron-secret'] || event.queryStringParameters?.secret;
    if (secret !== process.env.CRON_SECRET) return jsonResponse(401, { error: 'Unauthorized' });

    const supabase = getSupabase();
    try {
        const { data: businesses } = await supabase.from('businesses')
            .select('id, name, timezone, contact_phone, contact_email');

        let totalSent = 0;
        for (const biz of (businesses || [])) {
            const { data: cs } = await supabase.from('comm_settings')
                .select('*').eq('business_id', biz.id).single();
            if (!cs || (!cs.sms_enabled && !cs.email_enabled)) continue;

            // Check if it's roughly morning in the business timezone (7-9 AM)
            const now = new Date();
            const formatter = new Intl.DateTimeFormat('en-US', { timeZone: biz.timezone, hour: 'numeric', hour12: false });
            const localHour = parseInt(formatter.format(now));
            if (localHour < 6 || localHour > 10) continue; // Only send during morning window

            const today = formatLocalDate(now); // This uses UTC but close enough for date
            const dayStart = localTimeToUtc(today, 0, biz.timezone);
            const dayEnd = localTimeToUtc(today, 1440, biz.timezone);

            // Check if already sent today
            const { data: existing } = await supabase.from('message_log')
                .select('id').eq('business_id', biz.id).eq('message_type', 'daily_summary')
                .gte('sent_at', dayStart.toISOString()).limit(1);
            if (existing?.length) continue;

            const { data: bookings } = await supabase.from('bookings')
                .select('start_at, end_at, customer_name, is_new_client, booking_items(name_snapshot)')
                .eq('business_id', biz.id).eq('status', 'confirmed')
                .gte('start_at', dayStart.toISOString()).lt('start_at', dayEnd.toISOString())
                .order('start_at');

            const count = bookings?.length || 0;
            let summary = `Good morning! You have ${count} appointment${count !== 1 ? 's' : ''} today:\n\n`;

            if (count === 0) {
                summary = `Good morning! No appointments scheduled for today. Enjoy your free time!`;
            } else {
                for (const b of bookings) {
                    const time = new Date(b.start_at).toLocaleTimeString('en-US', {
                        timeZone: biz.timezone, hour: 'numeric', minute: '2-digit', hour12: true
                    });
                    const svcs = b.booking_items?.map(i => i.name_snapshot).join(', ') || '';
                    summary += `${time} - ${b.customer_name}${b.is_new_client ? ' (NEW)' : ''}: ${svcs}\n`;
                }
            }

            // Send to business contact
            if (cs.sms_enabled && biz.contact_phone && cs.twilio_account_sid) {
                try {
                    const params = new URLSearchParams({ To: biz.contact_phone, From: cs.twilio_phone_number, Body: summary });
                    await fetch(`https://api.twilio.com/2010-04-01/Accounts/${cs.twilio_account_sid}/Messages.json`, {
                        method: 'POST',
                        headers: { 'Authorization': 'Basic ' + Buffer.from(cs.twilio_account_sid + ':' + cs.twilio_auth_token).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: params.toString()
                    });
                    totalSent++;
                } catch (e) { console.error('Daily SMS failed:', e); }
            }

            await supabase.from('message_log').insert({
                business_id: biz.id, channel: 'sms', message_type: 'daily_summary',
                recipient: biz.contact_phone || 'none', status: 'sent'
            });
        }
        return jsonResponse(200, { sent: totalSent });
    } catch (err) {
        console.error('Daily summary error:', err);
        return jsonResponse(500, { error: 'Failed' });
    }
};
