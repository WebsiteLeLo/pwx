// Cloudflare Pages Function: Universal /api/* proxy to getpwx2.onrender.com
import { onRequest as proxyHandler } from "./proxy";

export async function onRequest(context: { request: Request }): Promise<Response> {
  const req = context.request;
  const url = new URL(req.url);

  // If request is for video proxy, handle directly on Cloudflare Edge with 0 Render bandwidth
  if (url.pathname === "/api/proxy") {
    return proxyHandler(context);
  }

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH",
        "Access-Control-Allow-Headers": "*",
      },
    });
  }

  const targetUrl = `https://getpwx2.onrender.com${url.pathname}${url.search}`;

  const headers = new Headers(req.headers);
  headers.set("Host", "getpwx2.onrender.com");
  headers.delete("cf-connecting-ip");
  headers.delete("cf-ray");
  headers.delete("cf-visitor");

  try {
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: ["POST", "PUT", "PATCH"].includes(req.method) ? req.body : undefined,
      redirect: "follow",
    });

    const respHeaders = new Headers(upstream.headers);
    respHeaders.set("Access-Control-Allow-Origin", "*");
    respHeaders.delete("x-frame-options");
    respHeaders.delete("content-security-policy");

    return new Response(upstream.body, {
      status: upstream.status,
      headers: respHeaders,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: "Gateway Error", message: err?.message }), {
      status: 502,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
}

