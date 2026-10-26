import { z } from "zod";
import { ChallengeDraftSchema, type ChallengeDraft } from "../shared/contracts";

export interface ParserEnv {
  AI?: {
    run(model: string, input: unknown, options?: unknown): Promise<unknown>;
    aiGatewayLogId?: string;
  };
  AI_MODEL?: string;
  AI_GATEWAY_ID?: string;
}

export interface ParsedChallenge {
  challenge: ChallengeDraft;
  parserStatus: "ai" | "fallback";
}

export type RoundNameTone = "playful" | "hype" | "straight";

export interface GeneratedRoundName {
  name: string;
  generatorStatus: "ai" | "fallback";
}

const numberWords: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

function readNumber(value: string): number | null {
  const numeric = Number.parseInt(value, 10);
  if (Number.isFinite(numeric)) return numeric;
  return numberWords[value.toLowerCase()] ?? null;
}

function cleanTitle(text: string): string {
  const words = text
    .replace(/^\s*(please\s+)?(do|land|get|win|complete|make)\s+/i, "")
    .replace(/[^a-zA-Z0-9' -]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5);

  const title = words.map((word) => word[0]?.toUpperCase() + word.slice(1)).join(" ");
  return (title || "Untitled Challenge").slice(0, 64);
}

export function fallbackParseChallenge(text: string, game?: string | null): ChallengeDraft {
  const normalized = text.trim().slice(0, 500);
  const numberPattern = "(\\d+|one|two|three|four|five|six|seven|eight|nine|ten)";
  const timeMatch = normalized.match(new RegExp(`${numberPattern}\\s*(seconds?|secs?|minutes?|mins?)`, "i"));
  const attemptMatch = normalized.match(new RegExp(`${numberPattern}\\s*(attempts?|tries|try|shots?)`, "i"));
  const targetMatch = normalized.match(
    new RegExp(`${numberPattern}\\s+([a-z][a-z -]{2,40}?)(?:\\s+in a row|\\s+consecutively|,|$)`, "i"),
  );
  const contextMatch = normalized.match(/(?:on|in|at)\s+(?:the\s+)?([a-z0-9' -]{2,50}?)(?:\s+(?:level|map|course|stage))?(?:,|\s+with|\s+in\s+\d|$)/i);

  const timeValue = timeMatch ? readNumber(timeMatch[1]) : null;
  const timeLimitSeconds = timeValue
    ? /min/i.test(timeMatch?.[2] ?? "")
      ? timeValue * 60
      : timeValue
    : null;
  const maxAttempts = attemptMatch ? readNumber(attemptMatch[1]) : /one[- ]shot/i.test(normalized) ? 1 : null;
  const targetValue = targetMatch ? readNumber(targetMatch[1]) : null;
  const requiresStreak = /in a row|consecutive/i.test(normalized);
  const hardSignals = [requiresStreak, maxAttempts === 1, /eyes? closed|no look|blind/i.test(normalized)].filter(Boolean).length;

  return ChallengeDraftSchema.parse({
    schemaVersion: 1,
    rawText: normalized,
    title: cleanTitle(normalized),
    objective: normalized.charAt(0).toUpperCase() + normalized.slice(1),
    game: game?.trim() || null,
    context: contextMatch
      ? {
          scope: /level/i.test(normalized) ? "level" : /map/i.test(normalized) ? "map" : "location",
          label: contextMatch[1].trim().replace(/\b\w/g, (letter) => letter.toUpperCase()),
        }
      : null,
    targets:
      targetValue && targetMatch
        ? [
            {
              label: targetMatch[2].trim().replace(/\b\w/g, (letter) => letter.toUpperCase()),
              value: targetValue,
              comparison: "at_least",
              requiresStreak,
            },
          ]
        : [],
    constraints: [],
    timeLimitSeconds,
    maxAttempts,
    failureConditions: [],
    difficulty: hardSignals >= 2 ? "hard" : hardSignals === 1 ? "medium" : "medium",
    verificationMode: "moderator",
    warnings: ["Review the automatically extracted fields before approving."],
    needsReview: true,
  });
}

function extractResponseText(payload: unknown): string | null {
  if (typeof payload === "string") return payload;
  if (!payload || typeof payload !== "object") return null;
  const response = (payload as { response?: unknown }).response;
  if (typeof response === "string") return response;
  const choices = (payload as { choices?: unknown }).choices;
  if (Array.isArray(choices)) {
    const content = (choices[0] as { message?: { content?: unknown } } | undefined)?.message?.content;
    if (typeof content === "string") return content;
  }
  const output = (payload as { output?: unknown }).output;
  if (!Array.isArray(output)) return null;

  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (
        part &&
        typeof part === "object" &&
        (part as { type?: unknown }).type === "output_text" &&
        typeof (part as { text?: unknown }).text === "string"
      ) {
        return (part as { text: string }).text;
      }
    }
  }

  return null;
}

async function gatewayJson<T>(env: ParserEnv, name: string, instructions: string, input: unknown, outputSchema: z.ZodType<T>): Promise<T> {
  if (!env.AI) throw new Error("Cloudflare AI binding is unavailable");
  const schema = z.toJSONSchema(outputSchema) as Record<string, unknown>;
  delete schema.$schema;
  const payload = await env.AI.run(
    env.AI_MODEL || "openai/gpt-4.1-mini",
    {
      messages: [
        { role: "system", content: instructions },
        { role: "user", content: JSON.stringify(input) },
      ],
      temperature: 0.2,
      response_format: { type: "json_schema", json_schema: { name, strict: true, schema } },
    },
    {
      gateway: {
        id: env.AI_GATEWAY_ID || "default",
        skipCache: true,
        collectLog: true,
        metadata: { feature: name },
      },
    },
  );
  const outputText = extractResponseText(payload);
  if (!outputText) throw new Error("AI Gateway returned no structured output");
  return outputSchema.parse(JSON.parse(outputText));
}

async function parseWithGateway(text: string, game: string | null, env: ParserEnv, writeTitle: boolean): Promise<ChallengeDraft> {
  const parsed = await gatewayJson(
    env,
    "challenge_draft",
    [
      "Convert a viewer's livestream challenge into the supplied JSON schema.",
      "Clean up spelling and grammar without changing the viewer's intent.",
      "Extract only constraints that are explicitly stated.",
      "Use null and empty arrays when information is absent.",
      "Keep the objective concise and imperative.",
      "Flag ambiguity, danger, harassment, or likely impossibility in warnings and set needsReview true.",
      "Never add a punishment, wager, or physical risk that the viewer did not request.",
    ].join(" "),
    { text, game },
    ChallengeDraftSchema,
  );
  return {
    ...parsed,
    rawText: text.trim().slice(0, 500),
    game: parsed.game ?? game,
    title: writeTitle ? parsed.title : cleanTitle(text),
  };
}

export async function parseChallenge(
  text: string,
  game: string | null,
  env: ParserEnv,
  options: { enabled?: boolean; writeTitle?: boolean } = {},
): Promise<ParsedChallenge> {
  const safeText = text.trim().slice(0, 500);
  if (!safeText) throw new Error("Challenge text is required");

  if (options.enabled !== false && env.AI) {
    try {
      return {
        challenge: await parseWithGateway(safeText, game, env, options.writeTitle !== false),
        parserStatus: "ai",
      };
    } catch (error) {
      console.warn("Falling back to deterministic challenge parsing after AI Gateway failure", error);
    }
  }

  return {
    challenge: fallbackParseChallenge(safeText, game),
    parserStatus: "fallback",
  };
}

function fallbackRoundName(challenges: { title: string; game: string | null }[], tone: RoundNameTone): string {
  const game = challenges.find((challenge) => challenge.game)?.game;
  const lead = challenges[0]?.title || "Challenge Round";
  if (tone === "straight") return `${game ? `${game}: ` : ""}${challenges.length} Challenge${challenges.length === 1 ? "" : "s"}`.slice(0, 60);
  if (tone === "hype") return `${lead} Gauntlet`.slice(0, 60);
  return `${lead} & Friends`.slice(0, 60);
}

export async function generateRoundName(
  challenges: { title: string; objective: string; game: string | null }[],
  tone: RoundNameTone,
  env: ParserEnv,
  previousNames: string[] = [],
): Promise<GeneratedRoundName> {
  const normalize = (value: string) => value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const excluded = new Set(previousNames.map(normalize));
  if (env.AI) {
    try {
      const result = await gatewayJson(
        env,
        "round_name",
        `Name a livestream challenge round in a ${tone} tone. Return a memorable title only, 2–7 words, maximum 60 characters. Do not include quotes, a colon suffix, or claims not supported by the lineup.`,
        { challenges, avoidNames: previousNames, instruction: "Choose a fresh name, different in wording from every avoidNames entry." },
        z.object({ name: z.string().trim().min(2).max(60) }),
      );
      if (!excluded.has(normalize(result.name))) return { name: result.name, generatorStatus: "ai" };
    } catch (error) {
      console.warn("Falling back to deterministic round naming after AI Gateway failure", error);
    }
  }
  const base = fallbackRoundName(challenges, tone);
  if (!excluded.has(normalize(base))) return { name: base, generatorStatus: "fallback" };
  // A repeated response must not spend another call or return a duplicate.
  for (let variant = 1; ; variant++) {
    const suffix = variant === 1 ? " Remix" : ` Remix ${variant}`;
    const name = base.slice(0, 60 - suffix.length).trimEnd() + suffix;
    if (!excluded.has(normalize(name))) return { name, generatorStatus: "fallback" };
  }
}
