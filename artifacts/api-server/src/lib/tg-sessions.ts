/**
 * In-memory store for Telegram verification sessions.
 * sessionId → session data (expires automatically via TTL check)
 */

export interface TgSession {
  code: string | null;       // 6-digit code sent to user via bot
  userId: number | null;     // Telegram user ID (set after bot interaction)
  userName: string | null;   // Telegram first name
  verified: boolean;         // Has the code been verified on the website?
  createdAt: number;         // ms timestamp
  codeIssuedAt: number | null; // when the code was sent
}

const SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes
const CODE_TTL_MS   =  5 * 60 * 1000; //  5 minutes

const store = new Map<string, TgSession>();

// Periodic cleanup to avoid memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [id, s] of store) {
    if (now - s.createdAt > SESSION_TTL_MS) store.delete(id);
  }
}, 60_000);

export function createSession(sessionId: string): TgSession {
  const s: TgSession = {
    code: null,
    userId: null,
    userName: null,
    verified: false,
    createdAt: Date.now(),
    codeIssuedAt: null,
  };
  store.set(sessionId, s);
  return s;
}

export function getSession(sessionId: string): TgSession | undefined {
  const s = store.get(sessionId);
  if (!s) return undefined;
  if (Date.now() - s.createdAt > SESSION_TTL_MS) {
    store.delete(sessionId);
    return undefined;
  }
  return s;
}

export function setCode(sessionId: string, code: string, userId: number, userName: string): boolean {
  const s = store.get(sessionId);
  if (!s) return false;
  s.code = code;
  s.userId = userId;
  s.userName = userName;
  s.codeIssuedAt = Date.now();
  return true;
}

export function verifyCode(sessionId: string, code: string): TgSession | null {
  const s = getSession(sessionId);
  if (!s || !s.code || !s.codeIssuedAt) return null;
  if (Date.now() - s.codeIssuedAt > CODE_TTL_MS) return null; // code expired
  if (s.code !== code.trim()) return null;
  s.verified = true;
  store.delete(sessionId); // one-time use
  return s;
}
