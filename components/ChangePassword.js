// pages/ChangePassword.js   (Pages Router)
// or app/ChangePassword/page.jsx  (App Router)
"use client";

import React, { useState, useCallback } from "react";
import { changePassword, auth } from "@/lib/firebase/config";

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

/* ---------------- Component ---------------- */
const ChangePassword = () => {
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState({ curr: false, new: false, conf: false });

  // modal state
  const [modal, setModal] = useState({
    open: false,
    variant: "info", // "info" | "success" | "error"
    title: "",
    message: "",
  });
  const showModal = useCallback((variant, title, message) => {
    setModal({ open: true, variant, title, message });
  }, []);
  const closeModal = useCallback(() => setModal((m) => ({ ...m, open: false })), []);

  const errorMessageFromCode = (e) => {
    switch (e?.code) {
      case "auth/wrong-password": return "Current password is incorrect.";
      case "auth/invalid-credential": return "Reauthentication failed. Try again.";
      case "auth/too-many-requests": return "Too many attempts. Try later.";
      case "auth/weak-password": return "New password is too weak.";
      case "auth/requires-recent-login": return "Please sign in again and retry.";
      default: return e?.message || "Failed to update password.";
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!auth.currentUser) {
      showModal("error", "Not signed in", "You’re not signed in. Please sign in again.");
      return;
    }
    if (!currentPw) return showModal("error", "Missing current password", "Enter your current password.");
    if (!newPw) return showModal("error", "Missing new password", "Enter a new password.");
    if (newPw.length < 6) return showModal("error", "Weak password", "New password must be at least 6 characters.");
    if (newPw !== confirmPw) return showModal("error", "Mismatch", "New passwords do not match.");
    if (currentPw === newPw) return showModal("error", "No change", "New password must be different from current password.");

    setLoading(true);
    try {
      await changePassword(currentPw, newPw);

      // Log + success modal
      console.log("[change-password] success", { uid: auth.currentUser?.uid });
      setCurrentPw(""); setNewPw(""); setConfirmPw("");

      showModal("success", "Password updated", "Your password was updated successfully.");
    } catch (e) {
      console.error("[change-password] error", e);
      showModal("error", "Couldn’t update password", errorMessageFromCode(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* main card: no border */}
        <div className="rounded-3xl bg-white dark:bg-gray-900 shadow-sm">
          {/* Header */}
          <div className="px-6 sm:px-8 pt-6 sm:pt-8 pb-4">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Change Password</h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Enter your current password and choose a new one.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-6 sm:px-8 py-6 sm:py-8">
            {/* Current password */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Current password
              </label>
              <div className="relative">
                <input
                  type={show.curr ? "text" : "password"}
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800
                             px-4 py-3 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500
                             focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-purple-600 pr-12"
                  placeholder="Enter current password"
                  autoComplete="current-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => ({ ...s, curr: !s.curr }))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
                  aria-label="Toggle visibility"
                >
                  <svg className="h-5 w-5 text-gray-500" viewBox="0 0 24 24" fill="none">
                    <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" stroke="currentColor" strokeWidth="1.5"/>
                    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* New password */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                New password
              </label>
              <div className="relative">
                <input
                  type={show.new ? "text" : "password"}
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800
                             px-4 py-3 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500
                             focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-purple-600 pr-12"
                  placeholder="Enter new password"
                  autoComplete="new-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => ({ ...s, new: !s.new }))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
                  aria-label="Toggle visibility"
                >
                  <svg className="h-5 w-5 text-gray-500" viewBox="0 0 24 24" fill="none">
                    <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" stroke="currentColor" strokeWidth="1.5"/>
                    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Confirm new password */}
            <div className="mb-8">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Confirm new password
              </label>
              <div className="relative">
                <input
                  type={show.conf ? "text" : "password"}
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800
                             px-4 py-3 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500
                             focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-purple-600 pr-12"
                  placeholder="Re-enter new password"
                  autoComplete="new-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => ({ ...s, conf: !s.conf }))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
                  aria-label="Toggle visibility"
                >
                  <svg className="h-5 w-5 text-gray-500" viewBox="0 0 24 24" fill="none">
                    <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" stroke="currentColor" strokeWidth="1.5"/>
                    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Submit */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className={`w-full rounded-xl text-white py-3 text-sm font-medium transition ${
                  loading
                    ? "bg-purple-400 cursor-not-allowed"
                    : "bg-purple-600 hover:bg-purple-700"
                }`}
              >
                {loading ? "Updating..." : "Update password"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Custom modal */}
      <AlertModal
        open={modal.open}
        variant={modal.variant}
        title={modal.title}
        message={modal.message}
        onClose={closeModal}
      />
    </>
  );
};

export default ChangePassword;
