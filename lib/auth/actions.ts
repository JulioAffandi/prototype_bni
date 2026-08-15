"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * Universal logout handler across all VALO portals (Parent, School, Canteen).
 * Clears Supabase auth session, browser storage caches, and redirects to /login.
 */
export async function handleLogout(redirectTo: string = "/login") {
  try {
    const supabase = createClient();
    await supabase.auth.signOut();
  } catch (err) {
    console.error("Logout error:", err);
  } finally {
    if (typeof window !== "undefined") {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch (e) {
        console.error("Failed to clear browser storage on logout:", e);
      }
      window.location.href = redirectTo;
    }
  }
}
