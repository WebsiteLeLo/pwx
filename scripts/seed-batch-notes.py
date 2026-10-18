import urllib.request, json, time, os, sys

"""
Script: seed-batch-notes.py
Usage: python3 scripts/seed-batch-notes.py [batchId1] [batchId2] ...
Default: Arjuna JEE 2027 (698ad3519549b300a5e1cc6a)
Description:
  Fetches all subjects, chapters, and lectures from PW, discovers attachment keys
  via pwthor API (using residential IP to bypass Cloudflare), and updates
  artifacts/api-server/src/lib/seedNotesCache.json.
"""

PWTHOR_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJtb2JpbGUiOiI3OTM0MDUwMDEwNjgiLCJuYW1lIjoiUFdUaG9yIFVzZXIgZjAwMDcxMDUiLCJyYW5kb21JZCI6ImYwMDA3MTA1LTRmZjgtNDJmOC1hZDY5LWQ1ZjNiMGJiZmEzOCIsImF1dGhUeXBlIjoiZGlyZWN0X2xvZ2luIiwiZGlyZWN0TG9naW4iOnRydWUsImlhdCI6MTc5MjMyMzc5MywiZXhwIjoxODAwMDk5NzkzfQ.GXgzTgGvm-D3uvJEjIRgFnYzS5PmM64gUebTd7Iny5I"

workspace_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
cache_path = os.path.join(workspace_root, "artifacts/api-server/src/lib/seedNotesCache.json")

try:
    with open(cache_path) as f:
        cache = json.load(f)
except Exception:
    cache = {}

print(f"Loaded existing cache with {len(cache)} entries.")

batches = sys.argv[1:] if len(sys.argv) > 1 else [
    "698ad3519549b300a5e1cc6a", # Arjuna JEE 2027
]

def resolve_pwthor(b_id, s_slug, p_id, hw_id):
    h_param = hw_id if hw_id else ""
    url = f"https://pwthor.live/api/GetPdf?BatchId={b_id}&SubjectId={s_slug}&PdfId={p_id}&HomeworkId={h_param}"
    r = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": "https://pwthor.live/",
        "Cookie": f"auth_token={PWTHOR_TOKEN}"
    })
    try:
        with urllib.request.urlopen(r, timeout=4) as resp:
            data = json.loads(resp.read().decode())
            return data.get("data")
    except Exception:
        return None

count_added = 0

for batch_id in batches:
    # 1. Get subjects
    subjects_url = f"https://pwsecure.gourav23032009.workers.dev/api/pw/v3/batches/{batch_id}/details"
    req_s = urllib.request.Request(subjects_url, headers={"client-id": "5eb393ee95fab7468a79d189", "User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req_s) as r_s:
            subjects = json.loads(r_s.read().decode()).get("data", {}).get("subjects", [])
    except Exception as e:
        print(f"Failed getting subjects for batch {batch_id}: {e}")
        continue

    for subj in subjects:
        s_slug = subj.get("slug")
        s_id = subj.get("_id")
        s_name = subj.get("subject", "Subject")
        if not s_slug or "notices" in s_slug:
            continue

        print(f"\nProcessing Subject: {s_name} ({s_slug})")
        
        # 2. Get ALL pages of topics
        topics = []
        for p in range(1, 10):
            t_url = f"https://pwsecure.gourav23032009.workers.dev/api/pw/v2/batches/{batch_id}/subject/{s_slug}/topics?page={p}"
            req_t = urllib.request.Request(t_url, headers={"client-id": "5eb393ee95fab7468a79d189", "User-Agent": "Mozilla/5.0"})
            try:
                with urllib.request.urlopen(req_t) as r_t:
                    t_data = json.loads(r_t.read().decode()).get("data", [])
                    if not t_data:
                        break
                    topics.extend(t_data)
            except Exception:
                break

        print(f"  Found {len(topics)} chapters.")

        # 3. For each chapter, get notes
        for top in topics:
            top_slug = top.get("slug")
            top_name = top.get("name")
            if not top_slug:
                continue
            
            for p_c in range(1, 6):
                c_url = f"https://pwsecure.gourav23032009.workers.dev/api/pw/v2/batches/{batch_id}/subject/{s_slug}/contents?tag={top_slug}&contentType=notes&page={p_c}"
                req_c = urllib.request.Request(c_url, headers={"client-id": "5eb393ee95fab7468a79d189", "User-Agent": "Mozilla/5.0"})
                try:
                    with urllib.request.urlopen(req_c) as r_c:
                        contents = json.loads(r_c.read().decode()).get("data", [])
                        if not contents:
                            break
                        for c in contents:
                            p_id = c.get("_id")
                            hw_id = c.get("homeworkId") or ""
                            c_name = c.get("topic") or "Note"

                            # Check if already resolved
                            if (p_id and p_id in cache) or (hw_id and hw_id in cache):
                                continue

                            # Resolve via pwthor
                            pdf_data = resolve_pwthor(batch_id, s_slug, p_id, hw_id)
                            if pdf_data and pdf_data.get("key"):
                                if not pdf_data.get("fullUrl"):
                                    pdf_data["fullUrl"] = (pdf_data.get("baseUrl") or "https://static.pw.live/") + pdf_data["key"]
                                
                                if p_id:
                                    cache[p_id] = pdf_data
                                if hw_id:
                                    cache[hw_id] = pdf_data
                                if s_id and p_id:
                                    cache[f"{batch_id}_{s_id}_{p_id}_{hw_id}"] = pdf_data
                                cache[f"{batch_id}_{s_slug}_{p_id}_{hw_id}"] = pdf_data
                                count_added += 1
                                print(f"    + [{top_name}] {pdf_data.get('name', c_name)}: {pdf_data.get('key')}")
                                
                                # Periodically flush
                                if count_added % 20 == 0:
                                    with open(cache_path, "w") as f:
                                        json.dump(cache, f, indent=2)
                except Exception:
                    break

# Final flush
with open(cache_path, "w") as f:
    json.dump(cache, f, indent=2)

print(f"\nCompleted! Added {count_added} newly resolved notes. Total in cache: {len(cache)}")
