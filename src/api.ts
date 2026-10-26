import type { AppState, ChallengeDraft, Theme } from "../shared/contracts";
import type { PublicOverlayState } from "../shared/public-state";
import type { ChannelSummary } from "../shared/channels";
import type { ScoringRules } from "../shared/scoring";
import type { OverlayConfig, SessionSettings } from "../shared/surface-config";
import type { BoardToolName } from "../shared/board-tools";
import type { TwitchConnectionStatus } from "../shared/twitch";
import { channelPath } from "./framework/channel";

export interface AuthSession {
  authenticated: boolean;
  role: "owner" | "mod" | null;
  displayName: string | null;
  controlRoomName: string;
  setup: "complete" | "ready";
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

export interface AiStatus {
  configured: boolean;
  provider: string;
  gateway: string;
  model: string;
}

export interface ApiTokenSummary {
  id: string;
  name: string;
  lastFour: string;
  createdAt: number;
  lastUsedAt: number | null;
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
  createChannel: (displayName: string, slug: string, setup: { twitchLogin: string; primary: string; accent: string }) =>
    request<{ channel: ChannelSummary }>("/api/channels", { method: "POST", body: JSON.stringify({ displayName, slug, ...setup }) }),
  deleteChannel: () => request<{ nextChannel: ChannelSummary }>("/api/channel", { method: "DELETE" }),
  updateChannel: (displayName: string, slug: string) => request("/api/channel", { method: "PATCH", body: JSON.stringify({ displayName, slug }) }),
  updateScoringRules: (rules: ScoringRules) => request<{ rules: ScoringRules }>("/api/scoring-rules", { method: "PATCH", body: JSON.stringify({ rules }) }),
  updateOverlayConfig: (config: OverlayConfig) => request<{ config: OverlayConfig }>("/api/overlay-config", { method: "PATCH", body: JSON.stringify({ config }) }),
  updateSessionSettings: (settings: SessionSettings) => request<{ settings: SessionSettings }>("/api/session-settings", { method: "PATCH", body: JSON.stringify({ settings }) }),
  completeSession: () => request<{ winner: "streamer" | "chat" | null; sweepWinner: "streamer" | "chat" | null }>("/api/session/complete", { method: "POST", body: "{}" }),
  cancelSession: () => request<{ id: string; inboxCount: number }>("/api/session/cancel", { method: "POST", body: "{}" }),
  createSession: () => request<{ id: string }>("/api/sessions", { method: "POST", body: "{}" }),
  setSubmissionsOpen: (open: boolean) => request("/api/session/submissions", { method: "PATCH", body: JSON.stringify({ open }) }),
  markInboxSeen: () => request<{ ok: true }>("/api/inbox/seen", { method: "POST", body: "{}" }),
  integrationStatus: () => request<{ token: { lastFour: string; createdAt: number } | null; environmentFallback: boolean }>("/api/channel/integration"),
  rotateIntegrationToken: () => request<{ token: string }>("/api/channel/integration", { method: "POST", body: "{}" }),
  apiTokens: () => request<{ tokens: ApiTokenSummary[] }>("/api/channel/api-tokens"),
  createApiToken: (name: string) => request<ApiTokenSummary & { token: string }>("/api/channel/api-tokens", { method: "POST", body: JSON.stringify({ name }) }),
  revokeApiToken: (id: string) => request<{ ok: true }>(`/api/channel/api-tokens/${encodeURIComponent(id)}`, { method: "DELETE" }),
  twitchStatus: () => request<TwitchConnectionStatus>("/api/twitch/status"),
  saveTwitchConfiguration: (clientId: string, clientSecret: string) => request<TwitchConnectionStatus>("/api/twitch/configuration", {
    method: "PUT",
    body: JSON.stringify({ clientId, clientSecret }),
  }),
  connectTwitch: () => request<{ authorizationUrl: string }>("/api/twitch/connect", { method: "POST", body: "{}" }),
  disconnectTwitch: () => request<{ ok: true }>("/api/twitch/connection", { method: "DELETE" }),
  boardTool: <T = unknown>(name: BoardToolName, input: Record<string, unknown> = {}, signal?: AbortSignal) =>
    request<T>(`/api/v1/board/tools/${encodeURIComponent(name)}`, { method: "POST", body: JSON.stringify(input), signal }),
  state: () => request<AppState>("/api/state"),
  aiStatus: () => request<AiStatus>("/api/ai/status"),
  publicState: () => request<PublicOverlayState>("/api/public/state"),
  authSession: () => request<AuthSession>("/api/auth/session"),
  login: (password: string) => request<AuthSession>("/api/auth/owner/login", { method: "POST", body: JSON.stringify({ password }) }),
  setupOwner: (password: string, controlRoomName: string) => request<AuthSession>("/api/auth/setup", { method: "POST", body: JSON.stringify({ password, controlRoomName }) }),
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
  setStatus: (id: string, status: "approved" | "queued" | "rejected" | "inbox" | "pending_review") =>
    request(`/api/challenges/${id}/status`, { method: "POST", body: JSON.stringify({ status }) }),
  start: (id: string) => request(`/api/challenges/${id}/start`, { method: "POST", body: "{}" }),
  attempt: (id: string, delta: number) =>
    request(`/api/challenges/${id}/attempt`, { method: "POST", body: JSON.stringify({ delta }) }),
  setChallengePaused: (id: string, paused: boolean) =>
    request(`/api/challenges/${id}/pause`, { method: "POST", body: JSON.stringify({ paused }) }),
  resolve: (id: string, result: "streamer_won" | "chat_won" | "skipped" | "voided") =>
    request(`/api/challenges/${id}/resolve`, { method: "POST", body: JSON.stringify({ result }) }),
  openBallot: (challengeIds: string[], durationSeconds = 60, winnersCount?: number) =>
    request<{ id: string }>("/api/ballots", { method: "POST", body: JSON.stringify({ challengeIds, durationSeconds, winnersCount }) }),
  vote: (ballotId: string, challengeId: string, voterId: string) =>
    request(`/api/ballots/${ballotId}/vote`, { method: "POST", body: JSON.stringify({ challengeId, voterId }) }),
  closeBallot: (id: string) => request<{ winnerIds: string[]; roundName: string | null; namingStatus: "ai" | "fallback" | null }>(`/api/ballots/${id}/close`, { method: "POST", body: "{}" }),
  reopenVoting: (durationSeconds: number) => request<{ id: string }>("/api/v1/board/tools/reopen_vote", { method: "POST", body: JSON.stringify({ durationSeconds }) }),
  updateSessionName: (name: string) => request<{ name: string }>("/api/session/name", { method: "PATCH", body: JSON.stringify({ name }) }),
  generateSessionName: () => request<{ name: string; generatorStatus: "ai" | "fallback" }>("/api/session/name/generate", { method: "POST", body: "{}" }),
  updateTheme: (theme: Theme) => request("/api/theme", { method: "PATCH", body: JSON.stringify({ theme }) }),
  upload: async (file: File) => {
    const data = new FormData();
    data.append("file", file);
    return request<{ url: string }>("/api/assets", { method: "POST", body: data });
  },
};
