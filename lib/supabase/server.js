// lib/supabase/server.js
import { createClient } from '@supabase/supabase-js';

let cached = { admin: null, bucket: null };

function env(name) {
  const v = process.env[name];
  return typeof v === 'string' ? v.trim() : '';
}

export function getSupabaseAdmin() {
  // accept common fallbacks in case of misnamed envs
  const supabaseUrl =
    env('NEXT_PUBLIC_SUPABASE_URL') || env('SUPABASE_URL');

  const serviceRole =
    env('SUPABASE_SERVICE_ROLE_KEY') || env('SUPABASE_SERVICE_ROLE');

  const AVATAR_BUCKET =
    env('SUPABASE_BUCKET') || env('NEXT_PUBLIC_SUPABASE_BUCKET') || 'avatars';

  if (!supabaseUrl || !serviceRole) {
    // log which one is missing (names only; no secrets)
    console.error('[upload-avatar] missing Supabase envs', {
      hasUrl: !!supabaseUrl,
      hasService: !!serviceRole,
      urlName: 'NEXT_PUBLIC_SUPABASE_URL',
      serviceName: 'SUPABASE_SERVICE_ROLE_KEY',
    });
    const err = new Error(
      `Supabase server envs missing: ${
        !supabaseUrl ? 'NEXT_PUBLIC_SUPABASE_URL ' : ''
      }${!serviceRole ? 'SUPABASE_SERVICE_ROLE_KEY ' : ''}`.trim()
    );
    err.code = 'MISSING_SUPABASE_ENVS';
    throw err;
  }

  if (!cached.admin) {
    cached.admin = createClient(supabaseUrl, serviceRole, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }
  cached.bucket = AVATAR_BUCKET;

  return { supabaseAdmin: cached.admin, AVATAR_BUCKET: cached.bucket };
}

/** Ensure bucket exists; create it (private) if missing. */
export async function ensureBucket(name) {
  const { supabaseAdmin } = getSupabaseAdmin();
  const bucket = name || cached.bucket || 'avatars';

  const { data, error } = await supabaseAdmin.storage.getBucket(bucket);
  if (error && !/not found/i.test(error.message)) throw error;

  if (!data) {
    const { error: cErr } = await supabaseAdmin.storage.createBucket(bucket, {
      public: false,
      fileSizeLimit: '10MB',
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    });
    if (cErr && !/already exists/i.test(cErr.message)) throw cErr;
  }
  return bucket;
}
