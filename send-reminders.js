// functions/utils/availability.js
// ============================================================================
// AVAILABILITY ENGINE
// Generates valid booking slots based on business rules.
// All times stored as UTC (timestamptz). Computation done in business timezone.
// ============================================================================

/**
 * Main entry: generate available time slots for a date range.
 *
 * @param {object} params
 * @param {string} params.businessId - UUID
 * @param {string} params.timezone - IANA timezone string
 * @param {string} params.dateFrom - YYYY-MM-DD (local date)
 * @param {string} params.dateTo - YYYY-MM-DD (local date)
 * @param {number} params.totalDurationMinutes - full appointment length including buffers
 * @param {object} params.settings - business settings row
 * @param {Array}  params.availabilityRules - weekly hours rows
 * @param {Array}  params.blackoutBlocks - recurring weekly blackouts
 * @param {Array}  params.oneOffBlocks - date-specific blocks
 * @param {Array}  params.existingBookings - confirmed bookings in range
 * @returns {{ available_slots: string[], next_suggestions: string[] }}
 */
function generateAvailableSlots(params) {
    const {
        timezone,
        dateFrom,
        dateTo,
        totalDurationMinutes,
        settings,
        availabilityRules,
        blackoutBlocks,
        oneOffBlocks,
        existingBookings
    } = params;

    const slotIncrement = settings.slot_increment_minutes || 15;
    const preBlackoutCutoff = settings.pre_blackout_cutoff_minutes || 0;
    const endOfDayCutoff = settings.end_of_day_cutoff_minutes || 0;

    const allSlots = [];

    // Iterate each date in range
    // Use T12:00:00Z so timezone conversion stays on the correct calendar day
    let currentDate = new Date(dateFrom + 'T12:00:00Z');
    const endDate = new Date(dateTo + 'T12:00:00Z');

    while (currentDate <= endDate) {
        const dateStr = formatLocalDate(currentDate);
        const dayOfWeek = getDayOfWeek(currentDate, timezone);

        // Get hours for this day
        const rule = availabilityRules.find(r => r.day_of_week === dayOfWeek);
        if (!rule || rule.is_closed) {
            currentDate.setUTCDate(currentDate.getUTCDate() + 1);
            continue;
        }

        // Get blackouts for this day of week
        const dayBlackouts = blackoutBlocks
            .filter(b => b.day_of_week === dayOfWeek && b.is_active)
            .map(b => ({
                start: timeToMinutes(b.start_time),
                end: timeToMinutes(b.end_time),
                name: b.name
            }));

        // Get one-off blocks that overlap this date
        const dayOneOffs = oneOffBlocks
            .filter(b => {
                const blockDate = new Date(b.start_at).toISOString().split('T')[0];
                return blockDate === dateStr || overlapsDayInTimezone(b.start_at, b.end_at, dateStr, timezone);
            })
            .map(b => ({
                startUtc: new Date(b.start_at),
                endUtc: new Date(b.end_at)
            }));

        // Get bookings for this date
        const dayBookings = existingBookings
            .filter(b => {
                if (b.status === 'cancelled') return false;
                return overlapsDayInTimezone(b.start_at, b.end_at, dateStr, timezone);
            })
            .map(b => ({
                startUtc: new Date(b.start_at),
                endUtc: new Date(b.end_at)
            }));

        // Generate candidate slots
        const openMinutes = timeToMinutes(rule.open_time);
        const closeMinutes = timeToMinutes(rule.close_time);
        const effectiveClose = closeMinutes - endOfDayCutoff;

        for (let slotStart = openMinutes; slotStart < effectiveClose; slotStart += slotIncrement) {
            const slotEnd = slotStart + totalDurationMinutes;

            // Appointment must end by effective close
            if (slotEnd > effectiveClose) continue;

            // Check against blackout blocks
            let blockedByBlackout = false;
            for (const bo of dayBlackouts) {
                const effectiveBlackoutStart = bo.start - preBlackoutCutoff;
                // Appointment must end before effective blackout start OR start after blackout end
                if (slotStart < bo.end && slotEnd > effectiveBlackoutStart) {
                    blockedByBlackout = true;
                    break;
                }
            }
            if (blockedByBlackout) continue;

            // Convert slot to UTC for collision checks
            const slotStartUtc = localTimeToUtc(dateStr, slotStart, timezone);
            const slotEndUtc = new Date(slotStartUtc.getTime() + totalDurationMinutes * 60000);

            // Check against one-off blocks
            let blockedByOneOff = false;
            for (const ob of dayOneOffs) {
                if (slotStartUtc < ob.endUtc && slotEndUtc > ob.startUtc) {
                    blockedByOneOff = true;
                    break;
                }
            }
            if (blockedByOneOff) continue;

            // Check against existing bookings
            let collision = false;
            for (const bk of dayBookings) {
                if (slotStartUtc < bk.endUtc && slotEndUtc > bk.startUtc) {
                    collision = true;
                    break;
                }
            }
            if (collision) continue;

            // Skip slots in the past
            if (slotStartUtc <= new Date()) continue;

            allSlots.push(slotStartUtc.toISOString());
        }

        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }

    return allSlots;
}

/**
 * Compute total duration for a booking.
 */
function computeTotalDuration(services, addOns, settings, isNewClient) {
    let total = 0;

    for (const svc of services) {
        total += svc.duration_minutes;
    }
    for (const addon of addOns) {
        total += addon.add_minutes;
    }

    total += (settings.buffer_before_default || 0);
    total += (settings.buffer_after_default || 0);

    if (isNewClient && settings.ask_new_client && settings.new_client_extra_minutes > 0) {
        total += settings.new_client_extra_minutes;
    }

    return total;
}

/**
 * Validate a specific slot is still available (double-booking prevention).
 * Called at booking creation time.
 */
async function validateSlotAvailable(supabase, params) {
    const {
        businessId, timezone, startAt, totalDurationMinutes,
        settings, availabilityRules, blackoutBlocks
    } = params;

    const startUtc = new Date(startAt);
    const endUtc = new Date(startUtc.getTime() + totalDurationMinutes * 60000);
    const dateStr = utcToLocalDate(startUtc, timezone);
    const dayOfWeek = getDayOfWeekFromDate(startUtc, timezone);

    // 1. Check business hours
    const rule = availabilityRules.find(r => r.day_of_week === dayOfWeek);
    if (!rule || rule.is_closed) {
        return { valid: false, reason: 'not_available' };
    }

    const startMinutes = utcToLocalMinutes(startUtc, timezone);
    const endMinutes = startMinutes + totalDurationMinutes;
    const openMinutes = timeToMinutes(rule.open_time);
    const closeMinutes = timeToMinutes(rule.close_time);
    const effectiveClose = closeMinutes - (settings.end_of_day_cutoff_minutes || 0);

    if (startMinutes < openMinutes || endMinutes > effectiveClose) {
        return { valid: false, reason: 'not_available' };
    }

    // 2. Check blackout blocks
    const dayBlackouts = blackoutBlocks
        .filter(b => b.day_of_week === dayOfWeek && b.is_active);

    for (const bo of dayBlackouts) {
        const boStart = timeToMinutes(bo.start_time) - (settings.pre_blackout_cutoff_minutes || 0);
        const boEnd = timeToMinutes(bo.end_time);
        if (startMinutes < boEnd && endMinutes > boStart) {
            return { valid: false, reason: 'not_available' };
        }
    }

    // 3. Check one-off blocks
    const { data: oneOffs } = await supabase
        .from('one_off_blocks')
        .select('start_at, end_at')
        .eq('business_id', businessId)
        .lte('start_at', endUtc.toISOString())
        .gte('end_at', startUtc.toISOString());

    if (oneOffs && oneOffs.length > 0) {
        return { valid: false, reason: 'not_available' };
    }

    // 4. Check existing confirmed bookings (the critical double-booking check)
    const { data: conflicts } = await supabase
        .from('bookings')
        .select('id, start_at, end_at')
        .eq('business_id', businessId)
        .eq('status', 'confirmed')
        .lt('start_at', endUtc.toISOString())
        .gt('end_at', startUtc.toISOString());

    if (conflicts && conflicts.length > 0) {
        return { valid: false, reason: 'not_available' };
    }

    // 5. Check it's not in the past
    if (startUtc <= new Date()) {
        return { valid: false, reason: 'not_available' };
    }

    return { valid: true };
}

/**
 * Find next N available slots starting from a given date.
 * Used for "next suggestions" when requested date has no availability.
 */
async function findNextSuggestions(supabase, params, count = 5) {
    const { businessId, timezone, startDate, totalDurationMinutes, settings } = params;

    // Fetch rules
    const { data: availRules } = await supabase
        .from('availability_rules')
        .select('*')
        .eq('business_id', businessId);

    const { data: blackouts } = await supabase
        .from('blackout_blocks')
        .select('*')
        .eq('business_id', businessId)
        .eq('is_active', true);

    const suggestions = [];
    let searchDate = new Date(startDate + 'T12:00:00Z');
    let daysSearched = 0;
    const maxDays = 30; // Look ahead up to 30 days

    while (suggestions.length < count && daysSearched < maxDays) {
        const dateStr = formatLocalDate(searchDate);
        const nextDateStr = formatLocalDate(new Date(searchDate.getTime() + 86400000));

        // Fetch bookings for this date range
        const dayStart = localTimeToUtc(dateStr, 0, timezone);
        const dayEnd = localTimeToUtc(nextDateStr, 0, timezone);

        const { data: bookings } = await supabase
            .from('bookings')
            .select('start_at, end_at, status')
            .eq('business_id', businessId)
            .eq('status', 'confirmed')
            .gte('start_at', dayStart.toISOString())
            .lt('start_at', dayEnd.toISOString());

        const { data: oneOffs } = await supabase
            .from('one_off_blocks')
            .select('start_at, end_at')
            .eq('business_id', businessId)
            .lte('start_at', dayEnd.toISOString())
            .gte('end_at', dayStart.toISOString());

        const daySlots = generateAvailableSlots({
            timezone,
            dateFrom: dateStr,
            dateTo: dateStr,
            totalDurationMinutes,
            settings,
            availabilityRules: availRules || [],
            blackoutBlocks: blackouts || [],
            oneOffBlocks: oneOffs || [],
            existingBookings: bookings || []
        });

        for (const slot of daySlots) {
            if (suggestions.length >= count) break;
            suggestions.push(slot);
        }

        searchDate.setUTCDate(searchDate.getUTCDate() + 1);
        daysSearched++;
    }

    return suggestions;
}

// ============================================================================
// TIMEZONE HELPERS
// ============================================================================

/**
 * Convert "HH:MM" or "HH:MM:SS" time string to minutes since midnight.
 */
function timeToMinutes(timeStr) {
    const parts = timeStr.split(':');
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

/**
 * Convert minutes since midnight to "HH:MM" string.
 */
function minutesToTime(minutes) {
    const h = Math.floor(minutes / 60).toString().padStart(2, '0');
    const m = (minutes % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
}

/**
 * Format a Date as YYYY-MM-DD (using UTC to match our T12:00:00Z convention).
 */
function formatLocalDate(date) {
    const y = date.getUTCFullYear();
    const m = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const d = date.getUTCDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * Get day of week (0=Sunday) for a date.
 * Since we create iteration dates at noon UTC, getUTCDay() is always
 * the correct calendar day for any timezone within ±12h of UTC.
 */
function getDayOfWeek(date, timezone) {
    return date.getUTCDay();
}

function getDayOfWeekFromDate(utcDate, timezone) {
    // For actual UTC timestamps (bookings), convert to local day
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        weekday: 'short'
    });
    const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const parts = formatter.formatToParts(utcDate);
    const weekday = parts.find(p => p.type === 'weekday')?.value;
    return dayMap[weekday] ?? utcDate.getUTCDay();
}

/**
 * Convert local date + minutes-since-midnight to a UTC Date.
 */
function localTimeToUtc(dateStr, minutesSinceMidnight, timezone) {
    const hours = Math.floor(minutesSinceMidnight / 60);
    const minutes = minutesSinceMidnight % 60;
    const localStr = `${dateStr}T${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;

    // Use Intl.DateTimeFormat to find the offset
    const tempDate = new Date(localStr + 'Z');
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false
    });

    // Find offset by comparing UTC interpretation with timezone interpretation
    // This is a robust approach that handles DST
    const utcMs = Date.UTC(
        parseInt(dateStr.slice(0, 4)),
        parseInt(dateStr.slice(5, 7)) - 1,
        parseInt(dateStr.slice(8, 10)),
        hours, minutes, 0
    );

    // Format the UTC timestamp in the target timezone
    const parts = formatter.formatToParts(new Date(utcMs));
    const getPart = (type) => parts.find(p => p.type === type)?.value;

    const tzYear = parseInt(getPart('year'));
    const tzMonth = parseInt(getPart('month')) - 1;
    const tzDay = parseInt(getPart('day'));
    const tzHour = parseInt(getPart('hour'));
    const tzMinute = parseInt(getPart('minute'));

    const tzMs = Date.UTC(tzYear, tzMonth, tzDay, tzHour, tzMinute, 0);
    const offsetMs = tzMs - utcMs;

    // The local time we want = utcMs, but shifted by offset
    return new Date(utcMs - offsetMs);
}

/**
 * Convert UTC Date to local minutes-since-midnight in timezone.
 */
function utcToLocalMinutes(utcDate, timezone) {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: '2-digit', minute: '2-digit',
        hour12: false
    });
    const parts = formatter.formatToParts(utcDate);
    const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
    const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
    return hour * 60 + minute;
}

/**
 * Convert UTC date to local YYYY-MM-DD string.
 */
function utcToLocalDate(utcDate, timezone) {
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone });
    return formatter.format(utcDate);
}

/**
 * Check if a UTC range overlaps with a local date.
 */
function overlapsDayInTimezone(startAt, endAt, dateStr, timezone) {
    const dayStartUtc = localTimeToUtc(dateStr, 0, timezone);
    const dayEndUtc = new Date(dayStartUtc.getTime() + 24 * 60 * 60000);
    const start = new Date(startAt);
    const end = new Date(endAt);
    return start < dayEndUtc && end > dayStartUtc;
}

/**
 * Convert a naive datetime string (e.g. "2026-03-04T12:00:00") to UTC,
 * interpreting it as local time in the given timezone.
 */
function naiveDatetimeToUtc(datetimeStr, timezone) {
    // Parse the naive string components
    const match = datetimeStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!match) return null;
    const [, year, month, day, hour, minute] = match;
    const dateStr = `${year}-${month}-${day}`;
    const minutesSinceMidnight = parseInt(hour) * 60 + parseInt(minute);
    return localTimeToUtc(dateStr, minutesSinceMidnight, timezone);
}

module.exports = {
    generateAvailableSlots,
    computeTotalDuration,
    validateSlotAvailable,
    findNextSuggestions,
    naiveDatetimeToUtc,
    timeToMinutes,
    minutesToTime,
    formatLocalDate,
    localTimeToUtc,
    utcToLocalMinutes,
    utcToLocalDate
};
