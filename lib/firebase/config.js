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
import { getStorage /* , connectStorageEmulator */ } from "firebase/storage";

// ---- STRICT env (no demo fallbacks)
const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId:     process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || undefined,
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

// Preferred Firestore options (only applied if we are first initializer)
const FS_OPTS = {
  experimentalForceLongPolling: true,
  useFetchStreams: false,
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
};

/* ---------------- Auth ---------------- */
if (!g.__PP_AUTH__) g.__PP_AUTH__ = getAuth(app);
export const auth = g.__PP_AUTH__;

/* ---------------- Firestore ----------------
   Try to initialize with options once; if already initialized elsewhere,
   reuse the existing instance to avoid “initializeFirestore() already called”.
*/
if (!g.__PP_DB__) {
  try {
    g.__PP_DB__ = initializeFirestore(app, FS_OPTS);
  } catch {
    g.__PP_DB__ = getFirestore(app);
  }
}
export const db = g.__PP_DB__;

/* ---------------- Storage ---------------- */
if (!g.__PP_STORAGE__) g.__PP_STORAGE__ = getStorage(app);
export const storage = g.__PP_STORAGE__;

/* ---------------- Emulators (per-service, explicit only) ----------------
   Nothing is enabled in production. You can toggle each service independently:

   NEXT_PUBLIC_EMU_AUTH=true|false
   NEXT_PUBLIC_EMU_FS=true|false
   NEXT_PUBLIC_EMU_STORAGE=true|false

   For backwards compatibility, NEXT_PUBLIC_USE_EMULATORS=true will enable all.
*/
const isProd = process.env.NODE_ENV === "production";
const all = process.env.NEXT_PUBLIC_USE_EMULATORS === "true" ||
            process.env.NEXT_PUBLIC_USE_EMULATORS === "1" ||
            process.env.NEXT_PUBLIC_USE_EMULATOR  === "true" ||
            process.env.NEXT_PUBLIC_USE_EMULATOR  === "1";

const emuAuth = !isProd && (all ||
  process.env.NEXT_PUBLIC_EMU_AUTH === "true" ||
  process.env.NEXT_PUBLIC_EMU_AUTH === "1");

const emuFs = !isProd && (all ||
  process.env.NEXT_PUBLIC_EMU_FS === "true" ||
  process.env.NEXT_PUBLIC_EMU_FS === "1");

const emuStorage = !isProd && (all ||
  process.env.NEXT_PUBLIC_EMU_STORAGE === "true" ||
  process.env.NEXT_PUBLIC_EMU_STORAGE === "1");

if (typeof window !== "undefined") {
  // Bind each emulator at most once (HMR safe)
  if (emuFs && !g.__PP_EMU_FS__) {
    try {
      connectFirestoreEmulator(db, "127.0.0.1", 8080);
      g.__PP_EMU_FS__ = true;
      console.info("[firebase] Firestore → emulator 127.0.0.1:8080");
    } catch (e) {
      console.warn("[firebase] Firestore emulator connect failed:", e);
    }
  }
  if (emuAuth && !g.__PP_EMU_AUTH__) {
    try {
      connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
      g.__PP_EMU_AUTH__ = true;
      console.info("[firebase] Auth → emulator 127.0.0.1:9099");
    } catch (e) {
      console.warn("[firebase] Auth emulator connect failed:", e);
    }
  }
  // If you want Storage emulator, uncomment the import & this block:
  // if (emuStorage && !g.__PP_EMU_STO__) {
  //   try {
  //     connectStorageEmulator(storage, "127.0.0.1", 9199);
  //     g.__PP_EMU_STO__ = true;
  //     console.info("[firebase] Storage → emulator 127.0.0.1:9199");
  //   } catch (e) {
  //     console.warn("[firebase] Storage emulator connect failed:", e);
  //   }
  // }
}

/* ---------------- Helpers (unchanged API) ---------------- */
export const reset = (email, actionCodeSettings) =>
  sendPasswordResetEmail(auth, email, actionCodeSettings);

export const changePassword = async (currentPassword, newPassword) => {
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error("Not signed in.");
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await fbUpdatePassword(user, newPassword);
};
