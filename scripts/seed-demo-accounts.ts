import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import * as fs from "fs";
import * as path from "path";
import type { Database } from "@/types/database";

// Load environment variables from .env.local if present
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("❌ ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local");
  process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function main() {
  console.log("🌱 Starting VALO Ecosystem Schema v3 Seed Process...\n");

  // 1. Create or retrieve School
  console.log("🏫 Provisioning School: SMA BNI Harapan Bangsa...");
  const { data: existingSchool } = await supabase
    .from("schools")
    .select("id")
    .eq("npsn", "12345678")
    .maybeSingle();

  let schoolId: string;
  if (existingSchool) {
    schoolId = existingSchool.id;
    await supabase.from("schools").update({
      name: "SMA BNI Harapan Bangsa",
      bni_giro_account: "009876543210",
      status: "active",
    }).eq("id", schoolId);
  } else {
    const { data: newSchool, error: schoolErr } = await supabase
      .from("schools")
      .insert({
        name: "SMA BNI Harapan Bangsa",
        npsn: "12345678",
        bni_giro_account: "009876543210",
        status: "active",
      })
      .select("id")
      .single();
    if (schoolErr || !newSchool) {
      console.error("❌ Failed to create school:", schoolErr);
      process.exit(1);
    }
    schoolId = newSchool.id;
  }

  // 2. Create or retrieve Merchant
  console.log("🏪 Provisioning Merchant: Kantin Bu Nur (Stall #03)...");
  const { data: existingMerchant } = await supabase
    .from("merchants")
    .select("id")
    .eq("school_id", schoolId)
    .eq("name", "Kantin Bu Nur (Stall #03)")
    .maybeSingle();

  let merchantId: string;
  if (existingMerchant) {
    merchantId = existingMerchant.id;
    await supabase.from("merchants").update({
      pic_name: "Ibu Nur Hasanah",
      bni_merchant_account: "009876543211",
      status: "active",
    }).eq("id", merchantId);
  } else {
    const { data: newMerchant, error: merchantErr } = await supabase
      .from("merchants")
      .insert({
        school_id: schoolId,
        name: "Kantin Bu Nur (Stall #03)",
        pic_name: "Ibu Nur Hasanah",
        bni_merchant_account: "009876543211",
        status: "active",
      })
      .select("id")
      .single();
    if (merchantErr || !newMerchant) {
      console.error("❌ Failed to create merchant:", merchantErr);
      process.exit(1);
    }
    merchantId = newMerchant.id;
  }

  // Helper to provision user cleanly
  async function seedUser(
    email: string,
    pass: string,
    displayName: string,
    appMeta: Record<string, unknown>,
    userRolesSetup: Array<{ role: any; school_id?: string | null; merchant_id?: string | null }>,
    parentId?: string | null,
  ) {
    const { data: usersList } = await supabase.auth.admin.listUsers();
    const existing = usersList?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

    let userId: string;

    if (existing) {
      userId = existing.id;
      await supabase.auth.admin.updateUserById(userId, {
        password: pass,
        email_confirm: true,
        user_metadata: { full_name: displayName, role: userRolesSetup[0]?.role },
        app_metadata: appMeta,
      });
    } else {
      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email,
        password: pass,
        email_confirm: true,
        user_metadata: { full_name: displayName, role: userRolesSetup[0]?.role },
        app_metadata: appMeta,
      });
      if (createErr || !created.user) {
        console.error(`❌ Failed to create auth user ${email}:`, createErr);
        throw createErr;
      }
      userId = created.user.id;
    }

    // Upsert Profile
    await supabase.from("profiles").upsert({
      id: userId,
      display_name: displayName,
      parent_id: parentId || null,
      is_active: true,
    });

    // Revoke old user roles & insert new active roles
    await supabase.from("user_roles").update({ revoked_at: new Date().toISOString() }).eq("user_id", userId);

    for (const r of userRolesSetup) {
      await supabase.from("user_roles").insert({
        user_id: userId,
        role: r.role,
        school_id: r.school_id || null,
        merchant_id: r.merchant_id || null,
      });
    }

    return userId;
  }

  // 3. Seed School Admin User
  console.log("👤 Provisioning School Admin Account: admin.demo@sekolah.sch.id...");
  const schoolAdminId = await seedUser(
    "admin.demo@sekolah.sch.id",
    "Demo1234!",
    "Bambang Sudirjo, M.Pd",
    {
      roles: ["school_admin", "school_treasurer"],
      school_ids: [schoolId],
    },
    [
      { role: "school_admin", school_id: schoolId },
      { role: "school_treasurer", school_id: schoolId },
    ],
  );

  // 4. Seed Merchant Staff User
  console.log("👤 Provisioning Merchant Staff Account: kantin.demo@merchant.valo.id...");
  const merchantUserId = await seedUser(
    "kantin.demo@merchant.valo.id",
    "Demo1234!",
    "Ibu Nur Hasanah",
    {
      roles: ["merchant_staff", "merchant_owner"],
      merchant_ids: [merchantId],
    },
    [
      { role: "merchant_staff", merchant_id: merchantId },
      { role: "merchant_owner", merchant_id: merchantId },
    ],
  );

  // 5. Seed Parent Record & Parent User
  console.log("👤 Provisioning Parent Account: parent.demo@gmail.com...");
  const { data: existingParent } = await supabase
    .from("parents")
    .select("id")
    .eq("phone_number", "+6281234567890")
    .maybeSingle();

  let parentId: string;
  if (existingParent) {
    parentId = existingParent.id;
    await supabase.from("parents").update({
      full_name: "Hendra Wijaya",
      email: "parent.demo@gmail.com",
      bni_account_number: "009876543212",
      bni_link_status: "LINKED",
    }).eq("id", parentId);
  } else {
    const { data: newParent, error: parentErr } = await supabase
      .from("parents")
      .insert({
        full_name: "Hendra Wijaya",
        phone_number: "+6281234567890",
        email: "parent.demo@gmail.com",
        bni_account_number: "009876543212",
        bni_link_status: "LINKED",
      })
      .select("id")
      .single();

    if (parentErr || !newParent) {
      console.error("❌ Failed to create parent record:", parentErr);
      process.exit(1);
    }
    parentId = newParent.id;
  }

  const parentUserId = await seedUser(
    "parent.demo@gmail.com",
    "Demo1234!",
    "Hendra Wijaya",
    {
      roles: ["parent"],
      parent_id: parentId,
    },
    [{ role: "parent" }],
    parentId,
  );

  // 6. Provision Students, Cards, Vaults, Daily Counters, and Guardianship
  console.log("🎓 Provisioning Students (Kenzo Wijaya & Alya Wijaya)...");

  async function seedStudent(
    fullName: string,
    studentNum: string,
    classLabel: string,
    dailyLimit: number,
    emergencyApprove: boolean,
    emergencyLimit: number,
    cardUidRaw: string,
    cardLast4: string,
    goalName: string,
    goalTarget: number,
    initialVaultBalance: number,
  ) {
    // Student record
    const { data: existingSt } = await supabase
      .from("students")
      .select("id")
      .eq("school_id", schoolId)
      .eq("student_number", studentNum)
      .maybeSingle();

    let studentId: string;
    if (existingSt) {
      studentId = existingSt.id;
      await supabase.from("students").update({
        full_name: fullName,
        class_label: classLabel,
        daily_limit: dailyLimit,
        emergency_approve: emergencyApprove,
        emergency_limit: emergencyLimit,
        status: "active",
      }).eq("id", studentId);
    } else {
      const { data: newSt, error: stErr } = await supabase
        .from("students")
        .insert({
          school_id: schoolId,
          full_name: fullName,
          student_number: studentNum,
          class_label: classLabel,
          status: "active",
          daily_limit: dailyLimit,
          emergency_approve: emergencyApprove,
          emergency_limit: emergencyLimit,
        })
        .select("id")
        .single();
      if (stErr || !newSt) throw stErr;
      studentId = newSt.id;
    }

    // Card record (Schema v3 bytea hash)
    const uidHashHex = "\\x" + createHash("sha256").update(cardUidRaw).digest("hex");
    const { data: existingCard } = await supabase
      .from("student_cards")
      .select("id")
      .eq("student_id", studentId)
      .eq("status", "active")
      .maybeSingle();

    if (!existingCard) {
      await supabase.from("student_cards").insert({
        student_id: studentId,
        school_id: schoolId,
        uid_hash: uidHashHex,
        uid_last4: cardLast4,
        status: "active",
      });
    }

    // Vault Ledger Account
    const { data: existingLedger } = await supabase
      .from("ledger_accounts")
      .select("id")
      .eq("owner_student_id", studentId)
      .eq("account_type", "student_vault")
      .maybeSingle();

    let ledgerId: string;
    if (existingLedger) {
      ledgerId = existingLedger.id;
      await supabase.from("ledger_accounts").update({ balance: initialVaultBalance }).eq("id", ledgerId);
    } else {
      const { data: newLedger, error: lErr } = await supabase
        .from("ledger_accounts")
        .insert({
          account_type: "student_vault",
          normal_balance: "CREDIT",
          currency_code: "IDR",
          owner_student_id: studentId,
          balance: initialVaultBalance,
          is_active: true,
        })
        .select("id")
        .single();
      if (lErr || !newLedger) throw lErr;
      ledgerId = newLedger.id;
    }

    // Student Vault
    await supabase.from("student_vault").upsert({
      student_id: studentId,
      school_id: schoolId,
      ledger_account_id: ledgerId,
      savings_goal_name: goalName,
      savings_goal_target: goalTarget,
    });

    // Guardian Student Mapping
    await supabase.from("guardian_student_map").upsert({
      parent_id: parentId,
      student_id: studentId,
      school_id: schoolId,
      relationship: "ayah",
      is_primary_guardian: true,
      status: "active",
      can_view_activity: true,
      can_manage_pagu: true,
      can_fund: true,
      can_approve_vault: true,
      can_report_card_lost: true,
    });

    // Student Daily Counter (Today)
    const todayStr = new Date().toISOString().slice(0, 10);
    await supabase.from("student_daily_counters").upsert({
      student_id: studentId,
      school_id: schoolId,
      business_date: todayStr,
      limit_snapshot: dailyLimit,
      spent_amount: 5000,
      txn_count: 1,
    });

    // SPP Invoices
    const currentPeriod = new Date().toISOString().slice(0, 7);
    await supabase.from("spp_invoices").upsert({
      school_id: schoolId,
      student_id: studentId,
      billed_parent_id: parentId,
      period: currentPeriod,
      amount: 500000,
      amount_paid: 500000,
      status: "PAID",
      due_date: `${currentPeriod}-10`,
      paid_at: new Date().toISOString(),
    });

    return studentId;
  }

  const kenzoId = await seedStudent(
    "Kenzo Wijaya",
    "20261001",
    "10-A",
    25000,
    true,
    15000,
    "NFC_CARD_KENZO_A1B2",
    "A1B2",
    "Sepatu Futsal Baru",
    350000,
    150000,
  );

  const alyaId = await seedStudent(
    "Alya Wijaya",
    "20261002",
    "12-IPA-1",
    30000,
    false,
    0,
    "NFC_CARD_ALYA_C3D4",
    "C3D4",
    "Buku SBMPTN 2026",
    200000,
    85000,
  );

  console.log("\n✅ VALO Ecosystem Demo Accounts Successfully Seeded!\n");

  console.table([
    {
      Persona: "School Admin & Treasury",
      Portal: "/login/school",
      Email: "admin.demo@sekolah.sch.id",
      Password: "Demo1234!",
      "Entity Name": "SMA BNI Harapan Bangsa",
    },
    {
      Persona: "Canteen Merchant POS",
      Portal: "/login/merchant",
      Email: "kantin.demo@merchant.valo.id",
      Password: "Demo1234!",
      "Entity Name": "Kantin Bu Nur (Stall #03)",
    },
    {
      Persona: "Parent Control Hub",
      Portal: "/login/parent",
      Email: "parent.demo@gmail.com",
      Password: "Demo1234!",
      "Entity Name": "Hendra Wijaya (Kenzo & Alya)",
    },
  ]);
}

main().catch((err) => {
  console.error("❌ Fatal Seeding Error:", err);
  process.exit(1);
});
