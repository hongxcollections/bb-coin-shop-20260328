// ─── In-memory store for email password reset requests ────────────────────────
// Survives within a single server process. Cleared on restart, but admin
// typically handles requests quickly so this is acceptable.

export type ResetRequest = {
  id: string;
  email: string;
  userName: string | null;
  tempPassword: string;   // plaintext — shown to admin only
  createdAt: Date;
  handled: boolean;
};

const store: ResetRequest[] = [];

export function addResetRequest(req: Omit<ResetRequest, "id" | "handled">): ResetRequest {
  const entry: ResetRequest = { ...req, id: crypto.randomUUID(), handled: false };
  store.unshift(entry);           // newest first
  if (store.length > 200) store.pop(); // cap at 200 entries
  return entry;
}

export function getPendingResetRequests(): ResetRequest[] {
  return store.filter(r => !r.handled);
}

export function getAllResetRequests(): ResetRequest[] {
  return [...store];
}

export function dismissResetRequest(id: string): boolean {
  const entry = store.find(r => r.id === id);
  if (!entry) return false;
  entry.handled = true;
  return true;
}
