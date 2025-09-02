// pages/api/upload-avatar.js
export const config = { api: { bodyParser: false } };
export const runtime = 'nodejs';

import formidable from 'formidable';
import { getSupabaseAdmin, ensureBucket } from '@/lib/supabase/server';
import { authAdmin, dbAdmin, FieldValue } from '@/lib/firebase/firebaseAdmin'; // <-- use dbAdmin
import fs from 'fs';
import fsp from 'fs/promises';

function parseForm(req) {
  const form = formidable({ multiples: false, maxFileSize: 10 * 1024 * 1024, keepExtensions: true });
  return new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => (err ? reject(err) : resolve({ fields, files })));
  });
}

// pick first file from any field name/shape
function pickFirstFile(files) {
  if (!files || typeof files !== 'object') return null;
  // prefer "file"
  if (files.file) return Array.isArray(files.file) ? files.file[0] : files.file;
  for (const k of Object.keys(files)) {
    const v = files[k];
    if (!v) continue;
    return Array.isArray(v) ? v[0] : v;
  }
  return null;
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    // ---- Verify Firebase ID token ----
    const authHeader = req.headers.authorization || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!idToken) return res.status(401).json({ error: 'Unauthorized. Token missing.' });

    let decoded;
    try { decoded = await authAdmin.verifyIdToken(idToken, true); }
    catch { return res.status(401).json({ error: 'Invalid or expired token' }); }
    const uid = decoded.uid;

    // ---- Supabase admin + bucket ----
    const { supabaseAdmin, AVATAR_BUCKET } = getSupabaseAdmin();
    await ensureBucket(AVATAR_BUCKET); // no-op if already exists

    // ---- Parse form & pick file safely ----
    const { files } = await parseForm(req);
    const inputFile = pickFirstFile(files);
    if (!inputFile) return res.status(400).json({ error: 'No file uploaded (field name "file" recommended).' });

    const filepath = inputFile.filepath || inputFile.path; // fallback
    if (!filepath) return res.status(400).json({ error: 'Upload failed: file path missing.' });

    const mime = inputFile.mimetype || 'application/octet-stream';
    const original = inputFile.originalFilename || inputFile.newFilename || 'avatar.jpg';
    const ext = (original.split('.').pop() || 'jpg').toLowerCase();
    const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    // ---- Read temp file, upload to Supabase ----
    let buffer;
    try {
      buffer = fs.readFileSync(filepath);
    } catch (e) {
      console.error('[upload-avatar] read temp file failed:', e);
      return res.status(500).json({ error: 'Failed to read uploaded file.' });
    }

    const { error: upErr } = await supabaseAdmin.storage
      .from(AVATAR_BUCKET)
      .upload(path, buffer, { contentType: mime, upsert: true });

    // cleanup temp file
    try { await fsp.unlink(filepath); } catch {}

    if (upErr) {
      if (/bucket/i.test(upErr.message)) {
        return res.status(400).json({ error: `Supabase bucket "${AVATAR_BUCKET}" not found.` });
      }
      return res.status(500).json({ error: `Upload failed: ${upErr.message || upErr}` });
    }

    // ---- Create a signed URL (1 year) ----
    const { data: signed, error: sErr } = await supabaseAdmin
      .storage.from(AVATAR_BUCKET)
      .createSignedUrl(path, 60 * 60 * 24 * 365);

    if (sErr) return res.status(500).json({ error: `URL generation failed: ${sErr.message}` });

    const photoURL = signed?.signedUrl || null;
    if (!photoURL) return res.status(500).json({ error: 'Upload succeeded but URL could not be created.' });

    // ---- Update Firebase Auth (non-fatal if fails) ----
    try {
      await authAdmin.updateUser(uid, { photoURL });
    } catch (e) {
      console.error("[upload-avatar] admin updateUser failed:", e);
    }

    // ---- Update Firestore (Admin SDK) ----
    try {
      if (dbAdmin && typeof dbAdmin.collection === 'function') {
        await dbAdmin.collection('users').doc(uid).set(
          { photoURL, avatarPath: path, updatedAt: FieldValue.serverTimestamp() },
          { merge: true }
        );
      } else {
        // Back-compat: if someone still imports { db } elsewhere, we also exported alias above.
        console.error("[upload-avatar] dbAdmin is undefined or invalid. Skipping Firestore write.");
      }
    } catch (e) {
      console.error("[upload-avatar] Firestore set failed:", e);
      // still return success — client also merges user doc
    }

    return res.status(200).json({ photoURL, avatarPath: path });
  } catch (e) {
    console.error('[upload-avatar] error', e);
    res.status(500).json({ error: e.message || 'Unexpected server error' });
  }
}
