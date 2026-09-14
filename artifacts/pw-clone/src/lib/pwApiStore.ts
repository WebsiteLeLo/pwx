import { apiUrl } from "@/lib/apiUrl";

export let PW_API = "https://proxy.streamvideo.co.in/fetch/api.penpencil.co";

export async function initializePwApi() {
  try {
    const res = await fetch(apiUrl("/api/settings/pw_api_url"));
    if (res.ok) {
      const data = await res.json();
      if (data?.value) {
        PW_API = data.value;
      }
    }
  } catch (e) {
    console.error("Failed to fetch dynamic PW API URL", e);
  }
}
