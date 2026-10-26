import {
  FRAMEWORK_API_VERSION,
  type ChallengeDefinition,
  type ChallengeEvent,
  type ChallengeRun,
  type LiveRunProjection,
  type MetricDefinition,
  type MetricValue,
  type RuleExpression,
} from "./framework";

function initialValue(metric: MetricDefinition): MetricValue {
  return metric.initial;
}

function clampMetric(metric: MetricDefinition, value: number): number {
  if (metric.kind === "flag") return value;
  return Math.min(metric.maximum ?? Number.POSITIVE_INFINITY, Math.max(metric.minimum ?? Number.NEGATIVE_INFINITY, value));
}

function compare(actual: MetricValue | undefined, operator: Extract<RuleExpression, { type: "compare" }>["operator"], expected: MetricValue): boolean {
  if (actual === undefined || typeof actual !== typeof expected) return false;
  switch (operator) {
    case "eq": return actual === expected;
    case "neq": return actual !== expected;
    case "gt": return typeof actual === "number" && typeof expected === "number" && actual > expected;
    case "gte": return typeof actual === "number" && typeof expected === "number" && actual >= expected;
    case "lt": return typeof actual === "number" && typeof expected === "number" && actual < expected;
    case "lte": return typeof actual === "number" && typeof expected === "number" && actual <= expected;
  }
}

export function evaluateRule(rule: RuleExpression, run: ChallengeRun, now: Date): boolean {
  switch (rule.type) {
    case "compare": return compare(run.metrics[rule.metric], rule.operator, rule.value);
    case "timer_expired": return Boolean(run.endsAt && now.getTime() >= new Date(run.endsAt).getTime());
    case "all": return rule.rules.every((child) => evaluateRule(child, run, now));
    case "any": return rule.rules.some((child) => evaluateRule(child, run, now));
  }
}

export function createChallengeRun(definition: ChallengeDefinition, now = new Date()): ChallengeRun {
  const startsAtDate = new Date(now.getTime() + definition.countdownSeconds * 1000);
  return {
    id: crypto.randomUUID(),
    definitionId: definition.id ?? `inline:${definition.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`,
    definitionVersion: definition.version,
    status: definition.countdownSeconds > 0 ? "countdown" : "active",
    metrics: Object.fromEntries(definition.metrics.map((metric) => [metric.id, initialValue(metric)])),
    revision: 0,
    createdAt: now.toISOString(),
    startsAt: startsAtDate.toISOString(),
    startedAt: definition.countdownSeconds > 0 ? null : now.toISOString(),
    pausedAt: null,
    endsAt: definition.timeLimitSeconds
      ? new Date(startsAtDate.getTime() + definition.timeLimitSeconds * 1000).toISOString()
      : null,
    resolvedAt: null,
    resolutionReason: null,
  };
}

function resolveRules(definition: ChallengeDefinition, run: ChallengeRun, now: Date): ChallengeRun {
  if (run.status !== "active") return run;
  if (definition.rules.success && evaluateRule(definition.rules.success, run, now)) {
    return { ...run, status: "succeeded", resolvedAt: now.toISOString(), resolutionReason: "Success rule matched" };
  }
  if (definition.rules.failure && evaluateRule(definition.rules.failure, run, now)) {
    return { ...run, status: "failed", resolvedAt: now.toISOString(), resolutionReason: "Failure rule matched" };
  }
  return run;
}

export function applyChallengeEvent(
  definition: ChallengeDefinition,
  current: ChallengeRun,
  event: ChallengeEvent,
  occurredAt = new Date(),
): ChallengeRun {
  let run = { ...current, metrics: { ...current.metrics }, revision: current.revision + 1 };
  const terminal = new Set(["succeeded", "failed", "voided"]);
  if (terminal.has(run.status)) throw new Error("The run is already resolved");
  if (
    run.status === "active" && run.endsAt && occurredAt.getTime() >= new Date(run.endsAt).getTime() &&
    event.type !== "timer.expired" && event.type !== "run.resolved"
  ) {
    throw new Error("The run deadline has passed");
  }

  switch (event.type) {
    case "run.started":
      if (run.status !== "countdown" || occurredAt.getTime() < new Date(run.startsAt).getTime()) {
        throw new Error("The countdown has not completed");
      }
      run.status = "active";
      run.startedAt = occurredAt.toISOString();
      break;
    case "run.resumed":
      if (run.status !== "paused" || !run.pausedAt) throw new Error("The run is not paused");
      if (run.endsAt) {
        const pauseDuration = occurredAt.getTime() - new Date(run.pausedAt).getTime();
        run.endsAt = new Date(new Date(run.endsAt).getTime() + Math.max(0, pauseDuration)).toISOString();
      }
      run.pausedAt = null;
      run.status = "active";
      break;
    case "run.paused":
      if (run.status !== "active") throw new Error("The run is not active");
      run.status = "paused";
      run.pausedAt = occurredAt.toISOString();
      break;
    case "timer.expired":
      if (run.status !== "active" || !run.endsAt || occurredAt.getTime() < new Date(run.endsAt).getTime()) {
        throw new Error("The timer has not expired");
      }
      break;
    case "metric.incremented": {
      if (run.status !== "active") throw new Error("Metrics can only change while a run is active");
      const metric = definition.metrics.find((candidate) => candidate.id === event.metric);
      if (!metric || metric.kind === "flag") throw new Error(`Numeric metric not found: ${event.metric}`);
      const currentValue = run.metrics[event.metric];
      if (typeof currentValue !== "number") throw new Error(`Metric is not numeric: ${event.metric}`);
      run.metrics[event.metric] = clampMetric(metric, currentValue + event.by);
      break;
    }
    case "metric.set": {
      if (run.status !== "active") throw new Error("Metrics can only change while a run is active");
      const metric = definition.metrics.find((candidate) => candidate.id === event.metric);
      if (!metric) throw new Error(`Metric not found: ${event.metric}`);
      if (metric.kind === "flag" && typeof event.value !== "boolean") throw new Error(`Flag requires a boolean: ${event.metric}`);
      if (metric.kind !== "flag" && typeof event.value !== "number") throw new Error(`Numeric metric requires a number: ${event.metric}`);
      run.metrics[event.metric] = typeof event.value === "number" ? clampMetric(metric, event.value) : event.value;
      break;
    }
    case "run.resolved":
      if (run.status !== "active" && run.status !== "paused") throw new Error("The run is not active");
      run.status = event.result;
      run.resolvedAt = occurredAt.toISOString();
      run.resolutionReason = event.reason;
      return run;
  }

  return resolveRules(definition, run, occurredAt);
}

function findTarget(rule: RuleExpression | undefined, metric: string): MetricValue | null {
  if (!rule) return null;
  if (rule.type === "compare" && rule.metric === metric) return rule.value;
  if (rule.type === "all" || rule.type === "any") {
    for (const child of rule.rules) {
      const target = findTarget(child, metric);
      if (target !== null) return target;
    }
  }
  return null;
}

export function projectLiveRun(definition: ChallengeDefinition, run: ChallengeRun, now = new Date()): LiveRunProjection {
  return {
    apiVersion: FRAMEWORK_API_VERSION,
    runId: run.id,
    revision: run.revision,
    status: run.status,
    title: definition.title,
    objective: definition.objective,
    startsAt: run.startsAt,
    pausedAt: run.pausedAt ?? null,
    endsAt: run.endsAt,
    serverTime: now.toISOString(),
    metrics: definition.metrics
      .filter((metric) => metric.public)
      .map((metric) => ({
        id: metric.id,
        kind: metric.kind,
        label: metric.label,
        value: run.metrics[metric.id],
        target: findTarget(definition.rules.success, metric.id),
      })),
    presentation: definition.presentation,
    resolutionReason: run.resolutionReason,
  };
}
