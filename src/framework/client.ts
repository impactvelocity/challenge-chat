import type { ChallengeDefinition, ChallengeEventEnvelope, ChallengeRun, LiveRunProjection } from "../../shared/framework";
import { channelPath } from "./channel";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(channelPath(path), {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
  return payload;
}

export const frameworkClient = {
  capabilities: () => request<{
    apiVersion: string;
    transports: string[];
    metrics: string[];
    rules: string[];
    surfaces: string[];
  }>("/api/v1/capabilities"),
  createRun: (definition: ChallengeDefinition) =>
    request<{ run: ChallengeRun; projection: LiveRunProjection }>("/api/v1/runs", {
      method: "POST",
      body: JSON.stringify({ definition }),
    }),
  liveRun: () => request<{ run: ChallengeRun | null; projection: LiveRunProjection | null }>("/api/v1/runs/live"),
  publishEvent: (runId: string, envelope: ChallengeEventEnvelope) =>
    request<{ run: ChallengeRun; projection: LiveRunProjection; duplicate: boolean }>(`/api/v1/runs/${runId}/events`, {
      method: "POST",
      body: JSON.stringify(envelope),
    }),
};
