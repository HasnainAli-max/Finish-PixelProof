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
import {
  initializeFirestore,
  getFirestore,
  connectFirestoreEmulator,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { getStorage /*, connectStorageEmulator */ } from "firebase/storage";

// ---- STRICT env (no demo fallbacks)
const firebaseConfig = {
  apiKey:             process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:         process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:          process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId:  process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:              process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId:      process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || undefined,
};

const missing = Object.entries(firebaseConfig)
  .filter(([k, v]) => k !== "measurementId" && !v)
  .map(([k]) => k);
if (missing.length) {
  throw new Error(`[firebase] Missing NEXT_PUBLIC_* envs: ${missing.join(", ")}`);
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// ---- Singleton guards (survive HMR & multi-imports)
const g = globalThis;

// Preferred options when we are the first initializer
const FS_OPTS = {
  experimentalForceLongPolling: true,
  useFetchStreams: false,
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
};

// Auth
if (!g.__PP_AUTH__) g.__PP_AUTH__ = getAuth(app);
export const auth = g.__PP_AUTH__;

// Firestore: try to init with options; if already initted, reuse
if (!g.__PP_DB__) {
  try { g.__PP_DB__ = initializeFirestore(app, FS_OPTS); }
  catch { g.__PP_DB__ = getFirestore(app); }
}
export const db = g.__PP_DB__;

// Storage
if (!g.__PP_STORAGE__) g.__PP_STORAGE__ = getStorage(app);
export const storage = g.__PP_STORAGE__;

// ---- Emulators (explicit only)
const useEmulators =
  process.env.NEXT_PUBLIC_USE_EMULATORS === "true" ||
  process.env.NEXT_PUBLIC_USE_EMULATORS === "1" ||
  process.env.NEXT_PUBLIC_USE_EMULATOR  === "true" ||
  process.env.NEXT_PUBLIC_USE_EMULATOR  === "1";

if (useEmulators && typeof window !== "undefined" && !g.__PP_EMU_BOUND__) {
  try {
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    // connectStorageEmulator(storage, "127.0.0.1", 9199);
    g.__PP_EMU_BOUND__ = true;
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
