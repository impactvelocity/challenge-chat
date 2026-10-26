import type { ChallengeEventEnvelope, ChallengeRun, LiveRunProjection } from "../shared/framework";

type MetricEvent = Extract<ChallengeEventEnvelope["event"], { type: "metric.incremented" | "metric.set" }>;

export interface ReporterOptions {
  baseUrl: string;
  source: string;
  channelId?: string;
  integrationToken?: string;
  fetchImpl?: typeof fetch;
}

export class ChallengeChatReportError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ChallengeChatReportError";
  }
}

/** Server/local-helper SDK. Never import this module into an OBS or browser bundle with a token. */
export function createChallengeChatReporter(options: ReporterOptions) {
  const base = new URL(options.baseUrl);
  if (base.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(base.hostname)) {
    throw new Error("An HTTPS Challenge.chat URL is required outside localhost");
  }
  if (!options.integrationToken && !["localhost", "127.0.0.1"].includes(base.hostname)) {
    throw new Error("An integration token is required for a remote Challenge.chat deployment");
  }
  if (!options.source.trim()) throw new Error("An integration source name is required");
  const transport = options.fetchImpl ?? fetch;

  return {
    async report(runId: string, eventId: string, event: MetricEvent, occurredAt?: string) {
      if (!eventId.trim()) throw new Error("A stable provider event ID is required");
      const envelope: ChallengeEventEnvelope = {
        source: options.source,
        idempotencyKey: `${options.source}:${eventId}`,
        occurredAt,
        event,
      };
      const url = new URL(`/api/v1/runs/${encodeURIComponent(runId)}/events`, base);
      if (options.channelId) url.searchParams.set("channel", options.channelId);
      const response = await transport(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(options.integrationToken ? { Authorization: `Bearer ${options.integrationToken}` } : {}),
        },
        body: JSON.stringify(envelope),
      });
      const payload = await response.json() as { error?: string; run?: ChallengeRun; projection?: LiveRunProjection; duplicate?: boolean };
      if (!response.ok) throw new ChallengeChatReportError(payload.error ?? `Report failed (${response.status})`, response.status);
      return payload as { run: ChallengeRun; projection: LiveRunProjection; duplicate: boolean };
    },
  };
}
