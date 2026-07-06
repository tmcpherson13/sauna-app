const SECRET = process.env.SESSION_SECRET || process.env.APP_PASSWORD || "dev-secret";
export const SESSION_COOKIE = "sauna_session";

function toBase64Url(bytes: ArrayBuffer | Uint8Array) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const bin = String.fromCharCode(...arr);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return toBase64Url(sig);
}

export async function makeSessionToken(): Promise<string> {
  const payload = `valid:${Date.now()}`;
  const sig = await hmac(payload);
  return toBase64Url(new TextEncoder().encode(`${payload}:${sig}`));
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    const decoded = atob(token.replace(/-/g, "+").replace(/_/g, "/"));
    const lastColon = decoded.lastIndexOf(":");
    const payload = decoded.slice(0, lastColon);
    const sig = decoded.slice(lastColon + 1);
    const expected = await hmac(payload);
    return sig === expected;
  } catch {
    return false;
  }
}
