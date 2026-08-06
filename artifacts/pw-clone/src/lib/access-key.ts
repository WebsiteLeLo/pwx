// access-key.ts
const HOURS_24 = 24 * 60 * 60 * 1000;
const PENDING_WINDOW = 30 * 60 * 1000; // token must be redeemed within 30 min

export function generateAndRedirect(arolinksUrl: string) {
  const token = crypto.randomUUID();
  localStorage.setItem("pending_token", token);
  localStorage.setItem("pending_created", Date.now().toString());
  window.location.href = arolinksUrl; // your Arolinks shortlink, dashboard-configured
}

export function verifyPendingToken(): boolean {
  const pendingToken = localStorage.getItem("pending_token");
  const pendingCreated = Number(localStorage.getItem("pending_created") || 0);
  const isFresh = !!pendingToken && Date.now() - pendingCreated < PENDING_WINDOW;

  if (isFresh) {
    localStorage.setItem("access_granted", Date.now().toString());
    localStorage.removeItem("pending_token");
    localStorage.removeItem("pending_created");
    return true;
  }
  return false;
}

export function hasValidAccess(): boolean {
  const granted = Number(localStorage.getItem("access_granted") || 0);
  return granted > 0 && Date.now() - granted < HOURS_24;
}

export function remainingAccessMs(): number {
  const granted = Number(localStorage.getItem("access_granted") || 0);
  return Math.max(0, HOURS_24 - (Date.now() - granted));
}
