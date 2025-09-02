// pages/aboutus.js
import Head from "next/head";
import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import Navbar from "@/components/Navbar";

/* --- Theme boot: keep user's chosen theme on refresh (only change added) --- */
function useThemeBoot() {
  useEffect(() => {
    try {
      const root = document.documentElement;
      const stored = localStorage.getItem("theme"); // "dark" | "light"
      if (stored === "dark") root.classList.add("dark");
      else if (stored === "light") root.classList.remove("dark");
    } catch {}
  }, []);
}

export default function AboutUs() {
  useThemeBoot(); // <-- added

  const [user, setUser] = useState(null);

  // Keep Navbar behavior consistent with Utility/Accounts
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

  return (
    <>
      <Head>
        <title>About Us – PixelProof</title>
      </Head>

      {/* Same Navbar as Utility page */}
      <Navbar user={user} onSignOut={handleSignOut} />

      <main className="min-h-screen bg-gradient-to-b from-[#f7f8ff] to-white dark:from-slate-950 dark:to-slate-900 text-slate-800 dark:text-slate-100">
        <section className="max-w-3xl mx-auto px-6 py-20 md:py-28">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold leading-tight">
            About <span className="text-[#6c2bd9]">PixelProof</span>
          </h1>

          <p className="mt-4 sm:mt-5 text-base sm:text-lg md:text-xl text-slate-600 dark:text-slate-300">
            PixelProof helps teams automate visual QA by comparing source designs with live builds,
            highlighting layout, spacing, and color differences—so you can ship confident, consistent
            interfaces faster.
          </p>
        </section>
      </main>
    </>
  );
}
