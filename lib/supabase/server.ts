import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Server-side Supabase client for Next.js Server Components, Server Actions,
 * and Route Handlers. Uses the anon key with cookie-based session.
 * Access is RLS-scoped to the authenticated user's JWT.
 */
export async function createServerSupabase() {
  const store = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return store.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) { // eslint-disable-line @typescript-eslint/no-explicit-any
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              store.set(name, value, options);
            });
          } catch {
            // Route handler read-only or server component — cookie mutation is silently ignored
          }
        },
      },
    },
  );
}

// Alias for backwards compatibility
export const createServerSupabaseClient = createServerSupabase;

/**
 * Service-role Supabase client — bypasses Row Level Security.
 * ONLY used server-side in API Route handlers for financial mutations,
 * audit logging (ai_chat_logs), and rate limiting.
 * NEVER exported to client bundles. NEVER logged.
 */
let _service: ReturnType<typeof createClient<Database>> | null = null;

export function createServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for service-role operations.",
    );
  }

  if (!_service) {
    _service = createClient<Database>(url, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return _service;
}

// Alias for backwards compatibility
export const createServiceClient = createServiceSupabase;
