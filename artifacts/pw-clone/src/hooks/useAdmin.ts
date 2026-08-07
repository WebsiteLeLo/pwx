import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiUrl } from "@/lib/apiUrl";

const api = (path: string) => apiUrl(path);

export function useAdminAuth() {
  return {
    isAuthed: () => localStorage.getItem("admin_key") !== null,
    getKey: () => localStorage.getItem("admin_key") ?? "",
    setKey: (key: string) => localStorage.setItem("admin_key", key),
    clearKey: () => localStorage.removeItem("admin_key"),
  };
}

function adminKey() {
  return localStorage.getItem("admin_key") ?? "";
}

function adminHeaders() {
  return { "Content-Type": "application/json" };
}

function withKey(url: string) {
  return `${url}?_k=${encodeURIComponent(adminKey())}`;
}

// ─── Public ─────────────────────────────────────────────────────

export function usePublicNotifications() {
  return useQuery({
    queryKey: ["public-notifications"],
    queryFn: async () => {
      const r = await fetch(api("/notifications"));
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 1000 * 60 * 2,      // 2 min fresh — no refetch needed within this window
    refetchInterval: 1000 * 60 * 2, // poll every 2 minutes (was every 10 sec)
    refetchOnMount: true,
  });
}

export function useMaintenanceMode() {
  return useQuery({
    queryKey: ["settings", "maintenance"],
    queryFn: async () => {
      const r = await fetch(api("/settings/maintenance"));
      if (!r.ok) return null;
      return r.json();
    },
    staleTime: 1000 * 60 * 5,      // 5 min fresh
    refetchInterval: 1000 * 60 * 5, // poll every 5 minutes (was every 15 sec)
    refetchOnMount: true,
  });
}

export function useTelegramGateSetting() {
  return useQuery({
    queryKey: ["settings", "telegram_gate"],
    queryFn: async () => {
      const r = await fetch(api("/settings/telegram_gate"));
      if (!r.ok) return null;
      return r.json();
    },
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5,
    refetchOnMount: true,
  });
}

export function useAccessGateSetting() {
  return useQuery({
    queryKey: ["settings", "access_gate"],
    queryFn: async () => {
      const r = await fetch(api("/settings/access_gate"));
      if (!r.ok) return null;
      return r.json();
    },
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 30,
    refetchOnMount: true,
  });
}

// ─── Admin ───────────────────────────────────────────────────────

export function useAdminNotifications() {
  return useQuery({
    queryKey: ["admin-notifications"],
    queryFn: async () => {
      const r = await fetch(withKey(api("/admin/notifications")), { headers: adminHeaders() });
      if (!r.ok) throw new Error("Unauthorized");
      return r.json();
    },
  });
}

export function useCreateNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const r = await fetch(withKey(api("/admin/notifications")), {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-notifications"] }); qc.invalidateQueries({ queryKey: ["public-notifications"] }); },
  });
}

export function useToggleNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, active }: { id: number; active: boolean }) => {
      const r = await fetch(withKey(api(`/admin/notifications/${id}`)), {
        method: "PATCH",
        headers: adminHeaders(),
        body: JSON.stringify({ active }),
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-notifications"] }); qc.invalidateQueries({ queryKey: ["public-notifications"] }); },
  });
}

export function useDeleteNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(withKey(api(`/admin/notifications/${id}`)), {
        method: "DELETE",
        headers: adminHeaders(),
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-notifications"] }); qc.invalidateQueries({ queryKey: ["public-notifications"] }); },
  });
}

export function useAdminSettings() {
  return useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => {
      const r = await fetch(withKey(api("/admin/settings")), { headers: adminHeaders() });
      if (!r.ok) throw new Error("Unauthorized");
      return r.json();
    },
  });
}

export function useAdminAccessKeys() {
  return useQuery({
    queryKey: ["admin-access-keys"],
    queryFn: async () => {
      const r = await fetch(withKey(api("/admin/access-keys")), { headers: adminHeaders() });
      if (!r.ok) throw new Error("Unauthorized");
      return r.json();
    },
  });
}

export function useCreateAccessKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (label?: string) => {
      const r = await fetch(withKey(api("/admin/access-keys")), {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({ label: label?.trim() || undefined }),
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-access-keys"] });
    },
  });
}

export function useToggleAccessKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, active }: { id: number; active: boolean }) => {
      const r = await fetch(withKey(api(`/admin/access-keys/${id}`)), {
        method: "PATCH",
        headers: adminHeaders(),
        body: JSON.stringify({ active }),
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-access-keys"] });
    },
  });
}

export function useUpdateSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: any }) => {
      const r = await fetch(withKey(api(`/admin/settings/${key}`)), {
        method: "PUT",
        headers: adminHeaders(),
        body: JSON.stringify({ value }),
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-settings"] });
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
  });
}

export async function verifyAdminKey(key: string): Promise<boolean> {
  try {
    const r = await fetch(api("/admin/auth"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    });
    return r.ok;
  } catch {
    return false;
  }
}
