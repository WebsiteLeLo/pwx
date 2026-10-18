import fs from "fs";
import path from "path";

export interface ResolvedPdf {
  _id?: string;
  baseUrl: string;
  key: string;
  name?: string;
  fullUrl: string;
  status?: string;
  type?: string;
}

const memoryCache = new Map<string, ResolvedPdf>();

// Cache file setup
const CACHE_DIR = path.resolve(import.meta.dirname, "../../data");
const CACHE_FILE = path.join(CACHE_DIR, "resolved_notes_cache.json");

// Helper to save cache to disk
function savePersistentCache() {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    const serialized: Record<string, ResolvedPdf> = {};
    for (const [k, v] of memoryCache.entries()) {
      serialized[k] = v;
    }
    fs.writeFileSync(CACHE_FILE, JSON.stringify(serialized, null, 2), "utf-8");
  } catch (err) {
    console.warn("[PdfResolver] Failed to write persistent cache:", err);
  }
}

// Helper to load cache on boot
function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const raw = fs.readFileSync(CACHE_FILE, "utf-8");
      const obj = JSON.parse(raw);
      for (const [k, v] of Object.entries(obj)) {
        memoryCache.set(k, v as ResolvedPdf);
      }
    }
  } catch (err) {
    console.warn("[PdfResolver] Failed loading persistent cache:", err);
  }

  // Also check if REATEST seed data exists in parent directory
  try {
    const seedPath = path.resolve(import.meta.dirname, "../../../../REATEST/all_notes_resolved.json");
    if (fs.existsSync(seedPath)) {
      const rawSeed = fs.readFileSync(seedPath, "utf-8");
      const seedItems = JSON.parse(rawSeed);
      for (const item of seedItems) {
        if (item.pdfData && item.pdfData.key) {
          const resObj: ResolvedPdf = {
            _id: item.pdfData._id || item.contentId,
            baseUrl: item.pdfData.baseUrl || "https://static.pw.live/",
            key: item.pdfData.key,
            name: item.pdfData.name || item.topic,
            status: item.pdfData.status || "Active",
            type: item.pdfData.type || "ADMIN",
            fullUrl: (item.pdfData.baseUrl || "https://static.pw.live/") + item.pdfData.key,
          };
          if (item.contentId) memoryCache.set(item.contentId, resObj);
          if (item.homeworkId) memoryCache.set(item.homeworkId, resObj);
        }
      }
    }
  } catch {
    // ignore
  }
}

loadCache();

const PWTHOR_TOKEN =
  process.env.PWTHOR_AUTH_TOKEN ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJtb2JpbGUiOiI3OTM0MDUwMDEwNjgiLCJuYW1lIjoiUFdUaG9yIFVzZXIgZjAwMDcxMDUiLCJyYW5kb21JZCI6ImYwMDA3MTA1LTRmZjgtNDJmOC1hZDY5LWQ1ZjNiMGJiZmEzOCIsImF1dGhUeXBlIjoiZGlyZWN0X2xvZ2luIiwiZGlyZWN0TG9naW4iOnRydWUsImlhdCI6MTc5MjMyMzc5MywiZXhwIjoxODAwMDk5NzkzfQ.GXgzTgGvm-D3uvJEjIRgFnYzS5PmM64gUebTd7Iny5I";

/**
 * Cloud-compatible Direct HTTP Resolver
 * Resolves PDF keys on Render, Railway, VPS, Docker, or localhost without requiring Chrome.
 */
async function resolveViaPwThorHttp(
  batchId: string,
  subjectId: string,
  pdfId: string,
  homeworkId?: string
): Promise<ResolvedPdf | null> {
  try {
    const url = `https://pwthor.live/api/GetPdf?BatchId=${encodeURIComponent(batchId)}&SubjectId=${encodeURIComponent(subjectId)}&PdfId=${encodeURIComponent(pdfId)}&HomeworkId=${encodeURIComponent(homeworkId || "")}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "Referer": "https://pwthor.live/",
        "Accept": "application/json, text/plain, */*",
        "Cookie": `auth_token=${PWTHOR_TOKEN}`,
      },
    });

    if (!res.ok) {
      return null;
    }

    const json = (await res.json()) as any;
    const d = json.data;
    if (d && d.key) {
      const baseUrl = d.baseUrl || "https://static.pw.live/";
      return {
        _id: d._id || homeworkId || pdfId,
        baseUrl,
        key: d.key,
        name: d.name || "Class Notes.pdf",
        status: d.status || "Active",
        type: d.type || "ADMIN",
        fullUrl: baseUrl + d.key,
      };
    }
  } catch (err) {
    console.warn("[PdfResolver] pwthor HTTP exception:", err);
  }
  return null;
}

/**
 * Resolve via Chrome CDP bridge (connects to running Chrome session on port 9222 if present)
 */
async function resolveViaCdp(
  batchId: string,
  subjectId: string,
  pdfId: string,
  homeworkId?: string
): Promise<ResolvedPdf | null> {
  try {
    const listRes = await fetch("http://127.0.0.1:9222/json", { signal: AbortSignal.timeout(1000) });
    if (!listRes.ok) return null;
    const tabs = (await listRes.json()) as any[];
    let page = tabs.find((t: any) => t.type === "page" && t.url && t.url.includes("pwthor"));

    if (!page) {
      // Auto-launch pwthor tab if missing
      try {
        const newTabRes = await fetch("http://127.0.0.1:9222/json/new?https://pwthor.live", { method: "PUT" });
        if (newTabRes.ok) {
          page = await newTabRes.json();
          await new Promise((r) => setTimeout(r, 1200));
        }
      } catch {
        // ignore
      }
    }

    if (!page || !page.webSocketDebuggerUrl) return null;

    return await new Promise<ResolvedPdf | null>((resolve) => {
      const ws = new WebSocket(page.webSocketDebuggerUrl);
      const timer = setTimeout(() => {
        try {
          ws.close();
        } catch {}
        resolve(null);
      }, 4000);

      ws.onopen = () => {
        const expr = `(async () => {
          try {
            const url = "/api/GetPdf?BatchId=" + encodeURIComponent("${batchId}") +
                        "&SubjectId=" + encodeURIComponent("${subjectId}") +
                        "&PdfId=" + encodeURIComponent("${pdfId}") +
                        "&HomeworkId=" + encodeURIComponent("${homeworkId || ""}");
            const r = await fetch(url);
            return await r.json();
          } catch (e) {
            return { error: e.message };
          }
        })()`;
        ws.send(
          JSON.stringify({
            id: 1,
            method: "Runtime.evaluate",
            params: { expression: expr, awaitPromise: true, returnByValue: true },
          })
        );
      };

      ws.onmessage = (e) => {
        clearTimeout(timer);
        try {
          const msg = JSON.parse(e.data as string);
          ws.close();
          const val = msg.result?.result?.value;
          if (val?.data?.key) {
            const d = val.data;
            const baseUrl = d.baseUrl || "https://static.pw.live/";
            resolve({
              _id: d._id || homeworkId || pdfId,
              baseUrl,
              key: d.key,
              name: d.name || "Class Notes.pdf",
              status: d.status || "Active",
              type: d.type || "ADMIN",
              fullUrl: baseUrl + d.key,
            });
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      };

      ws.onerror = () => {
        clearTimeout(timer);
        resolve(null);
      };
    });
  } catch {
    return null;
  }
}

/**
 * Resolve via schedule-details from upstream worker API
 */
async function resolveViaScheduleDetails(
  batchId: string,
  subjectId: string,
  pdfId: string,
  homeworkId?: string
): Promise<ResolvedPdf | null> {
  try {
    const url = `https://pwsecure.gourav23032009.workers.dev/api/pw/v1/batches/${encodeURIComponent(batchId)}/subject/${encodeURIComponent(subjectId)}/schedule/${encodeURIComponent(pdfId)}/schedule-details`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "client-id": "5eb393ee95fab7468a79d189",
        "client-type": "WEB",
        "client-version": "2.2.7",
      },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as any;
    const sched = json.data;
    if (!sched) return null;

    const hwList: any[] = sched.homeworkIds || (sched.dpp && sched.dpp.homeworkIds) || [];
    for (const hw of hwList) {
      if (!homeworkId || hw._id === homeworkId) {
        const atts = hw.attachmentIds || [];
        for (const att of atts) {
          if (att.key && typeof att.key === "string" && att.key.trim().length > 0) {
            const baseUrl = att.baseUrl || "https://static.pw.live/";
            return {
              _id: att._id || hw._id || pdfId,
              baseUrl,
              key: att.key,
              name: att.name || hw.topic || "Class Notes.pdf",
              status: att.status || "Active",
              type: att.type || "ADMIN",
              fullUrl: baseUrl + att.key,
            };
          }
        }
      }
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Master PDF key resolver:
 * 1. Checks memory & persistent disk cache
 * 2. Checks pwthor HTTP API (works on Render, Railway, Cloud, and localhost)
 * 3. Checks direct upstream schedule-details (for normal batches)
 * 4. Checks local Chrome CDP bridge
 */
export async function resolvePdfKey(
  batchId: string,
  subjectId: string,
  pdfId: string,
  homeworkId?: string
): Promise<ResolvedPdf | null> {
  const cacheKey = `${batchId}_${subjectId}_${pdfId}_${homeworkId || ""}`;

  // 1. Memory / persistent cache lookup
  if (memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey)!;
  }
  if (homeworkId && memoryCache.has(homeworkId)) {
    return memoryCache.get(homeworkId)!;
  }
  if (pdfId && memoryCache.has(pdfId)) {
    return memoryCache.get(pdfId)!;
  }

  // 2. Direct Cloud-Compatible HTTP Resolution (pwthor backend with auth token)
  const httpResolved = await resolveViaPwThorHttp(batchId, subjectId, pdfId, homeworkId);
  if (httpResolved && httpResolved.key) {
    memoryCache.set(cacheKey, httpResolved);
    if (pdfId) memoryCache.set(pdfId, httpResolved);
    if (homeworkId) memoryCache.set(homeworkId, httpResolved);
    savePersistentCache();
    return httpResolved;
  }

  // 3. Direct upstream schedule-details check
  const directResolved = await resolveViaScheduleDetails(batchId, subjectId, pdfId, homeworkId);
  if (directResolved && directResolved.key) {
    memoryCache.set(cacheKey, directResolved);
    if (pdfId) memoryCache.set(pdfId, directResolved);
    if (homeworkId) memoryCache.set(homeworkId, directResolved);
    savePersistentCache();
    return directResolved;
  }

  // 4. Live Chrome DevTools Protocol resolver (local fallback)
  const cdpResolved = await resolveViaCdp(batchId, subjectId, pdfId, homeworkId);
  if (cdpResolved && cdpResolved.key) {
    memoryCache.set(cacheKey, cdpResolved);
    if (pdfId) memoryCache.set(pdfId, cdpResolved);
    if (homeworkId) memoryCache.set(homeworkId, cdpResolved);
    savePersistentCache();
    return cdpResolved;
  }

  return null;
}
