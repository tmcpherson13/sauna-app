import crypto from "crypto";

const BASE_URL = process.env.TUYA_BASE_URL || "https://openapi.tuyaus.com";
const CLIENT_ID = process.env.TUYA_ACCESS_ID!;
const SECRET = process.env.TUYA_ACCESS_SECRET!;

let cachedToken: { value: string; expiresAt: number } | null = null;

function sha256Hex(input: string) {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

function hmacSha256(input: string, key: string) {
  return crypto
    .createHmac("sha256", key)
    .update(input, "utf8")
    .digest("hex")
    .toUpperCase();
}

function buildSign(opts: {
  method: string;
  path: string;
  body?: string;
  accessToken?: string;
  t: number;
}) {
  const { method, path, body = "", accessToken = "", t } = opts;
  const contentHash = sha256Hex(body);
  const stringToSign = [method, contentHash, "", path].join("\n");
  const signStr = CLIENT_ID + accessToken + t + stringToSign;
  return hmacSha256(signStr, SECRET);
}

async function getToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 5000) {
    return cachedToken.value;
  }
  const t = Date.now();
  const path = "/v1.0/token?grant_type=1";
  const sign = buildSign({ method: "GET", path, t });

  const res = await fetch(BASE_URL + path, {
    method: "GET",
    headers: {
      client_id: CLIENT_ID,
      sign,
      t: String(t),
      sign_method: "HMAC-SHA256",
    },
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(`Tuya token error: ${data.msg || JSON.stringify(data)}`);
  }
  cachedToken = {
    value: data.result.access_token,
    expiresAt: Date.now() + data.result.expire_time * 1000,
  };
  return cachedToken.value;
}

export async function tuyaRequest(
  method: "GET" | "POST",
  path: string,
  body?: Record<string, unknown>
) {
  const accessToken = await getToken();
  const t = Date.now();
  const bodyStr = body ? JSON.stringify(body) : "";
  const sign = buildSign({ method, path, body: bodyStr, accessToken, t });

  const res = await fetch(BASE_URL + path, {
    method,
    headers: {
      client_id: CLIENT_ID,
      access_token: accessToken,
      sign,
      t: String(t),
      sign_method: "HMAC-SHA256",
      "Content-Type": "application/json",
    },
    body: bodyStr || undefined,
  });

  const data = await res.json();
  if (!data.success) {
    throw new Error(`Tuya API error: ${data.msg || JSON.stringify(data)}`);
  }
  return data.result;
}

export async function getDeviceStatus(deviceId: string) {
  const result = await tuyaRequest("GET", `/v1.0/devices/${deviceId}/status`);
  const status: Record<string, unknown> = {};
  for (const item of result as { code: string; value: unknown }[]) {
    status[item.code] = item.value;
  }
  return status;
}

export async function sendCommand(
  deviceId: string,
  commands: { code: string; value: unknown }[]
) {
  return tuyaRequest("POST", `/v1.0/devices/${deviceId}/commands`, {
    commands,
  });
}
