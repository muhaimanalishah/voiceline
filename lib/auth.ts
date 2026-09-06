import { cookies } from "next/headers";

export const AUTH_COOKIE_NAME = "voiceline_session";

// Secret used to sign session cookies. Falls back to AUTH_PASSPHRASE if AUTH_SECRET is not provided.
function getSecret(): string {
  return (
    process.env.AUTH_SECRET ||
    process.env.AUTH_PASSPHRASE ||
    "default-voiceline-dev-secret-change-in-prod"
  );
}

// Convert ArrayBuffer to hex string
function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Generate HMAC-SHA256 signature using standard Web Crypto API (compatible with Edge and Node.js runtimes)
async function signMessage(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return bufferToHex(signature);
}

// Constant-time string equality check
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Validates a user-submitted passphrase against process.env.AUTH_PASSPHRASE
 */
export function verifyPassphrase(inputPassphrase: string): boolean {
  const configuredPassphrase = process.env.AUTH_PASSPHRASE;
  if (!configuredPassphrase) {
    console.warn("AUTH_PASSPHRASE is not configured in environment variables.");
    return false;
  }
  return timingSafeEqual(inputPassphrase.trim(), configuredPassphrase.trim());
}

/**
 * Generates a signed session token: "<timestamp>.<signature>"
 */
export async function createSessionToken(): Promise<string> {
  const secret = getSecret();
  const timestamp = Date.now().toString();
  const signature = await signMessage(timestamp, secret);
  return `${timestamp}.${signature}`;
}

/**
 * Validates that the provided session token is correctly signed and not expired.
 * Token expires after 30 days.
 */
export async function validateSessionToken(
  token: string | undefined | null
): Promise<boolean> {
  if (!token) return false;

  const parts = token.split(".");
  if (parts.length !== 2) return false;

  const [timestampStr, signature] = parts;
  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp)) return false;

  // Max age: 30 days
  const maxAgeMs = 30 * 24 * 60 * 60 * 1000;
  if (Date.now() - timestamp > maxAgeMs) {
    return false;
  }

  const secret = getSecret();
  const expectedSignature = await signMessage(timestampStr, secret);
  return timingSafeEqual(signature, expectedSignature);
}

/**
 * Checks whether the current request has an authenticated session cookie.
 */
export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(AUTH_COOKIE_NAME);
  return validateSessionToken(sessionCookie?.value);
}
