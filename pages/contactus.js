// pages/contactus.js
"use client";

import Head from "next/head";
import { useEffect, useState, useRef, useCallback } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/config";
import Navbar from "@/components/Navbar";

/* ---------------- Theme boot & sync ---------------- */
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

/* ---------------- Modal ---------------- */
function Modal({ open, onClose, title, children, variant = "info" }) {
  const [show, setShow] = useState(false);
  useEffect(() => { if (open) setShow(true); else { const t=setTimeout(()=>setShow(false),120); return ()=>clearTimeout(t);} }, [open]);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    if (open) { window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }
  }, [open, onClose]);
  if (!open && !show) return null;
  const color =
    variant === "error" ? "text-red-600" :
    variant === "success" ? "text-green-600" : "text-blue-600";

  return (
    <div aria-modal="true" role="dialog" className="fixed inset-0 z-50 flex items-center justify-center">
      <div className={`absolute inset-0 bg-black/40 transition-opacity ${open ? "opacity-100" : "opacity-0"}`} onClick={onClose}/>
      <div
        className={`relative z-10 w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 shadow-2xl
                    ring-1 ring-gray-200 dark:ring-gray-700 border border-gray-200/70 dark:border-gray-700
                    p-6 transition-all duration-150 ${open ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 rounded-md p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
        {title ? <h2 className={`text-lg font-semibold pr-8 ${color}`}>{title}</h2> : null}
        <div className="mt-3 text-sm text-gray-800 dark:text-gray-200">{children}</div>
        <div className="mt-5 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white">OK</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- queue helpers ---------------- */
const QKEY = "pp_contact_queue";
const isQuotaOrTransient = (err) =>
  err?.code === "resource-exhausted" ||
  err?.code === "unavailable" ||
  /quota|RESOURCE_EXHAUSTED|deadline|backoff|unavailable/i.test(err?.message || "");

// local queue
function loadQueue() { try { return JSON.parse(localStorage.getItem(QKEY) || "[]"); } catch { return []; } }
function saveQueue(q) { try { localStorage.setItem(QKEY, JSON.stringify(q)); } catch {} }

// fetch with timeout
const fetchWithTimeout = (url, init = {}, ms = 15000) =>
  new Promise((resolve, reject) => {
    const ctl = new AbortController();
    const id = setTimeout(() => { ctl.abort(); reject(new Error("soft-timeout")); }, ms);
    fetch(url, { ...init, signal: ctl.signal })
      .then((r) => { clearTimeout(id); resolve(r); })
      .catch((e) => { clearTimeout(id); reject(e); });
  });

export default function ContactUs() {
  useThemeBoot();

  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);
  const safeSet = (setter) => (...args) => { if (mounted.current) setter(...args); };

  const [user, setUser] = useState(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [modal, setModal] = useState({ open:false, title:"", content:"", variant:"info" });
  const openModal = useCallback((variant, title, content) => setModal({ open:true, title, content, variant }), []);
  const closeModal = useCallback(() => setModal((m) => ({ ...m, open:false })), []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u || null));
    return () => unsub();
  }, []);

  /* ---------------- Try server first when flushing queue ---------------- */
  const postViaAPI = useCallback(async (payload) => {
    const token = await auth.currentUser?.getIdToken?.();
    const res = await fetchWithTimeout(
      "/api/contact-create",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      },
      15000
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || "Server error");
    return data;
  }, []);

  const flushing = useRef(false);
  const flushQueue = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    try {
      let q = loadQueue();
      if (!q.length) return;

      const ok = [];
      for (const item of q) {
        try {
          // Prefer server
          await postViaAPI(item.payload);
          ok.push(item.id);
        } catch (apiErr) {
          try {
            // fallback to client Firestore
            await addDoc(collection(db, "contactMessages"), {
              ...item.payload,
              createdAt: serverTimestamp(),
              status: item.payload.status || "new",
            });
            ok.push(item.id);
          } catch (clientErr) {
            if (!isQuotaOrTransient(clientErr)) {
              // drop non-retryable
              console.error("[contactus] drop queued item:", clientErr);
              ok.push(item.id);
            }
          }
        }
      }
      if (ok.length) {
        q = loadQueue().filter((it) => !ok.includes(it.id));
        saveQueue(q);
      }
    } finally {
      flushing.current = false;
    }
  }, [postViaAPI]);

  useEffect(() => {
    window.__flushContactQueue = () => flushQueue();
    flushQueue();
    const onOnline = () => flushQueue();
    const onFocus  = () => flushQueue();
    const onVisible= () => document.visibilityState === "visible" && flushQueue();
    window.addEventListener("online", onOnline);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [flushQueue]);

  const handleSignOut = async () => { try { await signOut(auth); } catch (e) { console.error("Sign out failed:", e); } };

  const validate = () => {
    if (!name.trim()) { openModal("error","Missing name","Please enter your name."); return false; }
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email)) { openModal("error","Invalid email","Please enter a valid email address."); return false; }
    if (!message.trim() || message.trim().length < 10) { openModal("error","Message too short","Message must be at least 10 characters."); return false; }
    return true;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    safeSet(setSubmitting)(true);
    const payload = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      message: message.trim(),
      uid: user?.uid || null,
      status: "new",
    };

    try {
      // 1) Try server route first (most reliable)
      const data = await postViaAPI(payload);
      console.log("[contactus] saved via API:", data);
      setName(""); setEmail(""); setMessage("");
      openModal("success", "Message sent", "Thanks! Your message was saved successfully.");
    } catch (apiErr) {
      console.warn("[contactus] API failed, falling back to client:", apiErr);
      try {
        // 2) Fallback: direct client write
        const ref = await addDoc(collection(db, "contactMessages"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        console.log("[contactus] saved via client:", ref.id);
        setName(""); setEmail(""); setMessage("");
        openModal("success", "Message sent", "Thanks! Your message was saved successfully.");
      } catch (clientErr) {
        console.error("[contactus] immediate write failed:", clientErr);
        // 3) Queue if it's transient/quota/timeout; else show error
        if (isQuotaOrTransient(clientErr) || String(clientErr?.message || "").includes("soft-timeout")) {
          const q = loadQueue();
          q.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, payload });
          saveQueue(q);
          setName(""); setEmail(""); setMessage("");
          openModal("info", "Queued for retry", "Service is busy right now. Your message is queued and will be sent automatically soon.");
          setTimeout(() => flushQueue(), 1500);
        } else {
          openModal("error", "Couldn’t send message", clientErr?.message || "Please try again.");
        }
      }
    } finally {
      safeSet(setSubmitting)(false);
    }
  };

  return (
    <>
      <Head><title>Contact Us – PixelProof</title></Head>
      <Navbar user={user} onSignOut={handleSignOut} />

      <main className="min-h-screen bg-gradient-to-b from-[#f7f8ff] to-white dark:from-slate-950 dark:to-slate-900 text-slate-800 dark:text-slate-100">
        <section className="max-w-3xl mx-auto px-6 py-14 md:py-20">
          <header className="mb-8">
            <h1 className="text-3xl sm:text-4xl font-extrabold leading-tight">
              Get in <span className="text-[#6c2bd9]">touch</span>
            </h1>
            <p className="mt-2 text-slate-600 dark:text-slate-300">
              Have a question or feedback? Send us a message and we’ll get back soon.
            </p>
          </header>

          <form onSubmit={onSubmit} className="rounded-2xl p-6 sm:p-8 bg-white dark:bg-slate-800 ring-1 ring-black/5 dark:ring-white/10 shadow-sm">
            <label className="block mb-4">
              <span className="block text-sm font-medium text-slate-700 dark:text-slate-200">Name</span>
              <input
                type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name"
                className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 h-11 outline-none focus:ring-2 focus:ring-[#6c2bd9] dark:focus:ring-violet-600" required
              />
            </label>

            <label className="block mb-4">
              <span className="block text-sm font-medium text-slate-700 dark:text-slate-200">Email</span>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
                className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 h-11 outline-none focus:ring-2 focus:ring-[#6c2bd9] dark:focus:ring-violet-600" required
              />
            </label>

            <label className="block mb-6">
              <span className="block text-sm font-medium text-slate-700 dark:text-slate-200">Message</span>
              <textarea
                value={message} onChange={(e) => setMessage(e.target.value)} placeholder="How can we help?"
                rows={6}
                className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-3 outline-none focus:ring-2 focus:ring-[#6c2bd9] dark:focus:ring-violet-600 resize-y"
                required
              />
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{Math.max(0, message.length)} characters</div>
            </label>

            <button type="submit" disabled={submitting} className="inline-flex items-center justify-center h-11 px-6 rounded-xl bg-[#6c2bd9] text-white font-medium shadow-sm hover:brightness-95 disabled:opacity-60 transition">
              {submitting ? "Sending…" : "Send message"}
            </button>
          </form>
        </section>
      </main>

      <Modal open={modal.open} onClose={closeModal} title={modal.title} variant={modal.variant}>
        {modal.content}
      </Modal>
    </>
  );
}
