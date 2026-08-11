import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Service-role Supabase client — bypasses Row Level Security.
 * ONLY used server-side in API Route handlers for financial mutations
 * (pagu deduction, idempotency writes, ledger double-entry).
 * NEVER exported to client bundles. NEVER logged.
 * Reference: PRODUCT_SPECIFICATION_v2.md §6.3 (write integrity), §7.2, §9.1
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for service-role operations.",
    );
  }

  return createClient<Database>(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
