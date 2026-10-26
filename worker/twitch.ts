import { normalizeTwitchEvent, type TwitchFact } from "../integrations/twitch/eventsub";
import { TWITCH_REQUIRED_SCOPES, type TwitchConnectionStatus } from "../shared/twitch";
import { AuthError, sha256 } from "./auth";

export interface TwitchEnv {
  DB: D1Database;
  TWITCH_CLIENT_ID?: string;
  TWITCH_CLIENT_SECRET?: string;
  TWITCH_EVENTSUB_SECRET?: string;
}

interface TwitchConfiguration {
  clientId: string;
  clientSecret: string;
  eventsubSecret: string;
  applicationUrl: string;
  callbackUrl: string;
  eventsubUrl: string;
}

export interface TwitchAppConfigurationInput {
  clientId?: string;
  clientSecret?: string;
}

interface TwitchTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string[];
  token_type?: string;
  message?: string;
}

interface TwitchValidationResponse {
  client_id?: string;
  login?: string;
  scopes?: string[];
  user_id?: string;
  expires_in?: number;
  message?: string;
}

interface StoredSubscription {
  id: string;
  type: string;
  status: string;
}

interface SubscriptionEnvelope {
  challenge?: string;
  subscription?: {
    id?: string;
    status?: string;
    type?: string;
    condition?: { broadcaster_user_id?: string };
  };
  event?: unknown;
}

const OAUTH_STATE_MS = 10 * 60 * 1000;
const MESSAGE_MAX_AGE_MS = 10 * 60 * 1000;
const EVENT_RETENTION_MS = 24 * 60 * 60 * 1000;
const EVENTSUB_TYPES = [
  { type: "channel.chat.message", version: "1", condition: (id: string) => ({ broadcaster_user_id: id, user_id: id }) },
  { type: "channel.chat.notification", version: "1", condition: (id: string) => ({ broadcaster_user_id: id, user_id: id }) },
  { type: "channel.follow", version: "2", condition: (id: string) => ({ broadcaster_user_id: id, moderator_user_id: id }) },
  { type: "channel.cheer", version: "1", condition: (id: string) => ({ broadcaster_user_id: id }) },
] as const;

function randomHex(bytes = 32): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function configuration(request: Request, env: TwitchEnv): Promise<TwitchConfiguration & {
  missing: string[];
  source: "database" | "worker" | "none";
}> {
  const origin = new URL(request.url).origin;
  const stored = await env.DB.prepare(
    "SELECT client_id AS clientId, client_secret AS clientSecret, eventsub_secret AS eventsubSecret FROM twitch_app_configuration WHERE id = 1",
  ).first<{ clientId: string; clientSecret: string; eventsubSecret: string }>();
  const values = {
    clientId: stored?.clientId.trim() || env.TWITCH_CLIENT_ID?.trim() || "",
    clientSecret: stored?.clientSecret.trim() || env.TWITCH_CLIENT_SECRET?.trim() || "",
    eventsubSecret: stored?.eventsubSecret.trim() || env.TWITCH_EVENTSUB_SECRET?.trim() || "",
  };
  const missing = [
    !values.clientId ? "TWITCH_CLIENT_ID" : null,
    !values.clientSecret ? "TWITCH_CLIENT_SECRET" : null,
    !values.eventsubSecret ? "TWITCH_EVENTSUB_SECRET" : null,
    values.eventsubSecret && (values.eventsubSecret.length < 10 || values.eventsubSecret.length > 100)
      ? "TWITCH_EVENTSUB_SECRET (must be 10–100 characters)"
      : null,
  ].filter((value): value is string => Boolean(value));
  return {
    ...values,
    missing,
    source: stored ? "database" : Object.values(values).some(Boolean) ? "worker" : "none",
    applicationUrl: origin,
    callbackUrl: `${origin}/api/twitch/oauth/callback`,
    eventsubUrl: `${origin}/api/twitch/eventsub`,
  };
}

async function configured(request: Request, env: TwitchEnv): Promise<TwitchConfiguration> {
  const config = await configuration(request, env);
  if (config.missing.length) throw new AuthError(`Configure ${config.missing.join(", ")} on this Worker first`, 503);
  return config;
}

export async function saveTwitchConfiguration(
  env: TwitchEnv,
  input: TwitchAppConfigurationInput,
): Promise<void> {
  const clientId = input.clientId?.trim() ?? "";
  const clientSecret = input.clientSecret?.trim() ?? "";
  if (!/^\S{5,200}$/.test(clientId)) throw new AuthError("Enter the Client ID from Twitch Manage", 400);
  if (!/^\S{10,500}$/.test(clientSecret)) throw new AuthError("Enter the Client Secret from Twitch Manage", 400);
  const active = await env.DB.prepare("SELECT COUNT(*) AS total FROM twitch_connections").first<{ total: number }>();
  if (Number(active?.total ?? 0) > 0) {
    throw new AuthError("Disconnect every Twitch channel before replacing the application credentials", 409);
  }
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO twitch_app_configuration (id, client_id, client_secret, eventsub_secret, updated_at)
       VALUES (1, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET client_id = excluded.client_id, client_secret = excluded.client_secret,
         eventsub_secret = excluded.eventsub_secret, updated_at = excluded.updated_at`,
    ).bind(clientId, clientSecret, randomHex(), Date.now()),
    env.DB.prepare("DELETE FROM twitch_oauth_states"),
  ]);
}

async function twitchJson<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = await response.json() as T & { message?: string };
  if (!response.ok) throw new Error(payload.message || `Twitch request failed (${response.status})`);
  return payload;
}

async function appAccessToken(config: TwitchConfiguration): Promise<string> {
  const form = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "client_credentials",
  });
  const token = await twitchJson<TwitchTokenResponse>("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  if (!token.access_token) throw new Error("Twitch did not return an app access token");
  return token.access_token;
}

async function deleteSubscription(config: TwitchConfiguration, accessToken: string, id: string): Promise<void> {
  const url = new URL("https://api.twitch.tv/helix/eventsub/subscriptions");
  url.searchParams.set("id", id);
  const response = await fetch(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}`, "Client-Id": config.clientId },
  });
  if (!response.ok && response.status !== 404) throw new Error(`Could not remove Twitch subscription (${response.status})`);
}

async function createSubscription(
  config: TwitchConfiguration,
  accessToken: string,
  definition: (typeof EVENTSUB_TYPES)[number],
  broadcasterUserId: string,
): Promise<StoredSubscription> {
  const payload = await twitchJson<{ data?: Array<{ id: string; type: string; status: string }> }>("https://api.twitch.tv/helix/eventsub/subscriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Client-Id": config.clientId,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: definition.type,
      version: definition.version,
      condition: definition.condition(broadcasterUserId),
      transport: { method: "webhook", callback: config.eventsubUrl, secret: config.eventsubSecret },
    }),
  });
  const subscription = payload.data?.[0];
  if (!subscription) throw new Error(`Twitch did not create the ${definition.type} subscription`);
  return subscription;
}

function redirectToSettings(request: Request, channelId: string, result: string): Response {
  const target = new URL("/settings/twitch", request.url);
  target.searchParams.set("channel", channelId);
  target.searchParams.set("twitch", result);
  return Response.redirect(target.toString(), 302);
}

export async function twitchStatus(request: Request, env: TwitchEnv, channelId: string): Promise<TwitchConnectionStatus> {
  const config = await configuration(request, env);
  const connection = await env.DB.prepare(
    `SELECT broadcaster_user_id AS broadcasterUserId, broadcaster_login AS broadcasterLogin,
      broadcaster_display_name AS broadcasterDisplayName, scopes_json AS scopesJson, status,
      connected_at AS connectedAt, last_event_at AS lastEventAt, last_error AS lastError
      FROM twitch_connections WHERE channel_id = ?`,
  ).bind(channelId).first<{
    broadcasterUserId: string;
    broadcasterLogin: string;
    broadcasterDisplayName: string;
    scopesJson: string;
    status: string;
    connectedAt: number;
    lastEventAt: number | null;
    lastError: string | null;
  }>();
  const subscriptions = connection
    ? (await env.DB.prepare(
      "SELECT id, type, status FROM twitch_eventsub_subscriptions WHERE channel_id = ? ORDER BY type",
    ).bind(channelId).all<StoredSubscription>()).results
    : [];
  return {
    configuration: {
      ready: config.missing.length === 0,
      missing: config.missing,
      source: config.source,
      clientId: config.clientId,
      applicationUrl: config.applicationUrl,
      callbackUrl: config.callbackUrl,
      eventsubUrl: config.eventsubUrl,
      requiredScopes: [...TWITCH_REQUIRED_SCOPES],
    },
    connection: connection ? {
      ...connection,
      scopes: JSON.parse(connection.scopesJson) as string[],
      subscriptions,
    } : null,
  };
}

export async function startTwitchOAuth(request: Request, env: TwitchEnv, channelId: string): Promise<{ authorizationUrl: string }> {
  const config = await configured(request, env);
  const state = randomHex();
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM twitch_oauth_states WHERE expires_at <= ?").bind(now),
    env.DB.prepare("INSERT INTO twitch_oauth_states (state_hash, channel_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
      .bind(await sha256(state), channelId, now, now + OAUTH_STATE_MS),
  ]);
  const authorization = new URL("https://id.twitch.tv/oauth2/authorize");
  authorization.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.callbackUrl,
    response_type: "code",
    scope: TWITCH_REQUIRED_SCOPES.join(" "),
    state,
  }).toString();
  return { authorizationUrl: authorization.toString() };
}

export async function finishTwitchOAuth(request: Request, env: TwitchEnv): Promise<Response> {
  const config = await configured(request, env);
  const url = new URL(request.url);
  const state = url.searchParams.get("state") ?? "";
  if (!/^[a-f0-9]{64}$/.test(state)) throw new AuthError("The Twitch connection link is invalid or expired", 400);
  const consumed = await env.DB.prepare(
    "DELETE FROM twitch_oauth_states WHERE state_hash = ? AND expires_at > ? RETURNING channel_id AS channelId",
  ).bind(await sha256(state), Date.now()).first<{ channelId: string }>();
  if (!consumed) throw new AuthError("The Twitch connection link is invalid or expired", 400);
  if (url.searchParams.get("error")) return redirectToSettings(request, consumed.channelId, "denied");
  const code = url.searchParams.get("code");
  if (!code) throw new AuthError("Twitch did not return an authorization code", 400);

  const token = await twitchJson<TwitchTokenResponse>("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: config.callbackUrl,
    }),
  });
  if (!token.access_token) throw new Error("Twitch did not return a user access token");
  const identity = await twitchJson<TwitchValidationResponse>("https://id.twitch.tv/oauth2/validate", {
    headers: { Authorization: `OAuth ${token.access_token}` },
  });
  if (!identity.user_id || !identity.login) throw new Error("Twitch did not return the broadcaster identity");
  const scopes = identity.scopes ?? token.scope ?? [];
  const missingScopes = TWITCH_REQUIRED_SCOPES.filter((scope) => !scopes.includes(scope));
  if (missingScopes.length) throw new AuthError(`Twitch did not grant: ${missingScopes.join(", ")}`, 400);
  const otherBoard = await env.DB.prepare(
    "SELECT channel_id AS channelId FROM twitch_connections WHERE broadcaster_user_id = ? AND channel_id != ? LIMIT 1",
  ).bind(identity.user_id, consumed.channelId).first<{ channelId: string }>();
  if (otherBoard) throw new AuthError("That Twitch broadcaster is already connected to another board in this deployment", 409);

  const appToken = await appAccessToken(config);
  const previous = (await env.DB.prepare(
    "SELECT id, type, status FROM twitch_eventsub_subscriptions WHERE channel_id = ?",
  ).bind(consumed.channelId).all<StoredSubscription>()).results;
  await Promise.all(previous.map((subscription) => deleteSubscription(config, appToken, subscription.id).catch(() => undefined)));
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM twitch_eventsub_subscriptions WHERE channel_id = ?").bind(consumed.channelId),
    env.DB.prepare(
      `INSERT INTO twitch_connections
        (channel_id, broadcaster_user_id, broadcaster_login, broadcaster_display_name, scopes_json, status, connected_at, updated_at, last_error)
       VALUES (?, ?, ?, ?, ?, 'connecting', ?, ?, NULL)
       ON CONFLICT(channel_id) DO UPDATE SET broadcaster_user_id = excluded.broadcaster_user_id,
         broadcaster_login = excluded.broadcaster_login, broadcaster_display_name = excluded.broadcaster_display_name,
         scopes_json = excluded.scopes_json, status = 'connecting', connected_at = excluded.connected_at,
         updated_at = excluded.updated_at, last_error = NULL`,
    ).bind(consumed.channelId, identity.user_id, identity.login, identity.login, JSON.stringify(scopes), now, now),
  ]);

  const created: StoredSubscription[] = [];
  try {
    for (const definition of EVENTSUB_TYPES) {
      const subscription = await createSubscription(config, appToken, definition, identity.user_id);
      created.push(subscription);
      await env.DB.prepare(
        "INSERT INTO twitch_eventsub_subscriptions (id, channel_id, type, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      ).bind(subscription.id, consumed.channelId, subscription.type, subscription.status, now, now).run();
    }
  } catch (error) {
    await Promise.all(created.map((subscription) => deleteSubscription(config, appToken, subscription.id).catch(() => undefined)));
    const description = error instanceof Error ? error.message : "Could not create Twitch subscriptions";
    await env.DB.prepare("UPDATE twitch_connections SET status = 'error', last_error = ?, updated_at = ? WHERE channel_id = ?")
      .bind(description.slice(0, 500), Date.now(), consumed.channelId).run();
    throw error;
  }
  return redirectToSettings(request, consumed.channelId, "connected");
}

export async function disconnectTwitch(request: Request, env: TwitchEnv, channelId: string): Promise<void> {
  const subscriptions = (await env.DB.prepare(
    "SELECT id, type, status FROM twitch_eventsub_subscriptions WHERE channel_id = ?",
  ).bind(channelId).all<StoredSubscription>()).results;
  const config = await configuration(request, env);
  if (!config.missing.length) {
    try {
      const token = await appAccessToken(config);
      await Promise.all(subscriptions.map((subscription) => deleteSubscription(config, token, subscription.id).catch(() => undefined)));
    } catch {
      // Local state still disconnects; Twitch will eventually revoke unreachable subscriptions.
    }
  }
  await env.DB.prepare("DELETE FROM twitch_connections WHERE channel_id = ?").bind(channelId).run();
}

function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

async function signature(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
  return `sha256=${Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

async function refreshConnectionStatus(db: D1Database, channelId: string): Promise<void> {
  const counts = await db.prepare(
    "SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'enabled' THEN 1 ELSE 0 END) AS enabled FROM twitch_eventsub_subscriptions WHERE channel_id = ?",
  ).bind(channelId).first<{ total: number; enabled: number }>();
  const status = counts && Number(counts.total) === EVENTSUB_TYPES.length && Number(counts.enabled) === EVENTSUB_TYPES.length ? "connected" : "connecting";
  await db.prepare("UPDATE twitch_connections SET status = ?, updated_at = ? WHERE channel_id = ?").bind(status, Date.now(), channelId).run();
}

export async function handleTwitchWebhook(
  request: Request,
  env: TwitchEnv,
  context: ExecutionContext,
  processFact: (channelId: string, fact: TwitchFact, messageId: string) => Promise<void>,
): Promise<Response> {
  const config = await configured(request, env);
  const messageId = request.headers.get("Twitch-Eventsub-Message-Id") ?? "";
  const timestamp = request.headers.get("Twitch-Eventsub-Message-Timestamp") ?? "";
  const providedSignature = request.headers.get("Twitch-Eventsub-Message-Signature") ?? "";
  const messageType = request.headers.get("Twitch-Eventsub-Message-Type") ?? "";
  const sentAt = Date.parse(timestamp);
  if (!messageId || !Number.isFinite(sentAt) || Math.abs(Date.now() - sentAt) > MESSAGE_MAX_AGE_MS) {
    throw new AuthError("Stale or incomplete Twitch EventSub message", 403);
  }
  const rawBody = await request.text();
  const expected = await signature(config.eventsubSecret, `${messageId}${timestamp}${rawBody}`);
  if (!safeEqual(expected, providedSignature)) throw new AuthError("Invalid Twitch EventSub signature", 403);
  const envelope = JSON.parse(rawBody) as SubscriptionEnvelope;
  const subscriptionId = envelope.subscription?.id ?? "";
  const subscription = await env.DB.prepare(
    `SELECT s.channel_id AS channelId, s.type, c.broadcaster_user_id AS broadcasterUserId
     FROM twitch_eventsub_subscriptions s JOIN twitch_connections c ON c.channel_id = s.channel_id WHERE s.id = ?`,
  ).bind(subscriptionId).first<{ channelId: string; type: string; broadcasterUserId: string }>();
  if (!subscription || subscription.type !== envelope.subscription?.type) throw new AuthError("Unknown Twitch EventSub subscription", 404);
  const conditionBroadcaster = envelope.subscription?.condition?.broadcaster_user_id;
  if (conditionBroadcaster && conditionBroadcaster !== subscription.broadcasterUserId) {
    throw new AuthError("Twitch broadcaster does not match this board", 403);
  }

  if (messageType === "webhook_callback_verification") {
    if (!envelope.challenge) throw new AuthError("Twitch verification challenge is missing", 400);
    await env.DB.prepare("UPDATE twitch_eventsub_subscriptions SET status = 'enabled', updated_at = ? WHERE id = ?")
      .bind(Date.now(), subscriptionId).run();
    await refreshConnectionStatus(env.DB, subscription.channelId);
    return new Response(envelope.challenge, { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  if (messageType === "revocation") {
    const status = envelope.subscription?.status ?? "revoked";
    await env.DB.prepare("UPDATE twitch_eventsub_subscriptions SET status = ?, updated_at = ? WHERE id = ?")
      .bind(status, Date.now(), subscriptionId).run();
    await env.DB.prepare("UPDATE twitch_connections SET status = 'attention', last_error = ?, updated_at = ? WHERE channel_id = ?")
      .bind(`Twitch revoked ${subscription.type}: ${status}`.slice(0, 500), Date.now(), subscription.channelId).run();
    return new Response(null, { status: 204 });
  }

  if (messageType !== "notification") return new Response(null, { status: 204 });
  const inserted = await env.DB.prepare(
    "INSERT OR IGNORE INTO twitch_event_messages (message_id, channel_id, subscription_type, status, received_at) VALUES (?, ?, ?, 'processing', ?)",
  ).bind(messageId.slice(0, 200), subscription.channelId, subscription.type, Date.now()).run();
  if (!inserted.meta.changes) return new Response(null, { status: 204 });
  await env.DB.batch([
    env.DB.prepare("UPDATE twitch_connections SET last_event_at = ?, last_error = NULL, updated_at = ? WHERE channel_id = ?")
      .bind(Date.now(), Date.now(), subscription.channelId),
    env.DB.prepare("DELETE FROM twitch_event_messages WHERE received_at < ?").bind(Date.now() - EVENT_RETENTION_MS),
  ]);

  context.waitUntil((async () => {
    try {
      const facts = normalizeTwitchEvent(subscription.type, envelope.event, { messageId, occurredAt: timestamp });
      for (const fact of facts) await processFact(subscription.channelId, fact, messageId);
      await env.DB.prepare("UPDATE twitch_event_messages SET status = ?, processed_at = ?, error = NULL WHERE message_id = ?")
        .bind(facts.length ? "processed" : "ignored", Date.now(), messageId).run();
    } catch (error) {
      const description = error instanceof Error ? error.message : "Could not process Twitch event";
      await env.DB.batch([
        env.DB.prepare("UPDATE twitch_event_messages SET status = 'error', processed_at = ?, error = ? WHERE message_id = ?")
          .bind(Date.now(), description.slice(0, 500), messageId),
        env.DB.prepare("UPDATE twitch_connections SET last_error = ?, updated_at = ? WHERE channel_id = ?")
          .bind(description.slice(0, 500), Date.now(), subscription.channelId),
      ]);
    }
  })());
  return new Response(null, { status: 204 });
}
