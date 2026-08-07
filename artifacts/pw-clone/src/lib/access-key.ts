import { apiUrl } from "@/lib/apiUrl";

export function generateAndRedirect(arolinksUrl: string) {
  window.location.href = arolinksUrl; // your Arolinks shortlink, dashboard-configured
}

const ACCESS_KEY_STORAGE = "pwx_access_key";

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
}

export async function verifyAccessKey(key: string): Promise<boolean> {
  try {
    const response = await fetch(apiUrl("/access/verify"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    });
    return response.ok && Boolean((await response.json()).ok);
  } catch {
    return false;
  }
}
