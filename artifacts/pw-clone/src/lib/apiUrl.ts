const base = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
export const apiUrl = (path: string) => `${base}${path}`;

const ogBase = (import.meta.env.VITE_OG_URL ?? import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
export const ogUrl = (path: string) => `${ogBase}${path}`;
