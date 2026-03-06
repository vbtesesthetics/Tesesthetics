// functions/utils/validate.js
// Input validation helpers — keep medical/health data OUT

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PHONE_RE = /^[\d\s\-\+\(\)\.]{7,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLUG_RE = /^[a-z0-9\-]{2,60}$/;

function isUUID(v) { return typeof v === 'string' && UUID_RE.test(v); }
function isPhone(v) { return typeof v === 'string' && PHONE_RE.test(v.trim()); }
function isEmail(v) { return typeof v === 'string' && EMAIL_RE.test(v.trim()); }
function isSlug(v) { return typeof v === 'string' && SLUG_RE.test(v); }

function validateBookingInput(body) {
    const errors = [];

    if (!body.business_slug || !isSlug(body.business_slug)) {
        errors.push('Invalid business identifier');
    }
    if (!body.chosen_start_at || isNaN(Date.parse(body.chosen_start_at))) {
        errors.push('Invalid appointment time');
    }
    if (!Array.isArray(body.service_ids) || body.service_ids.length === 0) {
        errors.push('Please select at least one service');
    }
    if (body.service_ids && body.service_ids.some(id => !isUUID(id))) {
        errors.push('Invalid service selection');
    }
    if (body.add_on_ids && body.add_on_ids.some(id => !isUUID(id))) {
        errors.push('Invalid add-on selection');
    }
    if (!body.customer_name || body.customer_name.trim().length < 2) {
        errors.push('Please provide your name');
    }
    if (body.customer_name && body.customer_name.length > 100) {
        errors.push('Name is too long');
    }

    // Require at least phone (preferred) or email
    const hasPhone = body.customer_phone && isPhone(body.customer_phone);
    const hasEmail = body.customer_email && isEmail(body.customer_email);
    if (!hasPhone && !hasEmail) {
        errors.push('Please provide a phone number or email address');
    }

    if (typeof body.is_new_client !== 'boolean') {
        errors.push('New client flag is required');
    }

    // Non-medical notes length limit
    if (body.public_notes_non_medical && body.public_notes_non_medical.length > 500) {
        errors.push('Notes must be under 500 characters');
    }

    return errors;
}

function validateRequestInput(body) {
    const errors = [];

    if (!body.business_slug || !isSlug(body.business_slug)) {
        errors.push('Invalid business identifier');
    }
    if (!body.customer_name || body.customer_name.trim().length < 2) {
        errors.push('Please provide your name');
    }

    const hasPhone = body.customer_phone && isPhone(body.customer_phone);
    const hasEmail = body.customer_email && isEmail(body.customer_email);
    if (!hasPhone && !hasEmail) {
        errors.push('Please provide a phone number or email address');
    }

    if (!body.preferred_days || !Array.isArray(body.preferred_days) || body.preferred_days.length === 0) {
        errors.push('Please select at least one preferred day');
    }

    if (!body.preferred_time_windows || !Array.isArray(body.preferred_time_windows) || body.preferred_time_windows.length === 0) {
        errors.push('Please select at least one preferred time window');
    }

    return errors;
}

// Simple rate limiter using in-memory store (resets on cold start)
// For production, use Redis or Supabase table
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 20; // requests per window

function rateLimit(ip) {
    const now = Date.now();
    const key = ip || 'unknown';
    const entry = rateLimitStore.get(key);

    if (!entry || now - entry.start > RATE_LIMIT_WINDOW) {
        rateLimitStore.set(key, { start: now, count: 1 });
        return true;
    }

    entry.count++;
    if (entry.count > RATE_LIMIT_MAX) {
        return false;
    }
    return true;
}

function getClientIP(event) {
    return event.headers['x-forwarded-for']?.split(',')[0]?.trim()
        || event.headers['x-real-ip']
        || event.headers['client-ip']
        || 'unknown';
}

// Standard response helpers
function jsonResponse(statusCode, body) {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
        },
        body: JSON.stringify(body)
    };
}

function corsHeaders() {
    return {
        statusCode: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
        },
        body: ''
    };
}

module.exports = {
    isUUID, isPhone, isEmail, isSlug,
    validateBookingInput, validateRequestInput,
    rateLimit, getClientIP,
    jsonResponse, corsHeaders
};
