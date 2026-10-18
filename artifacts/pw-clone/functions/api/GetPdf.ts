const PWTHOR_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJtb2JpbGUiOiI3OTM0MDUwMDEwNjgiLCJuYW1lIjoiUFdUaG9yIFVzZXIgZjAwMDcxMDUiLCJyYW5kb21JZCI6ImYwMDA3MTA1LTRmZjgtNDJmOC1hZDY5LWQ1ZjNiMGJiZmEzOCIsImF1dGhUeXBlIjoiZGlyZWN0X2xvZ2luIiwiZGlyZWN0TG9naW4iOnRydWUsImlhdCI6MTc5MjMyMzc5MywiZXhwIjoxODAwMDk5NzkzfQ.GXgzTgGvm-D3uvJEjIRgFnYzS5PmM64gUebTd7Iny5I";

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

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
  "Cache-Control": "public, max-age=86400",
};

export async function onRequestGet(context: any): Promise<Response> {
  const url = new URL(context.request.url);
  const batchId = url.searchParams.get("BatchId") || url.searchParams.get("batchId") || "";
  const rawSubjectId = url.searchParams.get("SubjectId") || url.searchParams.get("subjectId") || "";
  const pdfId = url.searchParams.get("PdfId") || url.searchParams.get("pdfId") || "";
  const homeworkId = url.searchParams.get("HomeworkId") || url.searchParams.get("homeworkId") || "";

  if (!batchId || !pdfId) {
    return new Response(JSON.stringify({ error: "Missing required query parameters: BatchId and PdfId" }), {
      status: 400,
      headers: CORS_HEADERS,
    });
  }

  const candidateSubjects = [rawSubjectId];
  if (SUBJECT_ID_TO_SLUG[rawSubjectId] && !candidateSubjects.includes(SUBJECT_ID_TO_SLUG[rawSubjectId])) {
    candidateSubjects.push(SUBJECT_ID_TO_SLUG[rawSubjectId]);
  }

  for (const subj of candidateSubjects) {
    try {
      const hwParam = homeworkId ? `&HomeworkId=${encodeURIComponent(homeworkId)}` : "";
      const pwthorUrl = `https://pwthor.live/api/GetPdf?BatchId=${encodeURIComponent(batchId)}&SubjectId=${encodeURIComponent(subj)}&PdfId=${encodeURIComponent(pdfId)}${hwParam}`;

      const res = await fetch(pwthorUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
          "Referer": "https://pwthor.live/",
          "Accept": "application/json, text/plain, */*",
          "Cookie": `auth_token=${PWTHOR_TOKEN}`,
        },
      });

      if (!res.ok) continue;

      const data = await res.json() as any;
      if (data && data.data && data.data.key) {
        const d = data.data;
        const baseUrl = d.baseUrl || "https://static.pw.live/";
        return new Response(
          JSON.stringify({
            status: 200,
            success: true,
            data: {
              _id: d._id || homeworkId || pdfId,
              baseUrl,
              key: d.key,
              name: d.name || "Class Notes.pdf",
              status: d.status || "Active",
              type: d.type || "ADMIN",
              fullUrl: baseUrl + d.key,
            },
          }),
          { status: 200, headers: CORS_HEADERS }
        );
      }
    } catch {
      // try next subject candidate
    }
  }

  return new Response(JSON.stringify({ error: "Unable to resolve PDF storage key" }), {
    status: 404,
    headers: CORS_HEADERS,
  });
}

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
