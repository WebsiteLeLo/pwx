import fs from "fs";
import path from "path";

import seedCacheJson from "./seedNotesCache.json";

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

// Known common subject ID to slug map
const SUBJECT_ID_TO_SLUG: Record<string, string> = {
  "69b5698ee506a608ee297ed1": "physics-by-rajwant-singh-sir-964222",
  "69b569aeeffdf9567d75f816": "physical-chemistry-by-rahul-dudi-sir-814758",
  "69b569cab32b3601588a690b": "inorganic-chemistry-by-kunwar-om-pandey-sir-618931",
  "69b569e8cd9eea58b9fe60da": "maths-by-sachin-jakhar-sir-095452",
  "69b56a34e90793e4f312def2": "inorganic-chemistry-by-amitabh-sharma-sir-612450",
  "69b57278504f6b8cced25f84": "organic-chemistry-by-ashutosh-gautam-sir-294061",
  "69b5729d45cca26612727f1a": "maths-by-amarnath-anand-sir--anna-sir--438005",
  "69b572d3c9a2b804fd67bbc5": "physical-chemistry-by-vijay-kumar-tripathi-sir--vkt-sir--164171",
  "69b572f65582e24e8c2c361e": "physics-by-varun-chauhan-sir-420204",
  "69b5746d613c5163ab7a709e": "organic-chemistry-by-pankaj-sijariya-sir-348754",
  "6a6b44faf834f38ed6f9120d": "physics-by-saleem-ahmad-sir-886822",
};

// Helper to load cache on boot
function loadCache() {
  // 1. Load bundled seed cache (bundled directly into build, always available)
  try {
    if (seedCacheJson && typeof seedCacheJson === "object") {
      for (const [k, v] of Object.entries(seedCacheJson)) {
        if (v && (v as any).key) {
          memoryCache.set(k, v as ResolvedPdf);
        }
      }
    }
  } catch (err) {
    console.warn("[PdfResolver] Failed loading bundled seed cache:", err);
  }

  // 2. Load persistent runtime disk cache if present
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

  // 3. Also check if external REATEST seed data exists in parent directory
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
  // Determine slugs to attempt (both original and mapped if ID provided)
  const candidateSubjects = [subjectId];
  if (SUBJECT_ID_TO_SLUG[subjectId] && !candidateSubjects.includes(SUBJECT_ID_TO_SLUG[subjectId])) {
    candidateSubjects.push(SUBJECT_ID_TO_SLUG[subjectId]);
  }

  for (const subj of candidateSubjects) {
    try {
      const url = `https://pwthor.live/api/GetPdf?BatchId=${encodeURIComponent(batchId)}&SubjectId=${encodeURIComponent(subj)}&PdfId=${encodeURIComponent(pdfId)}&HomeworkId=${encodeURIComponent(homeworkId || "")}`;
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
          "Referer": "https://pwthor.live/",
          "Accept": "application/json, text/plain, */*",
          "Cookie": `auth_token=${PWTHOR_TOKEN}`,
        },
        signal: AbortSignal.timeout(6000),
      });

      if (!res.ok) {
        continue;
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
  }
  return null;
}

export async function getResolverDiagnostics() {
  let pwthorPing: any = null;
  try {
    const testUrl = "https://pwthor.live/api/GetPdf?BatchId=698ad3519549b300a5e1cc6a&SubjectId=maths-by-sachin-jakhar-sir-095452&PdfId=6a940abcea1638c3a6570d6c&HomeworkId=6ad0c72e5b2a8b12b7877ee6";
    const res = await fetch(testUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": "https://pwthor.live/",
        "Cookie": `auth_token=${PWTHOR_TOKEN}`,
      },
      signal: AbortSignal.timeout(5000),
    });
    const text = await res.text();
    pwthorPing = {
      status: res.status,
      statusText: res.statusText,
      ok: res.ok,
      preview: text.slice(0, 300),
    };
  } catch (err: any) {
    pwthorPing = { error: err?.message || String(err) };
  }

  return {
    version: "2026-10-18T19:15-v3",
    cacheSize: memoryCache.size,
    hasToken: Boolean(PWTHOR_TOKEN),
    pwthorPing,
  };
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
        const targetSubj = SUBJECT_ID_TO_SLUG[subjectId] || subjectId;
        const expr = `(async () => {
          try {
            const url = "/api/GetPdf?BatchId=" + encodeURIComponent("${batchId}") +
                        "&SubjectId=" + encodeURIComponent("${targetSubj}") +
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
 * Cloudflare Pages Edge resolver (routes via pwx.pages.dev edge worker, bypassing datacenter IP bans)
 */
async function resolveViaPagesEdge(
  batchId: string,
  subjectId: string,
  pdfId: string,
  homeworkId?: string
): Promise<ResolvedPdf | null> {
  try {
    const hwParam = homeworkId ? `&HomeworkId=${encodeURIComponent(homeworkId)}` : "";
    const url = `https://pwx.pages.dev/api/GetPdf?BatchId=${encodeURIComponent(batchId)}&SubjectId=${encodeURIComponent(subjectId)}&PdfId=${encodeURIComponent(pdfId)}${hwParam}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
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
  } catch {
    // ignore
  }
  return null;
}

/**
 * Master PDF key resolver:
 * 1. Checks memory & persistent disk cache
 * 2. Checks pwthor HTTP API (works on residential IPs, VPS, or localhost)
 * 3. Checks Cloudflare Pages Edge route (bypasses datacenter Cloudflare bot block)
 * 4. Checks direct upstream schedule-details (for normal batches)
 * 5. Checks local Chrome CDP bridge
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

  // 2.5 Cloudflare Pages Edge route (bypasses datacenter Cloudflare block)
  const edgeResolved = await resolveViaPagesEdge(batchId, subjectId, pdfId, homeworkId);
  if (edgeResolved && edgeResolved.key) {
    memoryCache.set(cacheKey, edgeResolved);
    if (pdfId) memoryCache.set(pdfId, edgeResolved);
    if (homeworkId) memoryCache.set(homeworkId, edgeResolved);
    savePersistentCache();
    return edgeResolved;
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
