// functions/admin-photos.js
// Manage client style reference photos
// POST /api/admin-photos { action: "list"|"delete"|"get_upload_url", ... }

const { getSupabase } = require('./utils/supabase');
const { jsonResponse, corsHeaders, rateLimit, getClientIP, isUUID } = require('./utils/validate');
const { verifyAdminToken } = require('./utils/auth');

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return corsHeaders();

    const ip = getClientIP(event);
    if (!rateLimit(ip)) return jsonResponse(429, { error: 'Too many requests' });

    const auth = verifyAdminToken(event);
    if (!auth?.businessId) return jsonResponse(401, { error: 'Unauthorized' });

    let body;
    try { body = JSON.parse(event.body); } catch { return jsonResponse(400, { error: 'Invalid JSON' }); }

    const supabase = getSupabase();
    const businessId = auth.businessId;

    switch (body.action) {
        case 'list': {
            if (!body.client_id || !isUUID(body.client_id)) return jsonResponse(400, { error: 'client_id required' });
            const { data } = await supabase.from('client_photos')
                .select('id, public_url, caption, disclaimer, created_at, booking_id')
                .eq('business_id', businessId).eq('client_id', body.client_id)
                .order('created_at', { ascending: false });
            return jsonResponse(200, { photos: data || [] });
        }
        case 'get_upload_url': {
            // Returns a signed upload URL for Supabase Storage
            if (!body.client_id || !isUUID(body.client_id)) return jsonResponse(400, { error: 'client_id required' });
            const ext = (body.filename || 'photo.jpg').split('.').pop().toLowerCase();
            const allowed = ['jpg', 'jpeg', 'png', 'webp', 'heic'];
            if (!allowed.includes(ext)) return jsonResponse(400, { error: 'File type not allowed' });

            const path = `clients/${businessId}/${body.client_id}/${Date.now()}.${ext}`;
            const { data, error } = await supabase.storage
                .from('client-photos')
                .createSignedUploadUrl(path);

            if (error) return jsonResponse(500, { error: 'Could not generate upload URL' });

            return jsonResponse(200, {
                upload_url: data.signedUrl,
                path,
                token: data.token
            });
        }
        case 'save': {
            // After upload completes, save the record
            if (!body.client_id || !body.storage_path || !body.public_url) {
                return jsonResponse(400, { error: 'client_id, storage_path, and public_url required' });
            }
            const { data, error } = await supabase.from('client_photos').insert({
                business_id: businessId,
                client_id: body.client_id,
                booking_id: body.booking_id || null,
                storage_path: body.storage_path,
                public_url: body.public_url,
                caption: body.caption?.slice(0, 200) || null,
                disclaimer: 'Style reference only — not a medical record'
            }).select().single();
            if (error) return jsonResponse(500, { error: 'Failed to save photo' });
            return jsonResponse(201, { photo: data });
        }
        case 'delete': {
            if (!body.id || !isUUID(body.id)) return jsonResponse(400, { error: 'id required' });
            const { data: photo } = await supabase.from('client_photos')
                .select('storage_path').eq('id', body.id).eq('business_id', businessId).single();
            if (!photo) return jsonResponse(404, { error: 'Photo not found' });
            // Delete from storage
            await supabase.storage.from('client-photos').remove([photo.storage_path]);
            // Delete record
            await supabase.from('client_photos').delete().eq('id', body.id).eq('business_id', businessId);
            return jsonResponse(200, { deleted: true });
        }
        default:
            return jsonResponse(400, { error: 'Unknown action' });
    }
};
