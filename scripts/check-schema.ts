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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  const { data: users } = await supabase.auth.admin.listUsers();
  console.log("=== ALL AUTH USERS ===");
  users?.users?.forEach(u => console.log("User:", u.id, u.email, u.phone));

  const { data: parents } = await supabase.from("parents").select("*");
  console.log("=== ALL PARENTS ===");
  console.log(parents);

  const { data: mappings } = await supabase.from("guardian_student_map").select("*");
  console.log("=== ALL GUARDIAN MAPPINGS ===");
  console.log(mappings);
}

check();
