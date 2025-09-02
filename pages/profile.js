// pages/profile.js
"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import { auth, db } from "@/lib/firebase/config";
import { onAuthStateChanged, updateProfile, signOut } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import Navbar from "@/components/Navbar";
import ChangePassword from "@/components/ChangePassword";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_MB = 10;

/* ---------------- Modal (neutral outline, overlay/Esc/✕ close) ---------------- */
function AlertModal({ open, variant = "info", title, message, onClose }) {
  if (!open) return null;

  const color =
    variant === "success" ? "text-green-600"
    : variant === "error"   ? "text-red-600"
    : "text-blue-600";

  const Icon = () => (
    variant === "success" ? (
      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-10.707a1 1 0 00-1.414-1.414L9 9.172 7.707 7.879a1 1 0 10-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
    ) : variant === "error" ? (
      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.721-1.36 3.486 0l6.518 11.582c.75 1.334-.213 2.994-1.742 2.994H3.481c-1.529 0-2.492-1.66-1.742-2.994L8.257 3.1zM11 14a1 1 0 10-2 0 1 1 0 002 0zm-1-2a1 1 0 01-1-1V8a1 1 0 112 0v3a1 1 0 01-1 1z" clipRule="evenodd" />
      </svg>
    ) : (
      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fillRule="evenodd" d="M18 10A8 8 0 11.001 10 8 8 0 0118 10zM9 9V5h2v4H9zm0 6h2v-2H9z" clipRule="evenodd" />
      </svg>
    )
  );

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative h-full w-full grid place-items-center p-4">
        <div
          className="relative w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 shadow-2xl ring-1 ring-gray-200 dark:ring-gray-700 border border-gray-200/70 dark:border-gray-700"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            aria-label="Close"
            onClick={onClose}
            className="absolute top-3 right-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-300/70 dark:border-gray-700/70 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <svg className="h-4 w-4 text-gray-700 dark:text-gray-200" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>

          <div className="p-6">
            <div className={`flex items-center gap-2 ${color}`}>
              <Icon />
              <h3 className="text-lg font-semibold">{title || "Notice"}</h3>
            </div>
            <p className="mt-3 text-sm leading-6 text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{message}</p>
            <div className="mt-5 flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm font-medium"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Persist/sync theme across pages & focus ---------------- */
function useThemeBoot() {
  useEffect(() => {
    const apply = () => {
      try {
        const root = document.documentElement;
        let stored =
          localStorage.getItem("theme") ||
          localStorage.getItem("color-theme") ||
          root.dataset.theme ||
          "";
        stored = stored === "dark" ? "dark" : stored === "light" ? "light" : "";

        if (!stored) {
          const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
          stored = prefersDark ? "dark" : "light";
          localStorage.setItem("theme", stored);
        }
        root.classList.toggle("dark", stored === "dark");
        root.dataset.theme = stored;
      } catch {}
    };

    apply();

    const onStorage = (e) => { if (["theme","color-theme"].includes(e.key)) apply(); };
    const onFocus = () => apply();
    const onVisible = () => document.visibilityState === "visible" && apply();

    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
}

/* ---------------- helpers ---------------- */
const isQuotaError = (err) =>
  err?.code === "resource-exhausted" || /quota|RESOURCE_EXHAUSTED/i.test(err?.message || "");

const waitForImage = (src, timeoutMs = 8000) =>
  new Promise((resolve) => {
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    const img = new Image();
    img.onload = finish;
    img.onerror = finish;
    img.onabort = finish;
    img.referrerPolicy = "no-referrer";
    img.src = src;
    setTimeout(finish, timeoutMs);
  });

export default function Profile() {
  useThemeBoot();

  const router = useRouter();
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);
  const safeSet = (setter) => (...args) => { if (mounted.current) setter(...args); };

  const [user, setUser] = useState(null);
  const [email, setEmail] = useState("");
  const [photoURL, setPhotoURL] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName]   = useState("");
  const [saving, setSaving]       = useState(false);
  const [loading, setLoading]     = useState(true);

  const [file, setFile]           = useState(null);
  const [preview, setPreview]     = useState(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging]   = useState(false);

  const [modal, setModal] = useState({ open:false, variant:"info", title:"", message:"" });
  const showModal = useCallback((v,t,m)=>setModal({open:true,variant:v,title:t,message:m}),[]);
  const closeModal = useCallback(()=>setModal(m=>({...m,open:false})),[]);

  const displayName = useMemo(() => (`${firstName||""} ${lastName||""}`).trim() || "No name set", [firstName,lastName]);
  const initials = useMemo(() => {
    const a=(firstName||"").trim(), b=(lastName||"").trim();
    if (a||b) return `${a?.[0]||""}${b?.[0]||""}`.toUpperCase()||"U";
    const c=(email||"").trim().charAt(0);
    return (c||"U").toUpperCase();
  },[firstName,lastName,email]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.replace("/login"); return; }
      safeSet(setUser)(u);
      safeSet(setEmail)(u.email || "");
      safeSet(setPhotoURL)(u.photoURL || "");
      try {
        const snap = await getDoc(doc(db,"users",u.uid));
        if (snap.exists()) {
          const d = snap.data();
          safeSet(setFirstName)(d.firstName || (u.displayName?.split(" ")?.[0] ?? ""));
          safeSet(setLastName)(d.lastName || (u.displayName?.split(" ")?.slice(1).join(" ") ?? ""));
        } else {
          const parts=(u.displayName||"").trim().split(" ").filter(Boolean);
          safeSet(setFirstName)(parts[0]||"");
          safeSet(setLastName)(parts.slice(1).join(" ")||"");
        }
      } catch {
        const parts=(u.displayName||"").trim().split(" ").filter(Boolean);
        safeSet(setFirstName)(parts[0]||"");
        safeSet(setLastName)(parts.slice(1).join(" ")||"");
      } finally {
        safeSet(setLoading)(false);
      }
    });
    return () => unsub();
  }, [router]);

  useEffect(()=>()=>{ if(preview) URL.revokeObjectURL(preview); },[preview]);

  /* ---------------- Save name ---------------- */
  const handleSave = async () => {
    if (saving) return;
    const current = auth.currentUser;
    if (!current) return showModal("error","Not signed in","Please sign in again.");

    const fn = firstName.trim(), ln = lastName.trim();
    if (!fn) return showModal("error","First name required","Please enter your first name.");

    safeSet(setSaving)(true);
    try {
      const newDisplayName = `${fn} ${ln}`.trim();

      await updateProfile(current, { displayName: newDisplayName });
      console.log("[profile] name auth updated", { uid: current.uid, displayName: newDisplayName });

      setDoc(
        doc(db,"users",current.uid),
        { firstName: fn, lastName: ln, displayName: newDisplayName, updatedAt: serverTimestamp() },
        { merge:true }
      ).then(() => {
        console.log("[profile] name Firestore write OK");
      }).catch((e) => {
        if (isQuotaError(e)) console.warn("[profile] Firestore quota exceeded (name save) — skipping.");
        else console.error("[profile] Firestore name save error:", e);
      });

      showModal("success","Saved","Your name was updated successfully.");
    } catch (e) {
      console.error(e);
      showModal("error","Update failed", e?.message || "Failed to update name.");
    } finally {
      safeSet(setSaving)(false);
    }
  };

  const validateIncomingFile = (f) => {
    if (!f) return "No file selected.";
    if (!ACCEPTED.includes(f.type)) return "Use JPG, PNG, or WEBP.";
    if (f.size > MAX_MB * 1024 * 1024) return `Max file size is ${MAX_MB} MB.`;
    return null;
  };

  const onFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) { setFile(null); if(preview) URL.revokeObjectURL(preview); setPreview(null); return; }
    const err = validateIncomingFile(f); if (err) return showModal("error","Invalid image",err);
    if (preview) URL.revokeObjectURL(preview);
    setFile(f); setPreview(URL.createObjectURL(f));
  };

  const onDrop = (e) => {
    e.preventDefault(); e.stopPropagation(); setDragging(false);
    const f = e.dataTransfer.files?.[0]; if (!f) return;
    const err = validateIncomingFile(f); if (err) return showModal("error","Invalid image",err);
    if (preview) URL.revokeObjectURL(preview);
    setFile(f); setPreview(URL.createObjectURL(f));
  };

  const cancelPreview = () => { if(preview) URL.revokeObjectURL(preview); setPreview(null); setFile(null); };

  /* ---------------- Upload photo ---------------- */
  const handleUploadPhoto = async () => {
    if (uploading) return;
    const current = auth.currentUser;
    if (!current) return showModal("error","Not signed in","Please sign in again.");
    if (!file) return showModal("error","No image selected","Please choose an image first.");

    safeSet(setUploading)(true);
    try {
      const idToken = await current.getIdToken(); // no force refresh

      const form = new FormData();
      form.append("file", file, file.name);

      const res = await fetch("/api/upload-avatar", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
        body: form,
      });

      let data; try { data = await res.json(); } catch { data = {}; }
      if (!res.ok) throw new Error(data?.error || "Upload failed.");

      const newURL = data?.photoURL;
      if (!newURL) return showModal("error","Upload issue","Upload succeeded but URL missing.");

      await waitForImage(newURL);

      await updateProfile(current, { photoURL: newURL });
      safeSet(setPhotoURL)(newURL);
      console.log("[profile] photo auth updated", { uid: current.uid, newURL });

      if (preview) URL.revokeObjectURL(preview);
      setPreview(null); setFile(null);

      showModal("success","Photo updated","Your profile photo was updated successfully.");
    } catch (e) {
      console.error(e);
      showModal("error","Upload failed", e?.message || "Failed to upload image.");
    } finally {
      safeSet(setUploading)(false);
    }
  };

  return (
    <>
      <Navbar user={user} onSignOut={() => signOut(auth)} />

      <main className="max-w-3xl mx-auto px-4 py-6">
        <section className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-5">
          {/* Header */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="relative w-16 h-16 md:w-20 md:h-20 shrink-0">
                {photoURL ? (
                  <img
                    src={photoURL}
                    alt="Profile avatar"
                    className="w-16 h-16 md:w-20 md:h-20 rounded-full object-cover border border-gray-200 bg-gray-100 dark:bg-gray-800"
                    referrerPolicy="no-referrer"
                    onError={() => setPhotoURL("")}
                  />
                ) : (
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center bg-gradient-to-br from-purple-500 to-indigo-600 text-white border border-gray-200 shadow-sm select-none">
                    <span className="text-lg md:text-xl font-semibold tracking-wide">{initials}</span>
                  </div>
                )}
                <label
                  htmlFor="avatar-file"
                  className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow grid place-items-center cursor-pointer hover:scale-105 transition"
                  title="Change photo"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-700 dark:text-gray-200" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9 2a1 1 0 00-.894.553L7.382 4H5a3 3 0 00-3 3v9a3 3 0 003 3h14a3 3 0 003-3V7a3 3 0 00-3-3h-2.382l-.724-1.447A1 1 0 0014 2H9zm3 5a5 5 0 110 10 5 5 0 010-10z" />
                  </svg>
                </label>
                <input id="avatar-file" type="file" accept={ACCEPTED.join(",")} onChange={onFileChange} className="hidden" />
              </div>

              <div className="min-w-0">
                <h1 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-gray-100 truncate">
                  {loading ? "Loading..." : displayName}
                </h1>
                <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 truncate">{email}</p>
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={loading || saving}
              className={`px-3 py-2 rounded-md text-white text-sm font-medium ${loading || saving ? "bg-purple-400 cursor-not-allowed" : "bg-purple-600 hover:bg-purple-700"}`}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>

          {/* Uploader */}
          <div
            onDragOver={(e)=>{ e.preventDefault(); setDragging(true); }}
            onDragEnter={(e)=>{ e.preventDefault(); setDragging(true); }}
            onDragLeave={(e)=>{ e.preventDefault(); setDragging(false); }}
            onDrop={onDrop}
            className={`mt-4 rounded-lg border border-dashed px-3 py-2 text-sm flex items-center gap-3
              ${dragging ? "border-purple-500 bg-purple-50/70 dark:bg-purple-900/20" : "border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900"}`}
          >
            {!preview ? (
              <div className="flex items-center justify-between w-full">
                <span className="text-gray-700 dark:text-gray-300 truncate">Drag & drop an image here. To browse, click the camera icon.</span>
                <span className="text-xs text-gray-500 dark:text-gray-400 hidden sm:inline">JPG/PNG/WEBP · ≤ {MAX_MB}MB</span>
              </div>
            ) : (
              <>
                <img src={preview} alt="Preview" className="h-10 w-10 rounded-full object-cover border border-gray-200 dark:border-gray-700" />
                <div className="flex-1 min-w-0"><p className="text-gray-800 dark:text-gray-200 truncate">{file?.name}</p></div>
                <button onClick={cancelPreview} disabled={uploading}
                        className="px-3 py-1.5 rounded-md border text-sm border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800">
                  Cancel
                </button>
                <button onClick={handleUploadPhoto} disabled={uploading}
                        className={`px-3 py-1.5 rounded-md text-white text-sm ${uploading ? "bg-purple-400 cursor-not-allowed" : "bg-purple-600 hover:bg-purple-700"}`}>
                  {uploading ? "Uploading..." : "Use photo"}
                </button>
              </>
            )}
          </div>

          {/* Name fields */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">First name</label>
              <input
                value={firstName}
                onChange={(e)=>setFirstName(e.target.value)}
                placeholder="First name"
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                disabled={loading || saving}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Last name</label>
              <input
                value={lastName}
                onChange={(e)=>setLastName(e.target.value)}
                placeholder="Last name"
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                disabled={loading || saving}
              />
            </div>
          </div>

          <div className="mt-3">
            <button
              onClick={() => {
                const parts = (auth.currentUser?.displayName || "").trim().split(" ").filter(Boolean);
                setFirstName(parts[0] || "");
                setLastName(parts.slice(1).join(" ") || "");
                showModal("info","Reverted","Reverted to your current account name.");
              }}
              disabled={loading || saving}
              className="inline-flex items-center justify-center px-3 py-1.5 rounded-md text-sm font-medium border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Reset
            </button>
          </div>

          <div className="mt-6">
            <ChangePassword />
          </div>
        </section>
      </main>

      <AlertModal open={modal.open} variant={modal.variant} title={modal.title} message={modal.message} onClose={closeModal} />
    </>
  );
}
