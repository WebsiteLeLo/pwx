import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, Settings, Shield, LogOut, Plus, Trash2, Eye, EyeOff,
  Wrench, AlertTriangle, CheckCircle, Info, AlertCircle, Loader2,
  Send, ToggleLeft, ToggleRight, X, Save, RefreshCw,
  KeyRound, Copy, Ban, Clock3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  useAdminNotifications,
  useCreateNotification,
  useToggleNotification,
  useDeleteNotification,
  useAdminSettings,
  useUpdateSetting,
  verifyAdminKey,
  useAdminAuth,
  useAdminAccessKeys,
  useCreateAccessKey,
  useToggleAccessKey,
  useDeleteAccessKey,
} from "@/hooks/useAdmin";
import { useToast } from "@/hooks/use-toast";

// ─── Login ───────────────────────────────────────────────────────

function AdminLogin({ onLogin }: { onLogin: () => void }) {
  const [key, setKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const ok = await verifyAdminKey(key);
    setLoading(false);
    if (ok) {
      localStorage.setItem("admin_key", key);
      onLogin();
      toast({ title: "Welcome back, Admin!" });
    } else {
      setError("Invalid admin key. Please try again.");
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-2xl">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
          <p className="text-zinc-400 mt-1 text-sm">Enter your admin key to continue</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <Input
              type="password"
              placeholder="Admin key"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500 h-11"
              autoFocus
            />
            {error && (
              <p className="text-red-400 text-sm mt-2 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" /> {error}
              </p>
            )}
          </div>
          <Button
            type="submit"
            disabled={loading || !key}
            className="w-full h-11 bg-violet-600 hover:bg-violet-700 text-white font-semibold"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Login"}
          </Button>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Notification type badge ──────────────────────────────────────

const TYPE_META = {
  info:    { label: "Info",    Icon: Info,          cls: "bg-blue-600/20 text-blue-400 border-blue-600/30" },
  warning: { label: "Warning", Icon: AlertTriangle,  cls: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  success: { label: "Success", Icon: CheckCircle,    cls: "bg-green-600/20 text-green-400 border-green-600/30" },
  error:   { label: "Error",   Icon: AlertCircle,    cls: "bg-red-600/20 text-red-400 border-red-600/30" },
};

// ─── Notifications Tab ───────────────────────────────────────────

function NotificationsTab() {
  const { data: notifications = [], isLoading, error, refetch } = useAdminNotifications();
  const create = useCreateNotification();
  const toggle = useToggleNotification();
  const del = useDeleteNotification();
  const { toast } = useToast();

  const [form, setForm] = useState({
    title: "",
    message: "",
    type: "info",
    link: "",
    linkLabel: "",
    expiresAt: "",
  });
  const [showForm, setShowForm] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      await create.mutateAsync({ ...form, link: form.link || undefined, linkLabel: form.linkLabel || undefined, expiresAt: form.expiresAt || undefined });
      toast({ title: "Notification sent!" });
      setForm({ title: "", message: "", type: "info", link: "", linkLabel: "", expiresAt: "" });
      setShowForm(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  }

  if (error) return <div className="text-red-400 text-center py-10">Failed to load. Check your admin key.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Notifications</h2>
          <p className="text-zinc-400 text-sm mt-0.5">Send announcements to all users</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
          <Button size="sm" onClick={() => setShowForm((v) => !v)} className="bg-violet-600 hover:bg-violet-700">
            {showForm ? <X className="w-4 h-4 mr-1.5" /> : <Plus className="w-4 h-4 mr-1.5" />}
            {showForm ? "Cancel" : "New Notification"}
          </Button>
        </div>
      </div>

      {/* Create form */}
      <AnimatePresence>
        {showForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleCreate}
            className="overflow-hidden"
          >
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 space-y-4">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <Send className="w-4 h-4 text-violet-400" /> New Notification
              </h3>

              {/* Type selector */}
              <div className="flex gap-2 flex-wrap">
                {Object.entries(TYPE_META).map(([t, m]) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, type: t }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 ${m.cls} ${form.type === t ? "ring-2 ring-white/20" : "opacity-60 hover:opacity-100"}`}
                  >
                    <m.Icon className="w-3.5 h-3.5" /> {m.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <Label className="text-zinc-300 text-xs mb-1.5 block">Title *</Label>
                  <Input
                    required
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="Notification title"
                    className="bg-zinc-800 border-zinc-600 text-white placeholder:text-zinc-500"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-zinc-300 text-xs mb-1.5 block">Message *</Label>
                  <Textarea
                    required
                    value={form.message}
                    onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                    placeholder="Notification message"
                    rows={2}
                    className="bg-zinc-800 border-zinc-600 text-white placeholder:text-zinc-500 resize-none"
                  />
                </div>
                <div>
                  <Label className="text-zinc-300 text-xs mb-1.5 block">Link URL (optional)</Label>
                  <Input
                    value={form.link}
                    onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))}
                    placeholder="https://..."
                    className="bg-zinc-800 border-zinc-600 text-white placeholder:text-zinc-500"
                  />
                </div>
                <div>
                  <Label className="text-zinc-300 text-xs mb-1.5 block">Link Label (optional)</Label>
                  <Input
                    value={form.linkLabel}
                    onChange={(e) => setForm((f) => ({ ...f, linkLabel: e.target.value }))}
                    placeholder="Learn more"
                    className="bg-zinc-800 border-zinc-600 text-white placeholder:text-zinc-500"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-zinc-300 text-xs mb-1.5 block">Expires At (optional)</Label>
                  <Input
                    type="datetime-local"
                    value={form.expiresAt}
                    onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
                    className="bg-zinc-800 border-zinc-600 text-white"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={create.isPending} className="bg-violet-600 hover:bg-violet-700">
                  {create.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                  Send Notification
                </Button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-violet-400" /></div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-12 text-zinc-500">
          <Bell className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No notifications yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(notifications as any[]).map((n) => {
            const meta = TYPE_META[n.type as keyof typeof TYPE_META] ?? TYPE_META.info;
            return (
              <motion.div
                key={n.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-zinc-900 border rounded-xl p-4 flex items-start gap-4 transition-opacity ${n.active ? "border-zinc-700" : "border-zinc-800 opacity-60"}`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${meta.cls} border`}>
                  <meta.Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-white text-sm">{n.title}</span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${meta.cls}`}>{n.type}</span>
                    {!n.active && <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border bg-zinc-700/30 text-zinc-500 border-zinc-700">Inactive</span>}
                    {n.expiresAt && <span className="text-[10px] text-zinc-500">Expires {new Date(n.expiresAt).toLocaleDateString()}</span>}
                  </div>
                  <p className="text-zinc-400 text-sm mt-0.5 break-words">{n.message}</p>
                  {n.link && <a href={n.link} target="_blank" rel="noopener noreferrer" className="text-violet-400 text-xs mt-0.5 block hover:underline">{n.link}</a>}
                  <p className="text-zinc-600 text-xs mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => toggle.mutate({ id: n.id, active: !n.active })}
                    className="text-zinc-400 hover:text-white transition-colors"
                    title={n.active ? "Deactivate" : "Activate"}
                  >
                    {n.active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => del.mutate(n.id)}
                    className="text-zinc-500 hover:text-red-400 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Settings Tab ─────────────────────────────────────────────────

function SettingsTab() {
  const { data: settings = [], isLoading, refetch } = useAdminSettings();
  const updateSetting = useUpdateSetting();
  const { data: accessKeys = [], isLoading: keysLoading } = useAdminAccessKeys();
  const createAccessKey = useCreateAccessKey();
  const toggleAccessKey = useToggleAccessKey();
  const deleteAccessKey = useDeleteAccessKey();
  const { toast } = useToast();

  // Maintenance state
  const [maintenance, setMaintenance] = useState({ enabled: false, message: "", subMessage: "" });
  const [mLoaded, setMLoaded] = useState(false);

  const [accessGateEnabled, setAccessGateEnabled] = useState(true);
  const [accessLoaded, setAccessLoaded] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [keyLabel, setKeyLabel] = useState("");

  useEffect(() => {
    if (!isLoading && !mLoaded) {
      const m = (settings as any[]).find((s) => s.key === "maintenance");
      if (m?.value) {
        setMaintenance({
          enabled: m.value.enabled ?? false,
          message: m.value.message ?? "",
          subMessage: m.value.subMessage ?? "",
        });
      }
      setMLoaded(true);
    }
    if (!isLoading && !accessLoaded) {
      const gate = (settings as any[]).find((s) => s.key === "access_gate");
      setAccessGateEnabled(gate?.value?.enabled ?? true);
      setAccessLoaded(true);
    }
  }, [settings, isLoading, mLoaded, accessLoaded]);

  async function saveMaintenance() {
    try {
      await updateSetting.mutateAsync({ key: "maintenance", value: maintenance });
      toast({ title: maintenance.enabled ? "🔧 Maintenance mode enabled!" : "✅ Site is now live!" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  }

  async function saveAccessGate(enabled: boolean) {
    try {
      setAccessGateEnabled(enabled);
      await updateSetting.mutateAsync({ key: "access_gate", value: { enabled } });
      toast({ title: enabled ? "🔒 Access key gate started" : "🔓 Access key gate removed" });
    } catch (e: any) {
      setAccessGateEnabled(!enabled);
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  }

  async function generateKey() {
    try {
      const result = await createAccessKey.mutateAsync(keyLabel);
      setNewKey(result.key);
      setKeyLabel("");
      toast({ title: "Access key generated", description: "Copy it now — it cannot be shown again." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  }

  async function copyKey() {
    if (!newKey) return;
    await navigator.clipboard.writeText(newKey);
    toast({ title: "Key copied" });
  }

  async function permanentlyDeleteKey(accessKey: any) {
    const label = accessKey.label || "this access key";
    if (!window.confirm(`Permanently delete ${label}? This cannot be undone.`)) return;
    try {
      await deleteAccessKey.mutateAsync(accessKey.id);
      toast({ title: "Access key permanently deleted" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  }

  function renderAccessKey(accessKey: any) {
    const isArolinksKey = accessKey.source === "arolinks";
    return (
      <div key={accessKey.id} className="flex items-center gap-3 rounded-lg bg-zinc-800/70 px-3 py-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm text-zinc-200 truncate">{accessKey.label || "Untitled key"}</p>
            {isArolinksKey && (
              <span className="text-[9px] uppercase tracking-wider font-bold rounded border border-orange-500/30 bg-orange-500/10 px-1.5 py-0.5 text-orange-300">
                Arolinks
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500">
            {new Date(accessKey.createdAt).toLocaleString()} ·{" "}
            {accessKey.claimedAt ? "Assigned to one device" : "Available"}
          </p>
          {isArolinksKey && accessKey.expiresAt && (
            <p className="text-xs text-orange-300/80 mt-0.5 flex items-center gap-1">
              <Clock3 className="w-3 h-3" />
              Auto-deletes {new Date(accessKey.expiresAt).toLocaleString()}
            </p>
          )}
        </div>
        <Badge className={accessKey.active ? "bg-green-600/15 text-green-400 border-green-600/30" : "bg-zinc-700 text-zinc-400 border-zinc-600"}>
          {accessKey.active ? "Active" : "Revoked"}
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => toggleAccessKey.mutate({ id: accessKey.id, active: !accessKey.active })}
          disabled={toggleAccessKey.isPending}
          className={accessKey.active ? "text-red-400 hover:text-red-300" : "text-green-400 hover:text-green-300"}
          title={accessKey.active ? "Revoke key" : "Reactivate key"}
        >
          {accessKey.active ? <Ban className="w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => permanentlyDeleteKey(accessKey)}
          disabled={deleteAccessKey.isPending}
          className="text-zinc-500 hover:text-red-400"
          title="Permanently delete key"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Site Settings</h2>
        <p className="text-zinc-400 text-sm mt-0.5">Control site-wide behaviors</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-violet-400" /></div>
      ) : (
        <div className="space-y-4">
          {/* Generated Access Key Gate */}
          <div className={`bg-zinc-900 border rounded-xl p-5 transition-colors ${accessGateEnabled ? "border-violet-600/50" : "border-green-600/50"}`}>
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${accessGateEnabled ? "bg-violet-600/20 text-violet-400" : "bg-green-600/20 text-green-400"}`}>
                <KeyRound className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-white">Generated Key Access Gate</h3>
                    <p className="text-zinc-400 text-sm">
                      {accessGateEnabled ? "Visitors need an active generated key to enter" : "Gate removed — the site is open to everyone"}
                    </p>
                  </div>
                  <Switch checked={accessGateEnabled} onCheckedChange={saveAccessGate} />
                </div>

                <div className="mt-4 flex flex-col sm:flex-row gap-2">
                  <Input
                    value={keyLabel}
                    onChange={(e) => setKeyLabel(e.target.value)}
                    placeholder="Optional label (e.g. Student batch)"
                    className="bg-zinc-800 border-zinc-600 text-white placeholder:text-zinc-500"
                  />
                  <Button onClick={generateKey} disabled={createAccessKey.isPending} className="bg-violet-600 hover:bg-violet-700 shrink-0">
                    {createAccessKey.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                    Generate key
                  </Button>
                </div>

                {newKey && (
                  <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                    <p className="text-amber-300 text-xs mb-2">Copy this key now. The full key will not be displayed again.</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-sm text-white break-all">{newKey}</code>
                      <Button variant="outline" size="sm" onClick={copyKey} className="border-amber-500/40 text-amber-300 hover:bg-amber-500/10">
                        <Copy className="w-4 h-4 mr-1" /> Copy
                      </Button>
                    </div>
                  </div>
                )}

                <div className="mt-4 space-y-4">
                  {keysLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                  ) : (
                    <>
                      <div className="rounded-lg border border-orange-500/20 bg-orange-500/[0.03] p-3 space-y-2">
                        <div>
                          <p className="text-xs uppercase tracking-wider text-orange-300">Arolinks generated keys</p>
                          <p className="text-xs text-zinc-500 mt-0.5">Automatically and permanently deleted after 24 hours.</p>
                        </div>
                        {(accessKeys as any[]).filter((key) => key.source === "arolinks").length === 0 ? (
                          <p className="text-sm text-zinc-500 py-2">No Arolinks keys generated yet.</p>
                        ) : (
                          (accessKeys as any[]).filter((key) => key.source === "arolinks").map(renderAccessKey)
                        )}
                      </div>

                      <div className="rounded-lg border border-zinc-700 bg-zinc-950/30 p-3 space-y-2">
                        <div>
                          <p className="text-xs uppercase tracking-wider text-zinc-400">Admin generated keys</p>
                          <p className="text-xs text-zinc-500 mt-0.5">Keys created manually from this panel. These do not auto-expire.</p>
                        </div>
                        {(accessKeys as any[]).filter((key) => key.source !== "arolinks").length === 0 ? (
                          <p className="text-sm text-zinc-500 py-2">No admin keys generated yet.</p>
                        ) : (
                          (accessKeys as any[]).filter((key) => key.source !== "arolinks").map(renderAccessKey)
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Maintenance Mode */}
          <div className={`bg-zinc-900 border rounded-xl p-5 space-y-4 transition-colors ${maintenance.enabled ? "border-orange-600/50" : "border-zinc-700"}`}>
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${maintenance.enabled ? "bg-orange-600/20 text-orange-400" : "bg-zinc-800 text-zinc-400"}`}>
                <Wrench className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-white">Maintenance Mode</h3>
                    <p className="text-zinc-400 text-sm">Show a maintenance page to all visitors</p>
                  </div>
                  <Switch
                    checked={maintenance.enabled}
                    onCheckedChange={(v) => setMaintenance((m) => ({ ...m, enabled: v }))}
                    className="data-[state=checked]:bg-orange-600"
                  />
                </div>

                <AnimatePresence>
                  {maintenance.enabled && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-4 space-y-3 pt-4 border-t border-zinc-700">
                        <div>
                          <Label className="text-zinc-300 text-xs mb-1.5 block">Main Heading</Label>
                          <Input
                            value={maintenance.message}
                            onChange={(e) => setMaintenance((m) => ({ ...m, message: e.target.value }))}
                            placeholder="Under Maintenance"
                            className="bg-zinc-800 border-zinc-600 text-white placeholder:text-zinc-500"
                          />
                        </div>
                        <div>
                          <Label className="text-zinc-300 text-xs mb-1.5 block">Sub Message</Label>
                          <Textarea
                            value={maintenance.subMessage}
                            onChange={(e) => setMaintenance((m) => ({ ...m, subMessage: e.target.value }))}
                            placeholder="We'll be back soon!"
                            rows={2}
                            className="bg-zinc-800 border-zinc-600 text-white placeholder:text-zinc-500 resize-none"
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={saveMaintenance}
                disabled={updateSetting.isPending}
                className={maintenance.enabled ? "bg-orange-600 hover:bg-orange-700" : "bg-green-700 hover:bg-green-800"}
              >
                {updateSetting.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                {maintenance.enabled ? "Enable Maintenance" : "Save (Site Live)"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Admin Panel ─────────────────────────────────────────────

const TABS = [
  { id: "notifications", label: "Notifications", Icon: Bell },
  { id: "settings",      label: "Settings",      Icon: Settings },
];

export default function AdminPanel() {
  const auth = useAdminAuth();
  const [authed, setAuthed] = useState(auth.isAuthed());
  const [tab, setTab] = useState("notifications");
  const { toast } = useToast();

  if (!authed) {
    return <AdminLogin onLogin={() => setAuthed(true)} />;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-sm">Admin Panel</span>
          </div>
          <button
            onClick={() => {
              auth.clearKey();
              setAuthed(false);
              toast({ title: "Logged out" });
            }}
            className="flex items-center gap-1.5 text-zinc-400 hover:text-white text-sm transition-colors"
          >
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-1 bg-zinc-900 rounded-xl p-1 mb-6 w-fit">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === id ? "bg-zinc-700 text-white shadow" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {tab === "notifications" && <NotificationsTab />}
            {tab === "settings" && <SettingsTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
