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

// Force REST transport to avoid local gRPC/protobuf crashes
process.env.FIRESTORE_PREFER_REST = process.env.FIRESTORE_PREFER_REST || "true";
// Optional: reduce gRPC usage elsewhere
process.env.GOOGLE_CLOUD_DISABLE_GRPC = process.env.GOOGLE_CLOUD_DISABLE_GRPC || "1";

const projectId   = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || "pixelproof-18a84";
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey  = process.env.FIREBASE_PRIVATE_KEY
  ? process.env.FIREBASE_PRIVATE_KEY.replace(/^"|"$/g, "").replace(/\\n/g, "\n")
  : undefined;

if (!projectId || !clientEmail || !privateKey) {
  throw new Error("[firebaseAdmin] Missing FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY");
}

// Keep GCP project envs aligned
if (!process.env.GOOGLE_CLOUD_PROJECT) process.env.GOOGLE_CLOUD_PROJECT = projectId;
if (!process.env.GCLOUD_PROJECT) process.env.GCLOUD_PROJECT = projectId;

const adminApp =
  getAdminApps().length
    ? getAdminApp()
    : initAdminApp({
        credential: cert({ projectId, clientEmail, privateKey }),
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      });

// ❗ getFirestore ko sirf 1 arg do (no settings object here)
// preferRest already forced via env variable above
export const dbAdmin = getFirestore(adminApp);

export const authAdmin = getAuth(adminApp);
export const Timestamp = AdminTimestamp;
export const FieldValue = AdminFieldValue;
