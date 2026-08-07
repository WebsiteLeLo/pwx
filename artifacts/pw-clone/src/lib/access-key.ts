import { apiUrl } from "@/lib/apiUrl";

export function generateAndRedirect(arolinksUrl: string) {
  window.location.href = arolinksUrl; // your Arolinks shortlink, dashboard-configured
}

const ACCESS_KEY_STORAGE = "pwx_access_key";
const CLAIM_TOKEN_STORAGE = "pwx_access_claim_token";
const PENDING_GENERATION_STORAGE = "pwx_pending_generation";

export function getStoredAccessKey() {
  try {
    return localStorage.getItem(ACCESS_KEY_STORAGE) ?? "";
  } catch {
    return "";
  }
}

export function storeAccessKey(key: string) {
  localStorage.setItem(ACCESS_KEY_STORAGE, key.trim());
}

export function clearStoredAccessKey() {
  localStorage.removeItem(ACCESS_KEY_STORAGE);
  localStorage.removeItem(CLAIM_TOKEN_STORAGE);
}

export function storePendingGeneration(token: string) {
  localStorage.setItem(PENDING_GENERATION_STORAGE, token);
}

export function getPendingGeneration() {
  try {
    return localStorage.getItem(PENDING_GENERATION_STORAGE) ?? "";
  } catch {
    return "";
  }
}

export function clearPendingGeneration() {
  localStorage.removeItem(PENDING_GENERATION_STORAGE);
}

export async function prepareAccessGeneration(): Promise<string> {
  const response = await fetch(apiUrl("/access/prepare"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok || typeof result.token !== "string") {
    throw new Error(result.error || "Unable to start key generation");
  }
  return result.token;
}

export async function claimAccessGeneration(token: string): Promise<string> {
  const response = await fetch(apiUrl("/access/claim"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok || typeof result.key !== "string") {
    throw new Error(result.error || "Unable to generate access key");
  }
  return result.key;
}

export async function verifyAccessKey(key: string): Promise<boolean> {
  try {
    const claimToken = localStorage.getItem(CLAIM_TOKEN_STORAGE) ?? "";
    const response = await fetch(apiUrl("/access/verify"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, claimToken }),
    });
    const result = await response.json();
    if (response.ok && result.ok && result.claimToken) {
      localStorage.setItem(CLAIM_TOKEN_STORAGE, result.claimToken);
    }
    return response.ok && Boolean(result.ok);
  } catch {
    return false;
  }
}
