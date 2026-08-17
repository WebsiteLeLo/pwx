const rawBase = import.meta.env.VITE_API_URL;

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

