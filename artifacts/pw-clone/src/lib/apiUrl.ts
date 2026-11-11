const envBase = import.meta.env.VITE_API_URL;
const rawBase =
  envBase ||
  (typeof window !== "undefined" &&
  window.location.hostname !== "localhost" &&
  window.location.hostname !== "127.0.0.1" &&
  !window.location.hostname.startsWith("192.168.")
    ? "https://getpwx2.onrender.com"
    : "");

export const apiUrl = (path: string) => {
  const normalizedPath = path ? (path.startsWith("/") ? path : `/${path}`) : "";

  if (rawBase) {
    const base = rawBase.replace(/\/$/, "");
    if (base.endsWith("/api") && normalizedPath.startsWith("/api")) {
      return `${base}${normalizedPath.slice(4)}`;
    }
    if (!base.endsWith("/api") && !normalizedPath.startsWith("/api")) {
      return `${base}/api${normalizedPath}`;
    }
    return `${base}${normalizedPath}`;
  }

  if (normalizedPath.startsWith("/api")) {
    return normalizedPath;
  }
  return `/api${normalizedPath}`;
};

const ogBase = (import.meta.env.VITE_OG_URL ?? import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
export const ogUrl = (path: string) => `${ogBase}${path}`;

