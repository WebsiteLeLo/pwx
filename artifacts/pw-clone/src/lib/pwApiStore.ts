import { apiUrl } from "@/lib/apiUrl";
import { refreshVideoProxyUrl } from "@/lib/videoProxyStore";

const DEFAULT_PW_API = "https://pwsecure.gourav23032009.workers.dev/api/pw";
const PW_API_STORAGE_KEY = "pwx_pw_api_url";

function getInitialPwApi(): string {
  try {
    const cached = typeof localStorage !== "undefined" ? localStorage.getItem(PW_API_STORAGE_KEY) : null;
    if (cached && /^https?:\/\//i.test(cached)) return cached;
  } catch {}
  return DEFAULT_PW_API;
}

export let PW_API = getInitialPwApi();

export async function initializePwApi() {
  const loadPwApi = async () => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(apiUrl("/api/settings/pw_api_url"), {
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        if (typeof data?.value === "string" && /^https?:\/\//i.test(data.value)) {
          PW_API = data.value;
          try {
            localStorage.setItem(PW_API_STORAGE_KEY, data.value);
          } catch {}
        }
      }
    } catch (e) {
      // Keep default/cached PW_API on timeout or network error
    }
  };

  await Promise.all([loadPwApi(), refreshVideoProxyUrl(true)]);
}
