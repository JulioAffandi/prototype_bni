import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import * as fs from "fs";
import * as path from "path";

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

const modelsToTest = [
  "gemini-1.5-flash",
  "gemini-1.5-flash-latest",
  "gemini-2.0-flash",
  "gemini-flash-latest"
];

async function diagnose() {
  console.log("=== GEMINI MULTI-MODEL DIAGNOSTICS ===");
  
  for (const modelName of modelsToTest) {
    console.log(`\nTesting model: "${modelName}" ...`);
    try {
      const model = google(modelName);
      const { text } = await generateText({
        model,
        prompt: "Respond with exactly 'OK'",
      });
      console.log(`🟢 SUCCESS: "${modelName}" worked! Response: ${text.trim()}`);
    } catch (error: any) {
      console.log(`🔴 FAILED: "${modelName}" failed!`);
      console.log(`   Message: ${error.message}`);
      if (error.status) console.log(`   Status: ${error.status}`);
    }
  }
}

diagnose();
