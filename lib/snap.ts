// =============================================================
// SNAP BI Signature Utilities
// Reference: PRODUCT_SPECIFICATION_v2.md §9.1, §11.3
// Implements SNAP BI (Standar Nasional Open API Pembayaran)
// asymmetric RSA-SHA256 + HMAC-SHA512 symmetric signatures
// =============================================================

import { createHash, createHmac, createSign, createVerify } from "crypto";

/**
 * Build the canonical string for SNAP BI symmetric (HMAC-SHA512) signature.
 * Format: HTTPMethod + ":" + RelativePath + ":" + AccessToken + ":" +
 *         SHA-256(minified body) + ":" + Timestamp
 */
export function buildSymmetricStringToSign({
  method,
  relativePath,
  accessToken,
  body,
  timestamp,
}: {
  method: string;
  relativePath: string;
  accessToken: string;
  body: string;
  timestamp: string;
}): string {
  const bodyHash = createHash("sha256")
    .update(body.length === 0 ? "" : JSON.stringify(JSON.parse(body)))
    .digest("hex")
    .toLowerCase();

  return `${method.toUpperCase()}:${relativePath}:${accessToken}:${bodyHash}:${timestamp}`;
}

/**
 * Generate HMAC-SHA512 signature for SNAP BI service calls (outbound to BNI).
 * Reference: §9.1 — "symmetric HMAC untuk service call"
 */
export function generateHmacSignature({
  stringToSign,
  clientSecret,
}: {
  stringToSign: string;
  clientSecret: string;
}): string {
  return createHmac("sha512", clientSecret)
    .update(stringToSign)
    .digest("base64");
}

/**
 * Verify inbound HMAC-SHA512 signature from BNI webhook.
 * Reference: §9.1 — "API Key + HMAC Signature (X-SIGNATURE, X-TIMESTAMP, X-CLIENT-KEY)"
 */
export function verifyInboundHmac({
  receivedSignature,
  stringToSign,
  clientSecret,
}: {
  receivedSignature: string;
  stringToSign: string;
  clientSecret: string;
}): boolean {
  const expected = generateHmacSignature({ stringToSign, clientSecret });
  // Constant-time comparison to prevent timing attacks
  if (expected.length !== receivedSignature.length) return false;
  let result = 0;
  for (let i = 0; i < expected.length; i++) {
    result |= expected.charCodeAt(i) ^ receivedSignature.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Build asymmetric string-to-sign for SNAP BI access token request.
 * Format: ClientKey + "|" + Timestamp
 */
export function buildAsymmetricStringToSign({
  clientKey,
  timestamp,
}: {
  clientKey: string;
  timestamp: string;
}): string {
  return `${clientKey}|${timestamp}`;
}

/**
 * Generate RSA-SHA256 signature for SNAP BI access token requests (outbound).
 * Reference: §9.1 — "Asymmetric Signature (RSA-SHA256)"
 * privateKeyPem: RSA private key in PEM format (from env BNI_H2H_PRIVATE_KEY_PEM)
 */
export function generateRsaSignature({
  stringToSign,
  privateKeyPem,
}: {
  stringToSign: string;
  privateKeyPem: string;
}): string {
  const signer = createSign("RSA-SHA256");
  signer.update(stringToSign);
  return signer.sign(privateKeyPem, "base64");
}

/**
 * Verify RSA-SHA256 signature (optional — for BNI public key verification).
 */
export function verifyRsaSignature({
  stringToSign,
  signature,
  publicKeyPem,
}: {
  stringToSign: string;
  signature: string;
  publicKeyPem: string;
}): boolean {
  try {
    const verifier = createVerify("RSA-SHA256");
    verifier.update(stringToSign);
    return verifier.verify(publicKeyPem, signature, "base64");
  } catch {
    return false;
  }
}

/**
 * Validate X-TIMESTAMP drift tolerance (±5 minutes).
 * Reference: §9.1 — "cek X-TIMESTAMP toleransi ±5 menit utk cegah replay"
 */
export function isTimestampValid(timestamp: string): boolean {
  try {
    const ts = new Date(timestamp).getTime();
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    return Math.abs(now - ts) <= fiveMinutes;
  } catch {
    return false;
  }
}

/**
 * Generate ISO-8601 timestamp for SNAP BI headers.
 */
export function getSnapTimestamp(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "+07:00");
}

/**
 * Full SNAP BI inbound webhook verification.
 * Returns { valid: boolean; reason?: string }
 */
export function verifySnapWebhook({
  headers,
  body,
  relativePath,
}: {
  headers: {
    "x-signature": string | null;
    "x-timestamp": string | null;
    "x-client-key": string | null;
  };
  body: string;
  relativePath: string;
}): { valid: boolean; reason?: string } {
  const { "x-signature": sig, "x-timestamp": ts, "x-client-key": clientKey } = headers;

  if (!sig || !ts || !clientKey) {
    return { valid: false, reason: "Missing SNAP BI headers" };
  }

  if (!isTimestampValid(ts)) {
    return { valid: false, reason: "X-TIMESTAMP out of tolerance (replay attack prevention)" };
  }

  if (clientKey !== process.env.BNI_H2H_CLIENT_KEY) {
    return { valid: false, reason: "X-CLIENT-KEY mismatch" };
  }

  const stringToSign = buildSymmetricStringToSign({
    method: "POST",
    relativePath,
    accessToken: "",
    body,
    timestamp: ts,
  });

  const valid = verifyInboundHmac({
    receivedSignature: sig,
    stringToSign,
    clientSecret: process.env.BNI_H2H_CLIENT_SECRET!,
  });

  return valid ? { valid: true } : { valid: false, reason: "HMAC signature mismatch" };
}
