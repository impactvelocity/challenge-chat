export type JsonSchema = Record<string, unknown>;

export interface BoardToolDefinition {
  name: string;
  title: string;
  description: string;
  inputSchema: JsonSchema;
  readOnly: boolean;
  consequential?: boolean;
  untrustedOutput?: boolean;
}

const objectSchema = (properties: Record<string, unknown>, required: string[] = []): JsonSchema => ({
  type: "object",
  properties,
  ...(required.length ? { required } : {}),
  additionalProperties: false,
});

const challengeId = { type: "string", minLength: 1, description: "Challenge ID from get_board." };
const ballotId = { type: "string", minLength: 1, description: "Vote ID from get_board or open_vote." };

/** One tool catalog powers the bearer-token MCP endpoint and the signed-in WebMCP bridge. */
export const BOARD_TOOLS = [
  {
    name: "get_board",
    title: "Get board",
    description: "Read the selected Challenge.chat board, current round, suggestions, vote, scores, and leaderboard.",
    inputSchema: objectSchema({}),
    readOnly: true,
    untrustedOutput: true,
  },
  {
    name: "set_submissions",
    title: "Set submissions",
    description: "Open or pause viewer challenge submissions for the selected board.",
    inputSchema: objectSchema({ open: { type: "boolean", description: "True to accept suggestions into the current round." } }, ["open"]),
    readOnly: false,
  },
  {
    name: "create_challenge",
    title: "Create challenge",
    description: "Submit a viewer challenge to the selected board. The server parses and validates the suggestion.",
    inputSchema: objectSchema({
      text: { type: "string", minLength: 1, maxLength: 500, description: "The viewer's challenge request." },
      game: { type: "string", maxLength: 100, description: "Optional game name." },
      authorDisplayName: { type: "string", minLength: 1, maxLength: 40, description: "Viewer display name." },
      authorId: { type: "string", maxLength: 100, description: "Stable provider viewer ID when known." },
      authorLogin: { type: "string", maxLength: 40, description: "Viewer login when known." },
    }, ["text", "authorDisplayName"]),
    readOnly: false,
    untrustedOutput: true,
  },
  {
    name: "set_challenge_status",
    title: "Set challenge status",
    description: "Moderate a challenge by approving, queueing, rejecting, returning, or restoring it.",
    inputSchema: objectSchema({
      challengeId,
      status: { type: "string", enum: ["approved", "queued", "rejected", "inbox", "pending_review"] },
    }, ["challengeId", "status"]),
    readOnly: false,
  },
  {
    name: "update_challenge",
    title: "Update challenge",
    description: "Edit a pending or approved challenge while the round is collecting ideas.",
    inputSchema: objectSchema({
      challengeId,
      updates: {
        type: "object",
        minProperties: 1,
        additionalProperties: false,
        properties: {
          rawText: { type: "string", minLength: 1, maxLength: 500 },
          title: { type: "string", minLength: 1, maxLength: 64 },
          objective: { type: "string", minLength: 1, maxLength: 240 },
          game: { type: ["string", "null"], maxLength: 100 },
          context: { type: ["object", "null"] },
          targets: { type: "array", maxItems: 4 },
          constraints: { type: "array", maxItems: 8 },
          timeLimitSeconds: { type: ["integer", "null"], minimum: 5, maximum: 3600 },
          maxAttempts: { type: ["integer", "null"], minimum: 1, maximum: 99 },
          failureConditions: { type: "array", maxItems: 6, items: { type: "string", maxLength: 180 } },
          difficulty: { type: "string", enum: ["easy", "medium", "hard", "ridiculous"] },
          verificationMode: { type: "string", enum: ["moderator", "streamer", "chat-review"] },
          warnings: { type: "array", maxItems: 6, items: { type: "string", maxLength: 180 } },
          needsReview: { type: "boolean" },
        },
      },
    }, ["challengeId", "updates"]),
    readOnly: false,
    untrustedOutput: true,
  },
  {
    name: "start_challenge",
    title: "Start challenge",
    description: "Start a selected challenge on the board.",
    inputSchema: objectSchema({ challengeId }, ["challengeId"]),
    readOnly: false,
  },
  {
    name: "set_challenge_paused",
    title: "Pause or resume challenge",
    description: "Pause or resume the active challenge timer for the creator and every overlay.",
    inputSchema: objectSchema({ challengeId, paused: { type: "boolean" } }, ["challengeId", "paused"]),
    readOnly: false,
  },
  {
    name: "adjust_attempts",
    title: "Adjust attempts",
    description: "Add or remove one attempt from the active challenge.",
    inputSchema: objectSchema({ challengeId, delta: { type: "integer", enum: [-1, 1] } }, ["challengeId", "delta"]),
    readOnly: false,
  },
  {
    name: "resolve_challenge",
    title: "Resolve challenge",
    description: "Record the authoritative result of the active challenge.",
    inputSchema: objectSchema({
      challengeId,
      result: { type: "string", enum: ["streamer_won", "chat_won", "skipped", "voided"] },
    }, ["challengeId", "result"]),
    readOnly: false,
    consequential: true,
  },
  {
    name: "open_vote",
    title: "Open vote",
    description: "Open a timed viewer vote for a shortlist of challenge IDs.",
    inputSchema: objectSchema({
      challengeIds: { type: "array", minItems: 2, maxItems: 10, uniqueItems: true, items: challengeId },
      durationSeconds: { type: "integer", minimum: 10, maximum: 900 },
      winnersCount: { type: "integer", minimum: 1, maximum: 10 },
    }, ["challengeIds", "durationSeconds"]),
    readOnly: false,
  },
  {
    name: "reopen_vote",
    title: "Reopen vote",
    description: "Reopen a locked lineup's vote before any challenge starts, preserving existing viewer votes.",
    inputSchema: objectSchema({ durationSeconds: { type: "integer", minimum: 10, maximum: 900 } }, ["durationSeconds"]),
    readOnly: false,
  },
  {
    name: "close_vote",
    title: "Close vote",
    description: "Close the active vote and advance its winning challenges.",
    inputSchema: objectSchema({ ballotId }, ["ballotId"]),
    readOnly: false,
    consequential: true,
  },
  {
    name: "complete_round",
    title: "Complete round",
    description: "Finalize a fully resolved round and freeze its result.",
    inputSchema: objectSchema({}),
    readOnly: false,
    consequential: true,
  },
  {
    name: "set_round_name",
    title: "Set round name",
    description: "Set the display name of the current round.",
    inputSchema: objectSchema({ name: { type: "string", minLength: 1, maxLength: 60 } }, ["name"]),
    readOnly: false,
  },
  {
    name: "generate_round_name",
    title: "Generate round name",
    description: "Generate and save a round name from the selected challenge lineup using the board's configured naming behavior.",
    inputSchema: objectSchema({}),
    readOnly: false,
    untrustedOutput: true,
  },
  {
    name: "cancel_round",
    title: "Cancel round",
    description: "Cancel the current round, discard its score and vote, and keep unfinished suggestions in Inbox.",
    inputSchema: objectSchema({}),
    readOnly: false,
    consequential: true,
  },
  {
    name: "start_next_round",
    title: "Start next round",
    description: "Create the next collecting round after the current round is complete.",
    inputSchema: objectSchema({}),
    readOnly: false,
  },
] as const satisfies readonly BoardToolDefinition[];

export type BoardToolName = (typeof BOARD_TOOLS)[number]["name"];

export function isBoardToolName(value: string): value is BoardToolName {
  return BOARD_TOOLS.some((tool) => tool.name === value);
}
