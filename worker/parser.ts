import { z } from "zod";
import { ChallengeDraftSchema, type ChallengeDraft } from "../shared/contracts";

export interface ParserEnv {
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
}

export interface ParsedChallenge {
  challenge: ChallengeDraft;
  parserStatus: "ai" | "fallback";
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
  if (!payload || typeof payload !== "object") return null;
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

async function parseWithOpenAI(text: string, game: string | null, env: ParserEnv): Promise<ChallengeDraft> {
  const schema = z.toJSONSchema(ChallengeDraftSchema) as Record<string, unknown>;
  delete schema.$schema;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL || "gpt-6-astra",
      store: false,
      instructions: [
        "Convert a viewer's livestream challenge into the supplied schema.",
        "Extract only constraints that are explicitly stated.",
        "Use null and empty arrays when information is absent.",
        "Keep the objective concise and imperative without changing its meaning.",
        "Flag ambiguity, danger, harassment, or likely impossibility in warnings and set needsReview true.",
        "Never add a punishment, wager, or physical risk that the viewer did not request.",
      ].join(" "),
      input: JSON.stringify({ text, game }),
      text: {
        format: {
          type: "json_schema",
          name: "challenge_draft",
          strict: true,
          schema,
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI parser request failed with ${response.status}`);
  }

  const payload = (await response.json()) as unknown;
  const outputText = extractResponseText(payload);
  if (!outputText) throw new Error("OpenAI parser returned no structured output");

  const parsed = ChallengeDraftSchema.parse(JSON.parse(outputText));
  return {
    ...parsed,
    rawText: text.trim().slice(0, 500),
    game: parsed.game ?? game,
  };
}

export async function parseChallenge(text: string, game: string | null, env: ParserEnv): Promise<ParsedChallenge> {
  const safeText = text.trim().slice(0, 500);
  if (!safeText) throw new Error("Challenge text is required");

  if (env.OPENAI_API_KEY) {
    try {
      return {
        challenge: await parseWithOpenAI(safeText, game, env),
        parserStatus: "ai",
      };
    } catch (error) {
      console.warn("Falling back to deterministic challenge parsing", error);
    }
  }

  return {
    challenge: fallbackParseChallenge(safeText, game),
    parserStatus: "fallback",
  };
}
