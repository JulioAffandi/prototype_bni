import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

let client: ReturnType<typeof createBrowserClient<Database>> | undefined;

/**
 * Browser-side Supabase client singleton.
 * Uses anon key — all access is RLS-scoped to the authenticated user's JWT.
 * Reference: PRODUCT_SPECIFICATION_v2.md §6.3, §9.1
 */
export function createClient() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";

  if (typeof window === "undefined") {
    return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
  }

  if (!client) {
    client = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
  }
  return client;
}
