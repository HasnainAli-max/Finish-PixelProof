// pages/reset.js
"use client";

import React from "react";
import Head from "next/head";
import { getAuth, sendPasswordResetEmail } from "firebase/auth";
import { firebaseApp } from "@/lib/firebase/config";
import Link from "next/link";

const auth = getAuth(firebaseApp);

/* ---------- Modal (styled like your 2nd snippet) ---------- */
function Modal({ open, title, message, onClose, variant = "success" }) {
  if (!open) return null;
  const okStyles = "bg-blue-600 hover:bg-blue-700 text-white";
  const ringColor = variant === "error" ? "ring-red-500" : "ring-blue-600";

  return (
    <div
      aria-modal="true"
      role="dialog"
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      {/* card */}
      <div
        className={`relative z-10 w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xl p-6 ring-1 ${ringColor}/20`}
      >
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {title}
        </h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {message}
        </p>
        <div className="mt-5 flex justify-end">
          <button onClick={onClose} className={`px-4 py-2 rounded-md ${okStyles}`}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Page ---------- */
export default function ResetPage() {
  const [loading, setLoading] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [modal, setModal] = React.useState({
    open: false,
    title: "",
    message: "",
    variant: "success",
  });

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      // ✅ functionality same as your working version:
      // use Firebase hosted page and redirect back to /login after password update
      const actionCodeSettings = {
        url: `${window.location.origin}/login`,
        handleCodeInApp: false,
      };

      await sendPasswordResetEmail(auth, email, actionCodeSettings);
      setModal({
        open: true,
        title: "Reset link sent",
        message:
          "We sent a password reset link to your email. After you set a new password, you'll be redirected back to the app automatically.",
        variant: "success",
      });
      setEmail("");
    } catch (err) {
      setModal({
        open: true,
        title: "Couldn’t send email",
        message: err?.message || "Please try again.",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>Reset your password</title>
      </Head>

      {/* Uniform background (no gradient), theme-aware */}
      <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
        <form
          onSubmit={onSubmit}
          className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow p-6"
        >
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Reset your password
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Enter your account email and we&apos;ll send you a reset link.
          </p>

          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="you@example.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full mb-4 border border-gray-300 dark:border-gray-700 rounded-md px-4 py-2
                       bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100
                       placeholder-gray-400 dark:placeholder-gray-500
                       focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md text-white py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? "Sending..." : "Send reset email"}
          </button>

          <div className="mt-4 text-sm text-gray-600 dark:text-gray-400 text-center">
            Remembered your password?{" "}
            <Link href="/login" className="text-blue-600 hover:underline">
              Back to sign in
            </Link>
          </div>
        </form>
      </div>

      <Modal
        open={modal.open}
        title={modal.title}
        message={modal.message}
        variant={modal.variant}
        onClose={() => setModal((m) => ({ ...m, open: false }))}
      />
    </>
  );
}
