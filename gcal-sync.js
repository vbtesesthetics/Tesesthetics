// functions/public-ai-assist.js
// POST /api/public-ai-assist
// AI-powered booking assistant — proxies to Anthropic API with business context
// Rate-limited to prevent abuse

const { getSupabase } = require('./utils/supabase');
const { jsonResponse, corsHeaders, rateLimit, getClientIP, isSlug } = require('./utils/validate');

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return corsHeaders();
    if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });

    const ip = getClientIP(event);
    if (!rateLimit(ip, 20)) return jsonResponse(429, { error: 'Too many requests' });

    let body;
    try { body = JSON.parse(event.body); } catch { return jsonResponse(400, { error: 'Invalid request' }); }

    const { business_slug, messages, context } = body;
    if (!business_slug || !isSlug(business_slug)) return jsonResponse(400, { error: 'Invalid business' });
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return jsonResponse(400, { error: 'Messages are required' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return jsonResponse(500, { error: 'AI assistant not configured' });

    try {
        const supabase = getSupabase();

        // Fetch business config for system context
        const { data: business } = await supabase
            .from('businesses').select('id, name, timezone, location_text')
            .eq('slug', business_slug).single();
        if (!business) return jsonResponse(404, { error: 'Business not found' });

        const { data: services } = await supabase
            .from('services').select('id, name, category, price_display, duration_minutes, is_inquiry_only')
            .eq('business_id', business.id).eq('is_active', true).order('sort_order');

        const { data: addons } = await supabase
            .from('add_ons').select('id, name, price_display, add_minutes')
            .eq('business_id', business.id).eq('is_active', true);

        const { data: hours } = await supabase
            .from('availability_rules').select('day_of_week, open_time, close_time, is_closed')
            .eq('business_id', business.id).order('day_of_week');

        const dowNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
        const hoursText = (hours || []).map(h =>
            h.is_closed ? `${dowNames[h.day_of_week]}: Closed`
            : `${dowNames[h.day_of_week]}: ${h.open_time} – ${h.close_time}`
        ).join('\n');

        const servicesText = (services || []).map(s =>
            `- ${s.name} (${s.category}): ${s.duration_minutes} min, ${s.price_display}${s.is_inquiry_only ? ' [consultation required]' : ''}`
        ).join('\n');

        const addonsText = (addons || []).length
            ? (addons || []).map(a => `- ${a.name}: +${a.add_minutes} min, ${a.price_display}`).join('\n')
            : 'None';

        const today = new Date().toLocaleDateString('en-US', {
            timeZone: business.timezone || 'America/New_York',
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });

        const systemPrompt = `You are a friendly booking assistant for ${business.name}${business.location_text ? ` located at ${business.location_text}` : ''}. Today is ${today} (timezone: ${business.timezone || 'America/New_York'}).

Your job is to help clients book appointments. When you have enough info to suggest a booking, respond with a JSON action block at the END of your message in this exact format:
<action>{"type":"prefill","service_ids":["uuid1"],"add_on_ids":[],"date":"YYYY-MM-DD","time_preference":"afternoon","notes":"any notes"}</action>

Available services:
${servicesText}

Available add-ons:
${addonsText}

Business hours:
${hoursText}

Rules:
- Be warm, concise, and helpful. No more than 2-3 sentences per response.
- Help narrow down what service they need, then suggest a date/time.
- When they mention a day like "next Tuesday", calculate the actual date.
- If they ask about something you can't help with (medical advice, pricing disputes, etc.), politely redirect.
- Never invent availability — you can't check real-time slots, just help them pick a date and the booking form will confirm.
- If the client says something like "I need a facial" and you can identify one service clearly, include it in the action block.
- For the date, infer from what they say ("next Tuesday" = next Tuesday's date). If vague, ask once.
- Keep service_ids as the actual UUIDs from the service list above.

Service UUID map:
${(services || []).map(s => `${s.name}: ${s.id}`).join('\n')}`;

        // Sanitize messages — only allow user/assistant roles, limit history
        const sanitized = messages
            .filter(m => m.role === 'user' || m.role === 'assistant')
            .slice(-10) // Keep last 10 messages
            .map(m => ({ role: m.role, content: String(m.content).slice(0, 1000) }));

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 400,
                system: systemPrompt,
                messages: sanitized
            })
        });

        if (!response.ok) {
            const err = await response.text();
            console.error('Anthropic API error:', err);
            return jsonResponse(502, { error: 'AI assistant temporarily unavailable' });
        }

        const data = await response.json();
        const text = data.content?.[0]?.text || '';

        // Parse action block if present
        let action = null;
        const actionMatch = text.match(/<action>(.*?)<\/action>/s);
        if (actionMatch) {
            try { action = JSON.parse(actionMatch[1]); } catch {}
        }

        return jsonResponse(200, {
            reply: text.replace(/<action>.*?<\/action>/s, '').trim(),
            action
        });

    } catch (err) {
        console.error('AI assist error:', err);
        return jsonResponse(500, { error: 'AI assistant error' });
    }
};
