import { z } from "zod";

export const FRAMEWORK_API_VERSION = "2026-10-24";

export const MetricDefinitionSchema = z.discriminatedUnion("kind", [
  z.object({
    id: z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/),
    kind: z.literal("counter"),
    label: z.string().min(1).max(80),
    initial: z.number().default(0),
    minimum: z.number().optional(),
    maximum: z.number().optional(),
    public: z.boolean().default(true),
  }),
  z.object({
    id: z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/),
    kind: z.literal("gauge"),
    label: z.string().min(1).max(80),
    initial: z.number().default(0),
    minimum: z.number().optional(),
    maximum: z.number().optional(),
    public: z.boolean().default(true),
  }),
  z.object({
    id: z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/),
    kind: z.literal("flag"),
    label: z.string().min(1).max(80),
    initial: z.boolean().default(false),
    public: z.boolean().default(true),
  }),
]);

export type MetricDefinition = z.infer<typeof MetricDefinitionSchema>;
export type MetricValue = number | boolean;

export type RuleExpression =
  | {
      type: "compare";
      metric: string;
      operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte";
      value: MetricValue;
    }
  | { type: "timer_expired" }
  | { type: "all"; rules: RuleExpression[] }
  | { type: "any"; rules: RuleExpression[] };

export const RuleExpressionSchema: z.ZodType<RuleExpression> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.object({
      type: z.literal("compare"),
      metric: z.string().min(1).max(64),
      operator: z.enum(["eq", "neq", "gt", "gte", "lt", "lte"]),
      value: z.union([z.number(), z.boolean()]),
    }),
    z.object({ type: z.literal("timer_expired") }),
    z.object({ type: z.literal("all"), rules: z.array(RuleExpressionSchema).min(1).max(12) }),
    z.object({ type: z.literal("any"), rules: z.array(RuleExpressionSchema).min(1).max(12) }),
  ]),
);

export const PresentationHintSchema = z.object({
  component: z.enum(["progress_bar", "counter", "flag", "countdown", "attempts"]),
  metric: z.string().max(64).optional(),
  maximum: z.number().optional(),
  label: z.string().max(80).optional(),
});

export const ChallengeDefinitionSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().uuid().optional(),
    version: z.number().int().min(1).default(1),
    title: z.string().min(1).max(80),
    objective: z.string().min(1).max(280),
    metrics: z.array(MetricDefinitionSchema).max(16).default([]),
    rules: z.object({
      success: RuleExpressionSchema.optional(),
      failure: RuleExpressionSchema.optional(),
    }),
    countdownSeconds: z.number().int().min(0).max(30).default(3),
    timeLimitSeconds: z.number().int().min(1).max(86_400).optional(),
    verification: z.enum(["automatic", "moderator", "streamer"]).default("moderator"),
    presentation: z.array(PresentationHintSchema).max(16).default([]),
  })
  .superRefine((definition, ctx) => {
    const ids = new Set<string>();
    const metrics = new Map<string, MetricDefinition>();
    definition.metrics.forEach((metric, index) => {
      if (ids.has(metric.id)) {
        ctx.addIssue({ code: "custom", message: `Duplicate metric id: ${metric.id}`, path: ["metrics", index, "id"] });
      }
      ids.add(metric.id);
      metrics.set(metric.id, metric);
      if (metric.kind !== "flag" && metric.minimum !== undefined && metric.maximum !== undefined && metric.minimum > metric.maximum) {
        ctx.addIssue({ code: "custom", message: "Minimum exceeds maximum", path: ["metrics", index] });
      }
    });

    function checkRule(rule: RuleExpression | undefined, path: (string | number)[], depth = 0): void {
      if (!rule) return;
      if (depth > 8) {
        ctx.addIssue({ code: "custom", message: "Rule nesting exceeds eight levels", path });
        return;
      }
      if (rule.type === "timer_expired" && !definition.timeLimitSeconds) {
        ctx.addIssue({ code: "custom", message: "Timer rule requires a time limit", path });
      }
      if (rule.type === "compare") {
        const metric = metrics.get(rule.metric);
        if (!metric) ctx.addIssue({ code: "custom", message: `Unknown metric: ${rule.metric}`, path: [...path, "metric"] });
        else if ((metric.kind === "flag") !== (typeof rule.value === "boolean")) {
          ctx.addIssue({ code: "custom", message: "Rule value does not match metric kind", path: [...path, "value"] });
        }
      }
      if (rule.type === "all" || rule.type === "any") {
        rule.rules.forEach((child, index) => checkRule(child, [...path, "rules", index], depth + 1));
      }
    }
    checkRule(definition.rules.success, ["rules", "success"]);
    checkRule(definition.rules.failure, ["rules", "failure"]);

    definition.presentation.forEach((hint, index) => {
      if (hint.metric && !metrics.get(hint.metric)?.public) {
        ctx.addIssue({ code: "custom", message: `Presentation metric must be public: ${hint.metric}`, path: ["presentation", index, "metric"] });
      }
      if (["progress_bar", "counter", "flag"].includes(hint.component) && !hint.metric) {
        ctx.addIssue({ code: "custom", message: "Component requires a metric", path: ["presentation", index, "metric"] });
      }
    });
  });

export type ChallengeDefinition = z.infer<typeof ChallengeDefinitionSchema>;

export const ChallengeRunSchema = z.object({
  id: z.string().uuid(),
  definitionId: z.string(),
  definitionVersion: z.number().int().min(1),
  status: z.enum(["countdown", "active", "paused", "succeeded", "failed", "voided"]),
  metrics: z.record(z.string(), z.union([z.number(), z.boolean()])),
  revision: z.number().int().min(0),
  createdAt: z.string().datetime(),
  startsAt: z.string().datetime(),
  startedAt: z.string().datetime().nullable(),
  pausedAt: z.string().datetime().nullable().default(null),
  endsAt: z.string().datetime().nullable(),
  resolvedAt: z.string().datetime().nullable(),
  resolutionReason: z.string().max(240).nullable(),
});

export type ChallengeRun = z.infer<typeof ChallengeRunSchema>;

export const ChallengeEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("run.started") }),
  z.object({ type: z.literal("run.resumed") }),
  z.object({ type: z.literal("run.paused") }),
  z.object({ type: z.literal("timer.expired") }),
  z.object({
    type: z.literal("metric.incremented"),
    metric: z.string().min(1).max(64),
    by: z.number().finite(),
  }),
  z.object({
    type: z.literal("metric.set"),
    metric: z.string().min(1).max(64),
    value: z.union([z.number().finite(), z.boolean()]),
  }),
  z.object({
    type: z.literal("run.resolved"),
    result: z.enum(["succeeded", "failed", "voided"]),
    reason: z.string().min(1).max(240),
  }),
]);

export const ChallengeEventEnvelopeSchema = z.object({
  idempotencyKey: z.string().min(8).max(200),
  source: z.string().min(1).max(80),
  occurredAt: z.string().datetime().optional(),
  event: ChallengeEventSchema,
});

export type ChallengeEvent = z.infer<typeof ChallengeEventSchema>;
export type ChallengeEventEnvelope = z.infer<typeof ChallengeEventEnvelopeSchema>;

export const LiveMetricProjectionSchema = z.object({
  id: z.string(),
  kind: z.enum(["counter", "gauge", "flag"]),
  label: z.string(),
  value: z.union([z.number(), z.boolean()]),
  target: z.union([z.number(), z.boolean()]).nullable(),
});

export const LiveRunProjectionSchema = z.object({
  apiVersion: z.literal(FRAMEWORK_API_VERSION),
  runId: z.string().uuid(),
  revision: z.number().int().min(0),
  status: ChallengeRunSchema.shape.status,
  title: z.string(),
  objective: z.string(),
  startsAt: z.string().datetime(),
  pausedAt: z.string().datetime().nullable(),
  endsAt: z.string().datetime().nullable(),
  serverTime: z.string().datetime(),
  metrics: z.array(LiveMetricProjectionSchema),
  presentation: z.array(PresentationHintSchema),
  resolutionReason: z.string().nullable(),
});

export type LiveRunProjection = z.infer<typeof LiveRunProjectionSchema>;
