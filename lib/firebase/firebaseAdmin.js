// lib/firebase/firebaseAdmin.js
import {
  initializeApp as initAdminApp,
  cert,
  getApps as getAdminApps,
  getApp as getAdminApp,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import {
  getFirestore,
  Timestamp as AdminTimestamp,
  FieldValue as AdminFieldValue,
} from "firebase-admin/firestore";

// Force REST transport on Vercel; avoid gRPC issues.
process.env.FIRESTORE_PREFER_REST = process.env.FIRESTORE_PREFER_REST || "true";
process.env.GOOGLE_CLOUD_DISABLE_GRPC =
  process.env.GOOGLE_CLOUD_DISABLE_GRPC || "1";

// ---- Required envs
const projectId =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.GCLOUD_PROJECT;

const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

// Accept both raw multi-line and "\n" encoded formats; strip accidental quotes.
const rawKey = process.env.FIREBASE_PRIVATE_KEY;
const privateKey = rawKey
  ? rawKey.replace(/^"|"$/g, "").replace(/\\n/g, "\n")
  : undefined;

if (!projectId || !clientEmail || !privateKey) {
  throw new Error(
    "[firebaseAdmin] Missing FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY"
  );
}

// Keep Google project envs aligned for downstream libs
if (!process.env.GOOGLE_CLOUD_PROJECT) process.env.GOOGLE_CLOUD_PROJECT = projectId;
if (!process.env.GCLOUD_PROJECT) process.env.GCLOUD_PROJECT = projectId;

// Initialize once (safe across hot reloads / multiple imports)
const adminApp =
  getAdminApps().length
    ? getAdminApp()
    : initAdminApp({
        credential: cert({ projectId, clientEmail, privateKey }),
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET, // optional
      });

// NOTE: Do NOT pass a settings object to getFirestore() here.
// The Admin SDK manages its own transport based on env vars above.
export const dbAdmin = getFirestore(adminApp);
export const db = dbAdmin; // alias for backward compatibility

export const authAdmin = getAuth(adminApp);
export const Timestamp = AdminTimestamp;
export const FieldValue = AdminFieldValue;
