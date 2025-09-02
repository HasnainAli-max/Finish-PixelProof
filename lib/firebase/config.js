// lib/firebase/config.js
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  sendPasswordResetEmail,
  updatePassword as fbUpdatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  connectAuthEmulator,
} from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage /*, connectStorageEmulator */ } from "firebase/storage";

// ---- STRICT env (no demo fallbacks)
const firebaseConfig = {
  apiKey:        process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:     process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:         process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || undefined,
};

const missing = Object.entries(firebaseConfig)
  .filter(([k, v]) => k !== "measurementId" && !v)
  .map(([k]) => k);
if (missing.length) {
  throw new Error(`[firebase] Missing NEXT_PUBLIC_* envs: ${missing.join(", ")}`);
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db   = getFirestore(app);
export const storage = getStorage(app);

// ---- Emulators: EXPLICIT ONLY (no localhost auto) ----
// Support both keys for compatibility: NEXT_PUBLIC_USE_EMULATOR or NEXT_PUBLIC_USE_EMULATORS
const useEmulators =
  process.env.NEXT_PUBLIC_USE_EMULATORS === "true" ||
  process.env.NEXT_PUBLIC_USE_EMULATORS === "1" ||
  process.env.NEXT_PUBLIC_USE_EMULATOR  === "true" ||
  process.env.NEXT_PUBLIC_USE_EMULATOR  === "1";

if (useEmulators && typeof window !== "undefined" && !window.__PP_EMU__) {
  try {
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    // connectStorageEmulator(storage, "127.0.0.1", 9199);
    window.__PP_EMU__ = true;
    console.info("[firebase] Connected to local emulators.");
  } catch (e) {
    console.warn("[firebase] Emulator connect failed:", e);
  }
}

// ---- helpers (unchanged API) ----
export const reset = (email, actionCodeSettings) =>
  sendPasswordResetEmail(auth, email, actionCodeSettings);

export const changePassword = async (currentPassword, newPassword) => {
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error("Not signed in.");
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await fbUpdatePassword(user, newPassword);
};
