// pages/contactus.js
import Head from "next/head";
import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/config";
import Navbar from "@/components/Navbar";

/* ---------------- Theme boot: keep user's theme on refresh ---------------- */
function useThemeBoot() {
  useEffect(() => {
    try {
      const root = document.documentElement;
      const stored = localStorage.getItem("theme"); // expected: "dark" | "light"
      if (stored === "dark") root.classList.add("dark");
      else if (stored === "light") root.classList.remove("dark");
      // If nothing stored, leave Tailwind’s system-default behavior
    } catch {}
  }, []);
}

/* ---------------- Modal (animated, close icon, backdrop/Esc to close) ---------------- */
function Modal({ open, onClose, title, children, variant = "info" }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (open) {
      setShow(true);
    } else {
      // small delay to let close animation play
      const t = setTimeout(() => setShow(false), 120);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose?.();
    }
    if (open) {
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }
  }, [open, onClose]);

  if (!open && !show) return null;

  const ringColor =
    variant === "error" ? "ring-red-500/20 border-red-200 dark:border-red-800"
    : variant === "success" ? "ring-green-600/20 border-green-200 dark:border-green-800"
    : "ring-blue-600/20 border-gray-200 dark:border-gray-800";

  return (
    <div
      aria-modal="true"
      role="dialog"
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      {/* backdrop */}
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity ${open ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />
      {/* card */}
      <div
        className={`relative z-10 w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 border shadow-xl p-6 ring-1 ${ringColor}
                    transition-all duration-150 ${open ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}
      >
        {/* Close icon */}
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

        {title ? (
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 pr-8">{title}</h2>
        ) : null}
        <div className="mt-2 text-sm text-gray-700 dark:text-gray-200">{children}</div>

        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ContactUs() {
  useThemeBoot();

  const [user, setUser] = useState(null);

  // form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // modal state
  const [modal, setModal] = useState({
    open: false,
    title: "",
    content: "",
    variant: "info",
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u || null));
    return () => unsub();
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error("Sign out failed:", e);
    }
  };

  const validate = () => {
    if (!name.trim()) {
      setModal({
        open: true,
        title: "Missing name",
        content: "Please enter your name.",
        variant: "error",
      });
      return false;
    }
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email)) {
      setModal({
        open: true,
        title: "Invalid email",
        content: "Please enter a valid email address.",
        variant: "error",
      });
      return false;
    }
    if (!message.trim() || message.trim().length < 10) {
      setModal({
        open: true,
        title: "Message too short",
        content: "Message must be at least 10 characters.",
        variant: "error",
      });
      return false;
    }
    return true;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      // Ensure Firestore instance exists
      if (!db) throw new Error("Database not initialized. Please refresh and try again.");

      await addDoc(collection(db, "contactMessages"), {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        message: message.trim(),
        uid: user?.uid || null,
        createdAt: serverTimestamp(),
        status: "new",
      });

      setName("");
      setEmail("");
      setMessage("");

      setModal({
        open: true,
        title: "Message sent",
        content: "Thanks! Your message has been sent. We’ll get back to you soon.",
        variant: "success",
      });
    } catch (err) {
      console.error("[contactus] send failed:", err);
      const msg =
        err?.code === "permission-denied"
          ? "We couldn’t save your message due to permissions. Please sign in and try again."
          : err?.message || "Could not send message. Please try again.";
      setModal({
        open: true,
        title: "Couldn’t send message",
        content: msg,
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Head>
        <title>Contact Us – PixelProof</title>
      </Head>

      {/* Same Navbar as Utility page */}
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

          <form
            onSubmit={onSubmit}
            className="rounded-2xl p-6 sm:p-8 bg-white dark:bg-slate-800 ring-1 ring-black/5 dark:ring-white/10 shadow-sm"
          >
            {/* Name */}
            <label className="block mb-4">
              <span className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                Name
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 h-11 outline-none focus:ring-2 focus:ring-[#6c2bd9] dark:focus:ring-violet-600"
                required
              />
            </label>

            {/* Email */}
            <label className="block mb-4">
              <span className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                Email
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 h-11 outline-none focus:ring-2 focus:ring-[#6c2bd9] dark:focus:ring-violet-600"
                required
              />
            </label>

            {/* Message */}
            <label className="block mb-6">
              <span className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                Message
              </span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="How can we help?"
                rows={6}
                className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-3 outline-none focus:ring-2 focus:ring-[#6c2bd9] dark:focus:ring-violet-600 resize-y"
                required
              />
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {Math.max(0, message.length)} characters
              </div>
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center h-11 px-6 rounded-xl bg-[#6c2bd9] text-white font-medium shadow-sm hover:brightness-95 disabled:opacity-60 transition"
            >
              {submitting ? "Sending…" : "Send message"}
            </button>
          </form>
        </section>
      </main>

      {/* Custom Modal */}
      <Modal
        open={modal.open}
        onClose={() => setModal((m) => ({ ...m, open: false }))}
        title={modal.title}
        variant={modal.variant}
      >
        {modal.content}
      </Modal>
    </>
  );
}
