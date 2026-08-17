export async function onRequest(context) {
  const request = context.request;
  const url = new URL(request.url);

  // The path will be like /proxy/streama.pimaxer.in/uuid/master.m3u8
  // We need to extract the target URL.
  const path = url.pathname.replace(/^\/proxy\//, "");
  
  if (!path) {
    return new Response("No target URL specified", { status: 400 });
  }

  const targetUrl = new URL(`https://${path}${url.search}`);

  // Create a new request based on the original, but point it to the target
  const proxyRequest = new Request(targetUrl.toString(), request);
  
  // Remove headers that might cause the target server to block the request
  proxyRequest.headers.delete("Origin");
  proxyRequest.headers.delete("Referer");

  // Fetch from the target server
  const response = await fetch(proxyRequest);

  // Create a new response to return to the client
  const proxyResponse = new Response(response.body, response);
  
  // Ensure CORS is allowed for our frontend
  proxyResponse.headers.set("Access-Control-Allow-Origin", "*");
  proxyResponse.headers.set("Access-Control-Allow-Methods", "GET, HEAD, POST, OPTIONS");
  proxyResponse.headers.set("Access-Control-Allow-Headers", "*");

  return proxyResponse;
}
