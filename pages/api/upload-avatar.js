// pages/api/upload-avatar.js
export const config = { api: { bodyParser: false } };
export const runtime = 'nodejs';

import formidable from 'formidable';
import { getSupabaseAdmin, ensureBucket } from '@/lib/supabase/server';
import { authAdmin, dbAdmin, FieldValue } from '@/lib/firebase/firebaseAdmin'; // <-- use dbAdmin
import fs from 'fs';
import fsp from 'fs/promises';

function parseForm(req) {
  const form = formidable({ multiples: false, maxFileSize: 10 * 1024 * 1024 });
  return new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => (err ? reject(err) : resolve({ fields, files })));
  });
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    // --- Auth: verify Firebase ID token from Authorization header ---
    const authHeader = req.headers.authorization || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!idToken) return res.status(401).json({ error: 'Unauthorized. Token missing.' });

    let decoded;
    try {
      decoded = await authAdmin.verifyIdToken(idToken, true);
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    const uid = decoded.uid;

    // --- Supabase: admin client + bucket ---
    const { supabaseAdmin, AVATAR_BUCKET } = getSupabaseAdmin();
    await ensureBucket(AVATAR_BUCKET); // no-op if exists

    // --- Parse incoming file ---
    const { files } = await parseForm(req);
    const inputFile =
      files?.file ||
      files?.image ||
      files?.avatar ||
      (Array.isArray(files?.file) ? files.file[0] : null);

    if (!inputFile) return res.status(400).json({ error: 'No file uploaded (field name must be "file")' });

    const mime = inputFile.mimetype || 'application/octet-stream';
    const name = inputFile.originalFilename || 'avatar.jpg';
    const ext = (name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    // --- Read temp file buffer ---
    const buffer = fs.readFileSync(inputFile.filepath);

    // --- Upload to Supabase Storage ---
    const { error: upErr } = await supabaseAdmin.storage
      .from(AVATAR_BUCKET)
      .upload(path, buffer, { contentType: mime, upsert: true });

    // cleanup temp
    try { await fsp.unlink(inputFile.filepath); } catch {}

    if (upErr) {
      if (/bucket/i.test(upErr.message)) {
        return res.status(400).json({ error: `Supabase bucket "${AVATAR_BUCKET}" not found.` });
      }
      return res.status(500).json({ error: `Upload failed: ${upErr.message || upErr}` });
    }

    // --- Build a (long) signed URL (private bucket) ---
    const { data: signed, error: sErr } = await supabaseAdmin
      .storage.from(AVATAR_BUCKET)
      .createSignedUrl(path, 60 * 60 * 24 * 365); // 1 year

    if (sErr) return res.status(500).json({ error: `URL generation failed: ${sErr.message}` });

    const photoURL = signed?.signedUrl || null;
    if (!photoURL) return res.status(500).json({ error: 'Upload succeeded but URL could not be created.' });

    // --- Update Firebase Auth user's photoURL (non-fatal if it fails) ---
    try {
      await authAdmin.updateUser(uid, { photoURL });
    } catch (e) {
      console.error('[upload-avatar] admin updateUser failed:', e);
    }

    // --- Update Firestore user doc (Admin SDK, using dbAdmin) ---
    try {
      await dbAdmin.collection('users').doc(uid).set(
        { photoURL, avatarPath: path, updatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
    } catch (e) {
      console.error('[upload-avatar] Firestore set failed:', e);
      // still return success — the client will also merge/update user doc
    }

    return res.status(200).json({ photoURL, avatarPath: path });
  } catch (e) {
    console.error('[upload-avatar] error', e);
    res.status(500).json({ error: e.message || 'Unexpected server error' });
  }
}
