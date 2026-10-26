export function boardOpenApi(origin: string, channelId: string) {
  const channel = { name: "channel", in: "query", required: true, schema: { type: "string" }, example: channelId };
  const bearer = [{ boardToken: [] }];
  const operation = (summary: string, requestBody?: unknown, pathParameters: string[] = []) => ({
    summary,
    security: bearer,
    parameters: [channel, ...pathParameters.map((name) => ({ name, in: "path", required: true, schema: { type: "string" } }))],
    ...(requestBody ? { requestBody: { required: true, content: { "application/json": { schema: requestBody } } } } : {}),
    responses: { "200": { description: "Success" }, "400": { description: "Invalid operation" }, "401": { description: "Missing or invalid board token" } },
  });
  return {
    openapi: "3.1.0",
    info: { title: "Challenge.chat Board API", version: "2026-10-25", description: "Channel-scoped control API. Integrations report facts through the separate live-run event API." },
    servers: [{ url: origin }],
    components: { securitySchemes: { boardToken: { type: "http", scheme: "bearer", bearerFormat: "ccat_*" } } },
    paths: {
      "/api/v1/board": { get: operation("Read the current board") },
      "/api/v1/board/submissions": { patch: operation("Open or pause submissions", { type: "object", properties: { open: { type: "boolean" } }, required: ["open"] }) },
      "/api/v1/board/challenges": { post: operation("Create a challenge", { type: "object", properties: { text: { type: "string" }, game: { type: "string" }, authorDisplayName: { type: "string" }, authorId: { type: "string" }, authorLogin: { type: "string" } }, required: ["text", "authorDisplayName"] }) },
      "/api/v1/board/challenges/{challengeId}": { patch: operation("Edit a pending or approved challenge while collecting", { type: "object", minProperties: 1, additionalProperties: true }, ["challengeId"]) },
      "/api/v1/board/challenges/{challengeId}/pause": { post: operation("Pause or resume the active challenge", { type: "object", properties: { paused: { type: "boolean" } }, required: ["paused"] }, ["challengeId"]) },
      "/api/v1/board/challenges/{challengeId}/status": { post: operation("Moderate a challenge", { type: "object", properties: { status: { type: "string", enum: ["approved", "queued", "rejected", "inbox", "pending_review"] } }, required: ["status"] }, ["challengeId"]) },
      "/api/v1/board/challenges/{challengeId}/start": { post: operation("Start a challenge", undefined, ["challengeId"]) },
      "/api/v1/board/challenges/{challengeId}/attempt": { post: operation("Adjust attempts", { type: "object", properties: { delta: { type: "integer", enum: [-1, 1] } }, required: ["delta"] }, ["challengeId"]) },
      "/api/v1/board/challenges/{challengeId}/resolve": { post: operation("Resolve a challenge", { type: "object", properties: { result: { type: "string", enum: ["streamer_won", "chat_won", "skipped", "voided"] } }, required: ["result"] }, ["challengeId"]) },
      "/api/v1/board/ballots": { post: operation("Open a vote", { type: "object", properties: { challengeIds: { type: "array", items: { type: "string" } }, durationSeconds: { type: "integer", minimum: 10, maximum: 900 }, winnersCount: { type: "integer", minimum: 1, maximum: 10 } }, required: ["challengeIds", "durationSeconds"] }) },
      "/api/v1/board/ballots/{ballotId}/close": { post: operation("Close a vote", undefined, ["ballotId"]) },
      "/api/v1/board/session/complete": { post: operation("Complete the round") },
      "/api/v1/board/session/cancel": { post: operation("Cancel the round") },
      "/api/v1/board/session/name": { patch: operation("Set the round name", { type: "object", properties: { name: { type: "string", minLength: 1, maxLength: 60 } }, required: ["name"] }) },
      "/api/v1/board/session/name/generate": { post: operation("Generate and save a round name") },
      "/api/v1/board/sessions": { post: operation("Start the next round") },
      "/api/v1/board/tools/{toolName}": { post: operation("Call a board tool by name", { type: "object", additionalProperties: true }, ["toolName"]) },
    },
  };
}
