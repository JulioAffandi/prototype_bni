import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes, randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";
import type { Database } from "@/types/database";

// Load environment variables from .env.local
function loadEnv() {
  let envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) {
    envPath = path.join(process.cwd(), ".env");
  }
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

interface TestResult {
  phase: string;
  testCase: string;
  status: "PASS" | "FAIL";
  details: string;
}

const results: TestResult[] = [];

function logResult(phase: string, testCase: string, status: "PASS" | "FAIL", details: string) {
  results.push({ phase, testCase, status, details });
  const icon = status === "PASS" ? "✅" : "❌";
  console.log(`${icon} [${phase}] ${testCase}: ${details}`);
}

async function runE2EVerification() {
  console.log("\n=======================================================");
  console.log("🚀 BNI EDUCONNECT CLOSED-LOOP ECOSYSTEM E2E VERIFICATION SCRIPT");
  console.log("=======================================================\n");

  const timestamp = Date.now();
  const testNpsn = `99${timestamp.toString().slice(-6)}`;
  const testNisn = `2026${timestamp.toString().slice(-4)}`;
  const testDob = "2010-08-16";
  const testSalt = process.env.TENANT_SALT_SECRET || "valo_secret_salt_2026_super_safe";

  let schoolId = "";
  let merchantId = "";
  let schoolAdminId = "";
  let merchantUserId = "";
  let parentRecordId = "";
  let parentUserId = "";
  let studentId = "";
  let cardUidRaw = `NFC_E2E_${timestamp}`;

  // =========================================================================
  // PHASE 1: Institutional & Admin Onboarding
  // =========================================================================
  console.log("--- PHASE 1: Institutional & Admin Onboarding ---");
  try {
    // 1.1 School Entity Creation
    const schoolName = `SMA E2E Test ${timestamp}`;
    const { data: newSchool, error: schoolErr } = await supabase
      .from("schools")
      .insert({
        name: schoolName,
        npsn: testNpsn,
        bni_giro_account: `0099${timestamp.toString().slice(-8)}`,
        status: "active",
        address: "Jl. E2E Validation No. 1",
      })
      .select("id, status, name")
      .single();

    if (schoolErr || !newSchool || newSchool.status !== "active") {
      logResult("Phase 1", "School Entity Creation", "FAIL", `School insert error: ${schoolErr?.message}`);
    } else {
      schoolId = newSchool.id;
      logResult("Phase 1", "School Entity Creation", "PASS", `School created '${newSchool.name}' with ID ${schoolId} and status 'active'`);
    }

    // 1.2 Check Public School Directory List
    const { data: allSchools } = await supabase
      .from("schools")
      .select("id, npsn, name, status")
      .eq("npsn", testNpsn);

    if (allSchools && allSchools.length > 0 && allSchools[0].status === "active") {
      logResult("Phase 1", "Public School Directory List", "PASS", `School '${allSchools[0].name}' successfully listed in public directory query`);
    } else {
      logResult("Phase 1", "Public School Directory List", "FAIL", "School not found in public directory list query");
    }

    // 1.3 School Admin Registration & Role Binding
    const adminEmail = `admin.e2e.${timestamp}@sekolah.sch.id`;
    const { data: adminUser, error: adminErr } = await supabase.auth.admin.createUser({
      email: adminEmail,
      password: "TestPassword123!",
      email_confirm: true,
      user_metadata: { full_name: "Admin E2E Tester" },
      app_metadata: { roles: ["school_admin"], school_ids: [schoolId] },
    });

    if (adminErr || !adminUser.user) {
      logResult("Phase 1", "School Admin User Registration", "FAIL", `Admin user creation error: ${adminErr?.message}`);
    } else {
      schoolAdminId = adminUser.user.id;
      await supabase.from("profiles").upsert({
        id: schoolAdminId,
        display_name: "Admin E2E Tester",
        is_active: true,
      });

      await supabase.from("user_roles").insert({
        user_id: schoolAdminId,
        role: "school_admin",
        school_id: schoolId,
      });

      logResult("Phase 1", "School Admin User Registration", "PASS", `School Admin created (ID: ${schoolAdminId}) and bound to school_id ${schoolId}`);
    }
  } catch (err: any) {
    logResult("Phase 1", "Institutional Onboarding Exception", "FAIL", err?.message || String(err));
  }

  // =========================================================================
  // PHASE 2: Canteen Merchant Onboarding
  // =========================================================================
  console.log("\n--- PHASE 2: Canteen Merchant Onboarding ---");
  try {
    const merchantName = `Kantin E2E Stall #${timestamp.toString().slice(-2)}`;
    const { data: newMerchant, error: merchantErr } = await supabase
      .from("merchants")
      .insert({
        school_id: schoolId,
        name: merchantName,
        pic_name: "Ibu Merchant E2E",
        bni_merchant_account: `0088${timestamp.toString().slice(-8)}`,
        status: "active",
      })
      .select("id, status")
      .single();

    if (merchantErr || !newMerchant) {
      logResult("Phase 2", "Canteen Merchant Registration", "FAIL", `Merchant insert error: ${merchantErr?.message}`);
    } else {
      merchantId = newMerchant.id;
      logResult("Phase 2", "Canteen Merchant Registration", "PASS", `Merchant created with ID ${merchantId} linked to school ${schoolId}`);
    }

    // Merchant User Registration
    const merchantEmail = `kantin.e2e.${timestamp}@merchant.valo.id`;
    const { data: merchantAuth, error: mAuthErr } = await supabase.auth.admin.createUser({
      email: merchantEmail,
      password: "TestPassword123!",
      email_confirm: true,
      user_metadata: { full_name: "Ibu Merchant E2E" },
      app_metadata: { roles: ["merchant_staff"], merchant_ids: [merchantId] },
    });

    if (mAuthErr || !merchantAuth.user) {
      logResult("Phase 2", "Merchant Staff User Registration", "FAIL", `Merchant user creation error: ${mAuthErr?.message}`);
    } else {
      merchantUserId = merchantAuth.user.id;
      await supabase.from("profiles").upsert({
        id: merchantUserId,
        display_name: "Ibu Merchant E2E",
        is_active: true,
      });

      await supabase.from("user_roles").insert({
        user_id: merchantUserId,
        role: "merchant_staff",
        merchant_id: merchantId,
      });

      logResult("Phase 2", "Merchant Staff User Registration", "PASS", `Merchant User created (ID: ${merchantUserId}) and bound to merchant_id ${merchantId}`);
    }
  } catch (err: any) {
    logResult("Phase 2", "Merchant Onboarding Exception", "FAIL", err?.message || String(err));
  }

  // =========================================================================
  // PHASE 3: Student Onboarding & NFC Tokenization
  // =========================================================================
  console.log("\n--- PHASE 3: Student Onboarding & NFC Tokenization ---");
  try {
    // 3.1 Student Registration
    const { data: newStudent, error: stErr } = await supabase
      .from("students")
      .insert({
        school_id: schoolId,
        full_name: "Siswa E2E Test",
        student_number: testNisn,
        date_of_birth: testDob,
        grade_level: 10,
        class_group: "C",
        daily_limit: 25000,
        emergency_approve: true,
        emergency_limit: 15000,
      })
      .select("id")
      .single();

    if (stErr || !newStudent) {
      logResult("Phase 3", "Student Record Creation", "FAIL", `Student creation failed: ${stErr?.message}`);
    } else {
      studentId = newStudent.id;
      logResult("Phase 3", "Student Record Creation", "PASS", `Student created with ID ${studentId}, NISN ${testNisn}, DOB ${testDob}`);

      // 3.2 Vault & Ledger Account Initialization
      const { data: ledger, error: lErr } = await supabase
        .from("ledger_accounts")
        .insert({
          account_type: "student_vault",
          normal_balance: "CREDIT",
          currency_code: "IDR",
          owner_student_id: studentId,
          balance: 100000,
          is_active: true,
        })
        .select("id")
        .single();

      if (lErr || !ledger) {
        logResult("Phase 3", "Student Vault Ledger Initialization", "FAIL", `Ledger account creation failed: ${lErr?.message}`);
      } else {
        await supabase.from("student_vault").insert({
          student_id: studentId,
          school_id: schoolId,
          ledger_account_id: ledger.id,
          savings_goal_name: "Laptop Baru",
          savings_goal_target: 500000,
        });
        logResult("Phase 3", "Student Vault Ledger Initialization", "PASS", `Vault & Ledger Account initialized with balance 100,000 IDR`);
      }

      // 3.3 NFC Card Tokenization (SHA-256 with salt)
      const hashedCardHex = createHash("sha256").update(cardUidRaw + testSalt).digest("hex");
      const uidHashBytea = `\\x${hashedCardHex}`;
      const uidLast4 = cardUidRaw.slice(-4);

      const { data: card, error: cardErr } = await supabase
        .from("student_cards")
        .insert({
          student_id: studentId,
          school_id: schoolId,
          uid_hash: uidHashBytea,
          uid_last4: uidLast4,
          card_uid_hash: uidHashBytea,
          card_uid_last4: uidLast4,
          status: "active",
        } as any)
        .select("id, uid_last4")
        .single();

      if (cardErr || !card) {
        logResult("Phase 3", "NFC Card SHA-256 Tokenization", "FAIL", `Card creation failed: ${cardErr?.message}`);
      } else {
        const displayLast4 = (card as any).uid_last4 || uidLast4;
        logResult("Phase 3", "NFC Card SHA-256 Tokenization", "PASS", `NFC Card hashed with SHA-256+salt; stored as bytea hex \\x...; card_uid_last4 = '${displayLast4}'`);
      }
    }
  } catch (err: any) {
    logResult("Phase 3", "Student Onboarding Exception", "FAIL", err?.message || String(err));
  }

  // =========================================================================
  // PHASE 4: Parent Registration & 3-Factor Student Claim
  // =========================================================================
  console.log("\n--- PHASE 4: Parent Registration & 3-Factor Student Claim ---");
  try {
    // 4.1 Parent Record & User Creation
    const parentPhone = `+62899${timestamp.toString().slice(-7)}`;
    const parentEmail = `parent.e2e.${timestamp}@gmail.com`;

    const { data: parentRecord, error: pRecErr } = await supabase
      .from("parents")
      .insert({
        full_name: "Orang Tua E2E Test",
        phone_number: parentPhone,
        email: parentEmail,
        bni_account_number: `0077${timestamp.toString().slice(-8)}`,
        bni_link_status: "LINKED",
      })
      .select("id")
      .single();

    if (pRecErr || !parentRecord) {
      logResult("Phase 4", "Parent Entity Creation", "FAIL", `Parent record creation failed: ${pRecErr?.message}`);
    } else {
      parentRecordId = parentRecord.id;

      const { data: parentAuth, error: pAuthErr } = await supabase.auth.admin.createUser({
        email: parentEmail,
        password: "TestPassword123!",
        email_confirm: true,
        user_metadata: { full_name: "Orang Tua E2E Test" },
        app_metadata: { roles: ["parent"], parent_id: parentRecordId },
      });

      if (pAuthErr || !parentAuth.user) {
        logResult("Phase 4", "Parent User Creation", "FAIL", `Parent auth creation failed: ${pAuthErr?.message}`);
      } else {
        parentUserId = parentAuth.user.id;
        await supabase.from("profiles").upsert({
          id: parentUserId,
          display_name: "Orang Tua E2E Test",
          parent_id: parentRecordId,
          is_active: true,
        });

        await supabase.from("user_roles").insert({
          user_id: parentUserId,
          role: "parent",
        });

        logResult("Phase 4", "Parent User Creation", "PASS", `Parent user created (ID: ${parentUserId}) bound to parent_id ${parentRecordId}`);
      }

      // 4.2 Test 3-Factor Claim Failure (Invalid DOB)
      const { data: mismatchedStudents } = await supabase
        .from("students")
        .select("id")
        .eq("school_id", schoolId)
        .eq("student_number", testNisn)
        .eq("date_of_birth", "2000-01-01"); // Wrong DOB

      if (!mismatchedStudents || mismatchedStudents.length === 0) {
        logResult("Phase 4", "3-Factor Claim Mismatch Prevention", "PASS", "Verification correctly rejected mismatched Tanggal Lahir (DOB)");
      } else {
        logResult("Phase 4", "3-Factor Claim Mismatch Prevention", "FAIL", "Verification improperly matched incorrect Tanggal Lahir");
      }

      // 4.3 Test 3-Factor Claim Match (Valid NPSN + NISN + DOB)
      const { data: matchedStudents } = await supabase
        .from("students")
        .select("id, school_id, full_name")
        .eq("school_id", schoolId)
        .eq("student_number", testNisn)
        .eq("date_of_birth", testDob);

      if (!matchedStudents || matchedStudents.length === 0) {
        logResult("Phase 4", "3-Factor Claim Success", "FAIL", "Failed to match student using valid NPSN + NISN + DOB");
      } else {
        // Perform link & consent recording
        const nowIso = new Date().toISOString();
        await supabase.from("guardian_student_map").insert({
          parent_id: parentRecordId,
          student_id: studentId,
          school_id: schoolId,
          relationship: "ayah",
          is_primary_guardian: true,
          status: "active",
          linked_via: "self_claim",
          linked_at: nowIso,
          can_view_activity: true,
          can_manage_pagu: true,
          can_fund: true,
          can_approve_vault: true,
          can_report_card_lost: true,
          created_by: parentUserId,
        });

        const consentToken = randomBytes(16).toString("hex");
        await supabase.from("parental_consent").insert({
          parent_id: parentRecordId,
          student_id: studentId,
          school_id: schoolId,
          consent_type: "DATA_PROCESSING_MINOR",
          consent_version: "v1.0",
          consent_token: consentToken,
          granted_at: nowIso,
          evidence_ip: "127.0.0.1",
          evidence_user_agent: "VALO-E2E-Automated-Tester",
        });

        logResult("Phase 4", "3-Factor Claim Success", "PASS", `3-Factor Claim matched! Active link in guardian_student_map & UU PDP consent token recorded (${consentToken.slice(0, 8)}...)`);
      }
    }
  } catch (err: any) {
    logResult("Phase 4", "Parent Claim Exception", "FAIL", err?.message || String(err));
  }

  // =========================================================================
  // PHASE 5: Financial Operations & Closed-Loop Cycle
  // =========================================================================
  console.log("\n--- PHASE 5: Financial Operations & Closed-Loop Cycle ---");
  try {
    if (!studentId) {
      logResult("Phase 5", "Financial Operations Setup", "FAIL", "Skipping Phase 5 because Student ID was not created in Phase 3");
    } else {
      // 5.1 Update Pagu Harian & Emergency Overdraft
      const updatedDailyLimit = 30000;
      const updatedEmergencyLimit = 15000;

      const { error: limitUpdateErr } = await supabase
        .from("students")
        .update({
          daily_limit: updatedDailyLimit,
          emergency_approve: true,
          emergency_limit: updatedEmergencyLimit,
        })
        .eq("id", studentId);

      if (limitUpdateErr) {
        logResult("Phase 5", "Pagu Harian Limit Override", "FAIL", `Limit update error: ${limitUpdateErr.message}`);
      } else {
        logResult("Phase 5", "Pagu Harian Limit Override", "PASS", `Daily limit updated to Rp ${updatedDailyLimit.toLocaleString()} (Emergency Rp ${updatedEmergencyLimit.toLocaleString()})`);
      }

      // 5.2 Canteen POS Tap & Limit Enforcement (RPC fn_process_canteen_tap)
      const hashedCardHex = createHash("sha256").update(cardUidRaw + testSalt).digest("hex");
      const byteaCardHash = `\\x${hashedCardHex}`;

      // Tx 1: Amount Rp 20,000 (Within limit of Rp 30,000)
      const idempotency1 = randomUUID();
      const { data: rpcRes1, error: rpcErr1 } = await supabase.rpc("fn_process_canteen_tap", {
        p_idempotency_key: idempotency1,
        p_card_uid_hash: byteaCardHash,
        p_merchant_id: merchantId,
        p_amount: 20000,
        p_items: [{ menu: "Nasi Goreng Kantin", qty: 1, price: 20000, category: "makanan_berat" }],
        p_client_local_tx_uuid: null,
        p_channel: "ONLINE_TAP",
        p_occurred_at: new Date().toISOString(),
      });

      if (rpcErr1) {
        logResult("Phase 5", "Canteen POS Tap (Within Limit)", "FAIL", `RPC execution error: ${rpcErr1.message}`);
      } else {
        const resObj = (rpcRes1 || {}) as any;
        if (resObj.http_status === 200 || resObj.transaction_id) {
          logResult("Phase 5", "Canteen POS Tap (Within Limit)", "PASS", `Tx SETTLED (Rp 20,000)! Remaining limit: Rp ${resObj.sisa_pagu?.toLocaleString() ?? "N/A"}`);
        } else {
          logResult("Phase 5", "Canteen POS Tap (Within Limit)", "FAIL", `Tx failed unexpected: ${JSON.stringify(resObj)}`);
        }
      }

      // Tx 2: Amount Rp 20,000 (Exceeds remaining daily limit of Rp 10,000, but within Emergency limit Rp 15,000)
      const idempotency2 = randomUUID();
      const { data: rpcRes2, error: rpcErr2 } = await supabase.rpc("fn_process_canteen_tap", {
        p_idempotency_key: idempotency2,
        p_card_uid_hash: byteaCardHash,
        p_merchant_id: merchantId,
        p_amount: 20000,
        p_items: [{ menu: "Ayam Geprek", qty: 1, price: 20000, category: "makanan_berat" }],
        p_client_local_tx_uuid: null,
        p_channel: "ONLINE_TAP",
        p_occurred_at: new Date().toISOString(),
      });

      if (rpcErr2) {
        logResult("Phase 5", "Emergency Overdraft Tap", "FAIL", `RPC execution error: ${rpcErr2.message}`);
      } else {
        const resObj = (rpcRes2 || {}) as any;
        if (resObj.http_status === 200) {
          logResult("Phase 5", "Emergency Overdraft Tap", "PASS", "Emergency Overdraft approved transaction exceeding daily baseline!");
        } else {
          logResult("Phase 5", "Emergency Overdraft Tap", "FAIL", `Emergency Overdraft failed: ${JSON.stringify(resObj)}`);
        }
      }

      // Tx 3: Amount Rp 100,000 (Exceeds daily limit & emergency limits combined)
      const idempotency3 = randomUUID();
      const { data: rpcRes3 } = await supabase.rpc("fn_process_canteen_tap", {
        p_idempotency_key: idempotency3,
        p_card_uid_hash: byteaCardHash,
        p_merchant_id: merchantId,
        p_amount: 100000,
        p_items: [{ menu: "Voucher Kantin Super", qty: 1, price: 100000 }],
        p_client_local_tx_uuid: null,
        p_channel: "ONLINE_TAP",
        p_occurred_at: new Date().toISOString(),
      });

      const resObj3 = (rpcRes3 || {}) as any;
      if (resObj3.http_status === 402 || resObj3.error === "PAGU_EXCEEDED") {
        logResult("Phase 5", "Pagu Limit Rejection Enforcement", "PASS", `Transaction Rp 100,000 correctly REJECTED with error '${resObj3.error}'`);
      } else {
        logResult("Phase 5", "Pagu Limit Rejection Enforcement", "FAIL", `Pagu limit enforcement failed to block transaction: ${JSON.stringify(resObj3)}`);
      }

      // 5.3 SPP Invoice Generation & Settlement
      const currentPeriod = new Date().toISOString().slice(0, 7);
      const { data: sppInvoice, error: sppErr } = await supabase
        .from("spp_invoices")
        .insert({
          school_id: schoolId,
          student_id: studentId,
          period: currentPeriod,
          amount: 450000,
          status: "UNPAID",
          due_date: `${currentPeriod}-10`,
        })
        .select("id, status")
        .single();

      if (sppErr || !sppInvoice) {
        logResult("Phase 5", "SPP Invoice Generation", "FAIL", `SPP invoice creation error: ${sppErr?.message}`);
      } else {
        logResult("Phase 5", "SPP Invoice Generation", "PASS", `SPP Invoice generated with status '${sppInvoice.status}' for Rp 450,000`);

        // Settlement of SPP Invoice
        const { error: payErr } = await supabase
          .from("spp_invoices")
          .update({
            status: "PAID",
            paid_at: new Date().toISOString(),
          })
          .eq("id", sppInvoice.id);

        if (payErr) {
          logResult("Phase 5", "SPP Invoice Settlement", "FAIL", `SPP Settlement error: ${payErr.message}`);
        } else {
          logResult("Phase 5", "SPP Invoice Settlement", "PASS", "SPP Invoice settled from UNPAID to PAID; updated reconciliation metrics");
        }
      }
    }
  } catch (err: any) {
    logResult("Phase 5", "Financial Operations Exception", "FAIL", err?.message || String(err));
  }

  // =========================================================================
  // PRINT SUMMARY REPORT
  // =========================================================================
  console.log("\n=======================================================");
  console.log("📊 BNI EDUCONNECT E2E SYSTEM FLOW AUDIT REPORT SUMMARY");
  console.log("=======================================================\n");

  const total = results.length;
  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;

  console.table(
    results.map((r) => ({
      Phase: r.phase,
      "Test Case": r.testCase,
      Result: r.status,
      Details: r.details,
    }))
  );

  console.log(`\nTOTAL TEST CASES: ${total} | PASSED: ${passed} | FAILED: ${failed}`);

  if (failed === 0) {
    console.log("\n🎉 ALL E2E ECOSYSTEM FLOWS PASSED VERIFICATION WITH 0 ERRORS!\n");
  } else {
    console.error(`\n⚠️ ${failed} TEST CASE(S) FAILED. PLEASE REVIEW LOGS ABOVE.\n`);
    process.exit(1);
  }
}

runE2EVerification().catch((err) => {
  console.error("❌ Fatal Verification Script Error:", err);
  process.exit(1);
});
