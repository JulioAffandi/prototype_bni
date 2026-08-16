import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        let value = trimmed.slice(eqIdx + 1).trim();
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
}

loadEnv();

// Service client (bypasses RLS)
const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Anon client (subject to RLS)
const anonClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function testRls() {
  console.log("=========================================");
  console.log("🔍 STEP 3: RLS & SERVICE VS ANON QUERY COMPARISON");
  console.log("=========================================");

  // Service role query (All active students for DEMO_SCHOOL_ID)
  const { data: serviceStudents, error: serviceErr } = await serviceClient
    .from("students")
    .select("id, full_name, school_id, card_status, status, deleted_at")
    .eq("school_id", "09c77f03-7f77-4c26-8da4-6ad5462f860c")
    .is("deleted_at", null);

  console.log(`[SERVICE ROLE] DEMO_SCHOOL_ID Count: ${serviceStudents?.length ?? 0} | Error:`, serviceErr);

  // Service role query (ALL students across all schools)
  const { data: allServiceStudents, error: allServiceErr } = await serviceClient
    .from("students")
    .select("id, full_name, school_id, card_status, status, deleted_at")
    .is("deleted_at", null);

  console.log(`[SERVICE ROLE] ALL SCHOOLS Count: ${allServiceStudents?.length ?? 0} | Error:`, allServiceErr);

  // Anon query without auth session (Subject to RLS)
  const { data: anonStudents, error: anonErr } = await anonClient
    .from("students")
    .select("id, full_name, school_id, card_status, status, deleted_at");

  console.log(`[ANON CLIENT (NO SESSION)] Count: ${anonStudents?.length ?? 0} | Error:`, anonErr);
}

testRls();
