import type { AppState, ChallengeDraft, Theme } from "../shared/contracts";
import type { PublicOverlayState } from "../shared/public-state";
import type { ChannelSummary } from "../shared/channels";
import type { ScoringRules } from "../shared/scoring";
import { channelPath } from "./framework/channel";

export interface AuthSession {
  authenticated: boolean;
  role: "owner" | "mod" | null;
  displayName: string | null;
  setup: "complete" | "ready" | "needs_setup_token";
}

export interface ModSummary {
  id: string;
  displayName: string;
  active: boolean;
  createdAt: number;
  channelIds: string[];
}

export interface ModInvite {
  link: string;
  expiresAt: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const globalRoute = path === "/api/channels" || (path.startsWith("/api/auth/") && !path.startsWith("/api/auth/mods"));
  const response = await fetch(globalRoute ? path : channelPath(path), {
    ...init,
    headers: init?.body instanceof FormData ? init.headers : { "Content-Type": "application/json", ...init?.headers },
  });
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
  return payload;
}

export const api = {
  channels: () => request<{ channels: ChannelSummary[] }>("/api/channels"),
  createChannel: (displayName: string, slug: string) => request<{ channel: ChannelSummary }>("/api/channels", { method: "POST", body: JSON.stringify({ displayName, slug }) }),
  updateChannel: (displayName: string, slug: string) => request("/api/channel", { method: "PATCH", body: JSON.stringify({ displayName, slug }) }),
  updateScoringRules: (rules: ScoringRules) => request<{ rules: ScoringRules }>("/api/scoring-rules", { method: "PATCH", body: JSON.stringify({ rules }) }),
  completeSession: () => request<{ winner: "streamer" | "chat" | null; sweepWinner: "streamer" | "chat" | null }>("/api/session/complete", { method: "POST", body: "{}" }),
  createSession: () => request<{ id: string }>("/api/sessions", { method: "POST", body: "{}" }),
  integrationStatus: () => request<{ token: { lastFour: string; createdAt: number } | null; environmentFallback: boolean }>("/api/channel/integration"),
  rotateIntegrationToken: () => request<{ token: string }>("/api/channel/integration", { method: "POST", body: "{}" }),
  state: () => request<AppState>("/api/state"),
  publicState: () => request<PublicOverlayState>("/api/public/state"),
  authSession: () => request<AuthSession>("/api/auth/session"),
  login: (password: string) => request<AuthSession>("/api/auth/owner/login", { method: "POST", body: JSON.stringify({ password }) }),
  setupOwner: (setupToken: string, password: string) => request<AuthSession>("/api/auth/setup", { method: "POST", body: JSON.stringify({ setupToken, password }) }),
  consumeInvite: (token: string) => request<AuthSession>("/api/auth/invites/consume", { method: "POST", body: JSON.stringify({ token }) }),
  logout: () => request<{ authenticated: false }>("/api/auth/session", { method: "DELETE" }),
  mods: (all = false) => request<{ mods: ModSummary[] }>(`/api/auth/mods${all ? "?all=1" : ""}`),
  grantModAccess: (modId: string) => request<ModInvite>("/api/channel/mods", { method: "POST", body: JSON.stringify({ modId }) }),
  createMod: (displayName: string) => request<{ mod: ModSummary } & ModInvite>("/api/auth/mods", { method: "POST", body: JSON.stringify({ displayName }) }),
  regenerateModInvite: (id: string) => request<ModInvite>(`/api/auth/mods/${encodeURIComponent(id)}/invite`, { method: "POST", body: "{}" }),
  revokeMod: (id: string) => request<{ ok: true }>(`/api/auth/mods/${encodeURIComponent(id)}`, { method: "DELETE" }),
  reset: () => request<AppState>("/api/demo/reset", { method: "POST" }),
  createChallenge: (input: { text: string; game: string; author: { displayName: string } }) =>
    request<{ id: string; parserStatus: string }>("/api/challenges", { method: "POST", body: JSON.stringify(input) }),
  updateChallenge: (id: string, challenge: ChallengeDraft) =>
    request(`/api/challenges/${id}`, { method: "PATCH", body: JSON.stringify({ challenge }) }),
  setStatus: (id: string, status: "approved" | "queued" | "rejected") =>
    request(`/api/challenges/${id}/status`, { method: "POST", body: JSON.stringify({ status }) }),
  start: (id: string) => request(`/api/challenges/${id}/start`, { method: "POST", body: "{}" }),
  attempt: (id: string, delta: number) =>
    request(`/api/challenges/${id}/attempt`, { method: "POST", body: JSON.stringify({ delta }) }),
  resolve: (id: string, result: "streamer_won" | "chat_won" | "skipped" | "voided") =>
    request(`/api/challenges/${id}/resolve`, { method: "POST", body: JSON.stringify({ result }) }),
  openBallot: (challengeIds: string[], durationSeconds = 60) =>
    request<{ id: string }>("/api/ballots", { method: "POST", body: JSON.stringify({ challengeIds, durationSeconds }) }),
  vote: (ballotId: string, challengeId: string, voterId: string) =>
    request(`/api/ballots/${ballotId}/vote`, { method: "POST", body: JSON.stringify({ challengeId, voterId }) }),
  closeBallot: (id: string) => request(`/api/ballots/${id}/close`, { method: "POST", body: "{}" }),
  updateTheme: (theme: Theme) => request("/api/theme", { method: "PATCH", body: JSON.stringify({ theme }) }),
  upload: async (file: File) => {
    const data = new FormData();
    data.append("file", file);
    return request<{ url: string }>("/api/assets", { method: "POST", body: data });
  },
};
