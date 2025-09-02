// pages/api/contact-create.js
export const runtime = "nodejs";

import { authAdmin, dbAdmin, FieldValue } from "@/lib/firebase/firebaseAdmin";

/**
 * Accepts POST JSON:
 * { name: string, email: string, message: string, uid?: string }
 * If Authorization: Bearer <idToken> is present, we validate and override uid.
 */
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    // Optional: verify id token if provided (lets you trust uid)
    let uidFromToken = null;
    const authHeader = req.headers.authorization || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (idToken) {
      try {
        const decoded = await authAdmin.verifyIdToken(idToken, true);
        uidFromToken = decoded.uid;
      } catch {
        // ignore invalid token (treat as anonymous)
      }
    }

    const { name, email, message, uid } = req.body || {};
    if (!name || !email || !message) {
      return res.status(400).json({ error: "Missing fields: name, email, message" });
    }

    const payload = {
      name: String(name).trim(),
      email: String(email).toLowerCase().trim(),
      message: String(message).trim(),
      uid: uidFromToken || (uid ?? null),
      status: "new",
      createdAt: FieldValue.serverTimestamp(),
    };

    const ref = await dbAdmin.collection("contactMessages").add(payload);
    return res.status(200).json({ id: ref.id });
  } catch (e) {
    console.error("[api/contact-create] error:", e);
    // Bubble up useful messages but avoid leaking internals
    return res.status(500).json({ error: e?.message || "Server error" });
  }
}
