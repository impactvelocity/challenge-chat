import { DEFAULT_CHANNEL_ID } from "../shared/channels";

export interface AuthEnv {
  DB: D1Database;
  OWNER_PASSWORD?: string;
  INTEGRATION_TOKEN?: string;
}

export interface Actor {
  id: string;
  role: "owner" | "mod";
  displayName: string;
  sessionHash: string;
  expiresAt: number;
}

export class AuthError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "AuthError";
  }
}

const SESSION_MS = 12 * 60 * 60 * 1_000;
const INVITE_MS = 15 * 60 * 1_000;
const LOGIN_WINDOW_MS = 15 * 60 * 1_000;
const LOGIN_FAILURE_LIMIT = 10;
const PASSWORD_ITERATIONS = 600_000;
const encoder = new TextEncoder();

function hex(bytes: ArrayBuffer | Uint8Array): string {
  return Array.from(bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function fromHex(value: string): Uint8Array {
  return Uint8Array.from(value.match(/.{2}/g) ?? [], (byte) => Number.parseInt(byte, 16));
}

function randomToken(): string {
  return hex(crypto.getRandomValues(new Uint8Array(32)));
}

export async function sha256(value: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

async function safeEqual(left: string, right: string): Promise<boolean> {
  const [a, b] = await Promise.all([sha256(left), sha256(right)]);
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return difference === 0;
}

async function derivePassword(password: string, salt: Uint8Array, iterations = PASSWORD_ITERATIONS): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: Uint8Array.from(salt).buffer as ArrayBuffer, iterations }, key, 256);
  return hex(bits);
}

function cookieName(request: Request): string {
  return new URL(request.url).protocol === "https:" ? "__Host-challenge_session" : "challenge_session";
}

function cookieValue(request: Request): string | null {
  const name = cookieName(request);
  const match = request.headers.get("Cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return match?.slice(name.length + 1) ?? null;
}

export function sessionCookie(request: Request, token: string, clear = false): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${cookieName(request)}=${clear ? "" : token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${clear ? 0 : SESSION_MS / 1000}${secure}`;
}

export function hasSameOrigin(request: Request): boolean {
  return request.headers.get("Origin") === new URL(request.url).origin;
}

export async function getActor(request: Request, env: AuthEnv): Promise<Actor | null> {
  const token = cookieValue(request);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const tokenHash = await sha256(token);
  const row = await env.DB.prepare(
    "SELECT u.id, u.role, u.display_name AS displayName, s.expires_at AS expiresAt FROM auth_sessions s JOIN auth_users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ? AND u.active = 1",
  ).bind(tokenHash, Date.now()).first<{ id: string; role: "owner" | "mod"; displayName: string; expiresAt: number }>();
  return row ? { ...row, sessionHash: tokenHash } : null;
}

export async function authStatus(request: Request, env: AuthEnv) {
  const [actor, stored] = await Promise.all([
    getActor(request, env),
    env.DB.prepare("SELECT control_room_name AS controlRoomName FROM auth_owner_credentials WHERE id = 1")
      .first<{ controlRoomName: string }>(),
  ]);
  const configured = Boolean(env.OWNER_PASSWORD || stored);
  return {
    authenticated: Boolean(actor),
    role: actor?.role ?? null,
    displayName: actor?.displayName ?? null,
    controlRoomName: stored?.controlRoomName ?? "Control room",
    setup: configured ? "complete" as const : "ready" as const,
  };
}

async function createSession(env: AuthEnv, userId: string): Promise<string> {
  const token = randomToken();
  const now = Date.now();
  const result = await env.DB.prepare(
    "INSERT INTO auth_sessions (token_hash, user_id, created_at, expires_at) SELECT ?, id, ?, ? FROM auth_users WHERE id = ? AND active = 1",
  ).bind(await sha256(token), now, now + SESSION_MS, userId).run();
  if (result.meta.changes !== 1) throw new AuthError("Account is inactive", 403);
  return token;
}

async function loginLimitKey(request: Request): Promise<string> {
  return sha256(`owner:${request.headers.get("CF-Connecting-IP") ?? "local-or-unknown"}`);
}

async function checkLoginLimit(request: Request, env: AuthEnv): Promise<void> {
  const key = await loginLimitKey(request);
  const row = await env.DB.prepare("SELECT window_start AS windowStart, failures FROM auth_login_limits WHERE key = ?")
    .bind(key).first<{ windowStart: number; failures: number }>();
  if (row && Date.now() - row.windowStart < LOGIN_WINDOW_MS && row.failures >= LOGIN_FAILURE_LIMIT) {
    throw new AuthError("Too many attempts. Try again in 15 minutes", 429);
  }
}

async function recordLoginFailure(request: Request, env: AuthEnv): Promise<void> {
  const key = await loginLimitKey(request);
  const now = Date.now();
  await env.DB.prepare(
    "INSERT INTO auth_login_limits (key, window_start, failures) VALUES (?, ?, 1) ON CONFLICT(key) DO UPDATE SET window_start = CASE WHEN ? - window_start >= ? THEN ? ELSE window_start END, failures = CASE WHEN ? - window_start >= ? THEN 1 ELSE failures + 1 END",
  ).bind(key, now, now, LOGIN_WINDOW_MS, now, now, LOGIN_WINDOW_MS).run();
}

export async function setupOwner(env: AuthEnv, password: string, controlRoomName: string): Promise<string> {
  if (env.OWNER_PASSWORD) throw new AuthError("Owner password is managed by the Worker secret", 409);
  if (password.length < 12 || password.length > 256) throw new AuthError("Use a password between 12 and 256 characters", 400);
  const name = controlRoomName.trim();
  if (name.length < 1 || name.length > 60) throw new AuthError("Control room name must be 1–60 characters", 400);
  const existing = await env.DB.prepare("SELECT 1 AS present FROM auth_owner_credentials WHERE id = 1").first<{ present: number }>();
  if (existing) throw new AuthError("Owner password is already set", 409);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePassword(password, salt);
  const result = await env.DB.prepare(
    "INSERT INTO auth_owner_credentials (id, password_hash, salt, iterations, created_at, control_room_name) VALUES (1, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING",
  ).bind(hash, hex(salt), PASSWORD_ITERATIONS, Date.now(), name).run();
  if (result.meta.changes !== 1) throw new AuthError("Owner password is already set", 409);
  await env.DB.prepare("UPDATE auth_users SET display_name = ? WHERE id = 'owner'").bind(name).run();
  return createSession(env, "owner");
}

export async function loginOwner(request: Request, env: AuthEnv, password: string): Promise<string> {
  if (password.length > 256) throw new AuthError("Invalid password", 401);
  await checkLoginLimit(request, env);
  let valid = false;
  if (env.OWNER_PASSWORD) {
    if (env.OWNER_PASSWORD.length < 12 || env.OWNER_PASSWORD.length > 256) throw new AuthError("OWNER_PASSWORD must be 12–256 characters", 503);
    valid = await safeEqual(password, env.OWNER_PASSWORD);
  } else {
    const row = await env.DB.prepare("SELECT password_hash AS passwordHash, salt, iterations FROM auth_owner_credentials WHERE id = 1")
      .first<{ passwordHash: string; salt: string; iterations: number }>();
    if (!row) throw new AuthError("Owner password has not been set", 503);
    valid = await safeEqual(await derivePassword(password, fromHex(row.salt), row.iterations), row.passwordHash);
  }
  if (!valid) {
    await recordLoginFailure(request, env);
    throw new AuthError("Invalid password", 401);
  }
  await env.DB.prepare("DELETE FROM auth_login_limits WHERE key = ?").bind(await loginLimitKey(request)).run();
  return createSession(env, "owner");
}

export async function logout(request: Request, env: AuthEnv): Promise<Actor | null> {
  const actor = await getActor(request, env);
  if (actor) await env.DB.prepare("DELETE FROM auth_sessions WHERE token_hash = ?").bind(actor.sessionHash).run();
  return actor;
}

export async function listMods(env: AuthEnv, channelId: string, all = false) {
  const result = await env.DB.prepare(
    `SELECT u.id, u.display_name AS displayName, u.created_at AS createdAt,
      (SELECT GROUP_CONCAT(m.channel_id) FROM channel_memberships m WHERE m.user_id = u.id) AS channelIds
      FROM auth_users u WHERE u.role = 'mod' AND u.active = 1
      AND (? = 1 OR EXISTS (SELECT 1 FROM channel_memberships m WHERE m.user_id = u.id AND m.channel_id = ?)) ORDER BY u.created_at DESC`,
  ).bind(all ? 1 : 0, channelId).all<{ id: string; displayName: string; channelIds: string | null; createdAt: number }>();
  return result.results.map((mod) => ({ ...mod, active: Boolean(mod.channelIds?.split(",").includes(channelId)), channelIds: mod.channelIds?.split(",") ?? [] }));
}

async function inviteForMod(env: AuthEnv, request: Request, channelId: string, modId: string, extraStatements: D1PreparedStatement[] = []) {
  const token = randomToken();
  const now = Date.now();
  await env.DB.batch([
    ...extraStatements,
    env.DB.prepare("DELETE FROM auth_invites WHERE mod_id = ? AND channel_id = ? AND consumed_at IS NULL").bind(modId, channelId),
    env.DB.prepare("INSERT INTO auth_invites (token_hash, mod_id, channel_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?)")
      .bind(await sha256(token), modId, channelId, now, now + INVITE_MS),
  ]);
  const link = new URL("/invite", request.url);
  link.searchParams.set("channel", channelId);
  link.hash = `token=${token}`;
  return { link: link.toString(), expiresAt: new Date(now + INVITE_MS).toISOString() };
}

export async function createMod(env: AuthEnv, request: Request, channelId: string, displayName: string) {
  const name = displayName.trim();
  if (name.length < 1 || name.length > 60) throw new AuthError("Moderator name must be 1–60 characters", 400);
  const modId = crypto.randomUUID();
  const now = Date.now();
  const invite = await inviteForMod(env, request, channelId, modId, [
    env.DB.prepare("INSERT INTO auth_users (id, role, display_name, active, created_at) VALUES (?, 'mod', ?, 1, ?)")
      .bind(modId, name, now),
    env.DB.prepare("INSERT INTO channel_memberships (channel_id, user_id, created_at) VALUES (?, ?, ?)").bind(channelId, modId, now),
  ]);
  return { mod: { id: modId, displayName: name, active: true, createdAt: now, channelIds: [channelId] }, ...invite };
}

export async function regenerateModInvite(env: AuthEnv, request: Request, channelId: string, modId: string) {
  const mod = await env.DB.prepare("SELECT 1 AS present FROM auth_users u JOIN channel_memberships m ON m.user_id = u.id WHERE u.id = ? AND u.role = 'mod' AND u.active = 1 AND m.channel_id = ?")
    .bind(modId, channelId).first<{ present: number }>();
  if (!mod) throw new AuthError("Active moderator not found", 404);
  return inviteForMod(env, request, channelId, modId);
}

export async function grantModAccess(env: AuthEnv, request: Request, channelId: string, modId: string) {
  const mod = await env.DB.prepare("SELECT 1 AS present FROM auth_users WHERE id = ? AND role = 'mod' AND active = 1").bind(modId).first();
  if (!mod) throw new AuthError("Moderator not found", 404);
  return inviteForMod(env, request, channelId, modId, [env.DB.prepare("INSERT OR IGNORE INTO channel_memberships (channel_id, user_id, created_at) VALUES (?, ?, ?)").bind(channelId, modId, Date.now())]);
}

export async function consumeModInvite(env: AuthEnv, token: string): Promise<string> {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new AuthError("Invalid or expired invite", 400);
  const tokenHash = await sha256(token);
  const result = await env.DB.prepare(
    "UPDATE auth_invites SET consumed_at = ? WHERE token_hash = ? AND consumed_at IS NULL AND expires_at > ? AND EXISTS (SELECT 1 FROM auth_users u JOIN channel_memberships m ON m.user_id = u.id WHERE u.id = auth_invites.mod_id AND u.role = 'mod' AND u.active = 1 AND m.channel_id = auth_invites.channel_id) RETURNING mod_id AS modId",
  ).bind(Date.now(), tokenHash, Date.now()).first<{ modId: string }>();
  if (!result) throw new AuthError("Invalid or expired invite", 400);
  return createSession(env, result.modId);
}

export async function revokeMod(env: AuthEnv, channelId: string, modId: string): Promise<void> {
  const mod = await env.DB.prepare("SELECT 1 AS present FROM auth_users WHERE id = ? AND role = 'mod'").bind(modId).first<{ present: number }>();
  if (!mod) throw new AuthError("Moderator not found", 404);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM channel_memberships WHERE channel_id = ? AND user_id = ?").bind(channelId, modId),
    env.DB.prepare("DELETE FROM auth_invites WHERE channel_id = ? AND mod_id = ?").bind(channelId, modId),
  ]);
}

export async function hasIntegrationToken(request: Request, env: AuthEnv, channelId: string): Promise<boolean> {
  const bearer = request.headers.get("Authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if (!bearer) return false;
  const stored = await env.DB.prepare("SELECT token_hash AS tokenHash FROM channel_integration_tokens WHERE channel_id = ?").bind(channelId).first<{ tokenHash: string }>();
  if (stored) return safeEqual(await sha256(bearer), stored.tokenHash);
  return Boolean(channelId === DEFAULT_CHANNEL_ID && env.INTEGRATION_TOKEN && await safeEqual(bearer, env.INTEGRATION_TOKEN));
}
