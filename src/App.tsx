import { useEffect, useRef, useState, type FormEvent } from "react";
import { Progress } from "@base-ui/react/progress";
import { Toggle } from "@base-ui/react/toggle";
import { Dialog } from "@base-ui/react/dialog";
import { Select } from "@base-ui/react/select";
import type { AppState, Challenge, ChallengeDraft, Theme } from "../shared/contracts";
import { api, type AuthSession, type ModInvite, type ModSummary } from "./api";
import { useChallengeChatController, useChallengeChatState } from "./framework/use-challenge-chat";
import { controlThemeVariables, overlayThemeVariables } from "./framework/theme";
import { frameworkClient } from "./framework/client";
import { KILL_CHALLENGE_EXAMPLE } from "./examples/kill-challenge";
import type { LiveRunProjection } from "../shared/framework";
import { DEFAULT_CHANNEL_ID, type ChannelSummary } from "../shared/channels";
import { channelPath, selectedChannelId } from "./framework/channel";
import { ChannelPicker, ChannelSettings, ScoringSettings } from "./channel-tools";
import { OverlayPreview } from "./overlay-preview";

const icons = {
  bolt: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-13h-7l1-7Z" /></svg>,
  vote: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 13 4 4L19 7"/><path d="M3 21h18M7 3h10"/></svg>,
  play: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7V5Z"/></svg>,
  reset: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4v6h6M20 20v-6h-6"/><path d="M5.6 15a7 7 0 0 0 11.7 2.6L20 14M4 10l2.7-3.6A7 7 0 0 1 18.4 9"/></svg>,
  dashboard: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/></svg>,
  inbox: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v14H4z"/><path d="M4 14h5l2 2h2l2-2h5"/></svg>,
  layers: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3-9 5 9 5 9-5-9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/></svg>,
  broadcast: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 8.5a5 5 0 0 0 0 7M5 5a10 10 0 0 0 0 14M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/><circle cx="12" cy="12" r="2"/></svg>,
  theme: <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/></svg>,
  external: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9"/><path d="M18 13v7H4V6h7"/></svg>,
};

function titleCase(value: string) {
  return value.toLocaleLowerCase().replace(/(^|[\s/—-])\p{L}/gu, (letter) => letter.toLocaleUpperCase());
}

type DemoOverlayMode = "starting" | "active" | "voting" | "streamer-won" | "chat-won" | "idle";

const demoOverlayModes: { id: DemoOverlayMode; label: string; detail: string }[] = [
  { id: "starting", label: "Countdown", detail: "10-second full-size intro" },
  { id: "active", label: "Active", detail: "Compact gameplay HUD" },
  { id: "voting", label: "Chat vote", detail: "Three-way next challenge poll" },
  { id: "streamer-won", label: "Streamer wins", detail: "Successful round payoff" },
  { id: "chat-won", label: "Chat wins", detail: "Failed challenge payoff" },
  { id: "idle", label: "Idle", detail: "Between-round holding card" },
];

function Header({ state, auth, channels }: { state: AppState; auth: AuthSession; channels: ChannelSummary[] }) {
  return <header className="topbar">
    <a className="brand" href={channelPath("/")} aria-label="Challenge.chat home"><span className="brand__mark">C</span><span className="brand__wordmark">Challenge<em>.chat</em></span><small>Control deck</small></a>
    <div className="topbar__channel"><span className="channel-avatar">{state.channel.displayName.slice(0, 1).toUpperCase()}</span><ChannelPicker channels={channels} currentId={state.channel.id} owner={auth.role === "owner"}/></div>
    <div className="top-actions">
      <span className={`connection-badge connection-badge--${state.session.status}`}><i />{state.mode === "demo" ? "Demo session" : "Live session"}</span>
      <span className="account-badge">{auth.displayName ?? "Creator"} · {titleCase(auth.role ?? "member")}</span>
      <a className="button button--plain" href={channelPath("/overlay")} target="_blank" rel="noreferrer">Open overlay {icons.external}</a>
      <button className="button button--plain" onClick={async () => { await api.logout(); window.location.reload(); }}>Sign out</button>
    </div>
  </header>;
}

function Sidebar({ state, busy, mutate, pending, ready, role }: { state: AppState; busy: boolean; mutate: (task: () => Promise<unknown>) => void; pending: number; ready: number; role: "owner" | "mod" }) {
  return <aside className="sidebar">
    <nav aria-label="Creator dashboard">
      <span className="sidebar__label">Channel</span>
      <a className="active" aria-label="Control room" href="#overview">{icons.dashboard}<span>Control room</span></a>
      <a aria-label="Review queue" href="#moderation">{icons.inbox}<span>Review queue</span>{pending > 0 && <b>{pending}</b>}</a>
      <a aria-label="Ready deck" href="#ready">{icons.layers}<span>Ready deck</span>{ready > 0 && <b>{ready}</b>}</a>
      <a aria-label="Broadcast" href="#broadcast">{icons.broadcast}<span>Broadcast</span>{state.activeRound && <i className="sidebar__live" />}</a>
      <a aria-label="Leaderboard" href="#leaderboard">{icons.vote}<span>Leaderboard</span></a>
      <span className="sidebar__label">Tools</span>
      <a aria-label="Overlay studio" href={channelPath("/overlay-demo")}>{icons.play}<span>Overlay studio</span></a>
      <a aria-label="Browser source" href={channelPath("/overlay")} target="_blank" rel="noreferrer">{icons.external}<span>Browser source</span></a>
      <a aria-label="Theme workbench" href={channelPath("/theme")}>{icons.theme}<span>Theme workbench</span></a>
      {role === "owner" && <a aria-label="Moderators" href="#team">{icons.layers}<span>Moderators</span></a>}
      {role === "owner" && <a aria-label="Channel settings" href="#channels">{icons.dashboard}<span>Channel settings</span></a>}
    </nav>
    <div className="sidebar__footer">
      {role === "owner" && state.mode === "demo" && <button disabled={busy} onClick={() => mutate(api.reset)}>{icons.reset}<span>Reset demo data</span></button>}
      <small>Score <b>{state.session.streamerScore}</b> streamer · <b>{state.session.chatScore}</b> chat</small>
    </div>
  </aside>;
}

function SuggestionForm({ busy, mutate }: { busy: boolean; mutate: (task: () => Promise<unknown>) => void }) {
  const [text, setText] = useState("Land five kickflips in a row on the waterslide, three attempts, in 90 seconds");
  const [author, setAuthor] = useState("RailRider");
  const [game, setGame] = useState("Skate");
  const submit = (event: FormEvent) => { event.preventDefault(); if (!text.trim()) return; mutate(async () => { await api.createChallenge({ text, game: game.trim(), author: { displayName: author.trim() || "Viewer" } }); setText(""); }); };
  return <form className="suggestion" onSubmit={submit}>
    <div className="section-heading"><h2>New viewer challenge</h2><span className="section-heading__icon">{icons.bolt}</span></div>
    <label className="suggestion__prompt">Challenge prompt<textarea value={text} onChange={(event) => setText(event.target.value)} aria-label="Challenge suggestion" maxLength={500} /></label>
    <div className="suggestion__fields"><label>Viewer<input value={author} onChange={(event) => setAuthor(event.target.value)} maxLength={40}/></label><label>Game<input value={game} onChange={(event) => setGame(event.target.value)} maxLength={100}/></label></div>
    <button className="button button--acid full" disabled={busy || !text.trim()}>Add to review queue</button>
  </form>;
}

function ChallengeCard({ challenge, selected, checked, onSelect, onCheck, onStart, disabled }: { challenge: Challenge; selected?: boolean; checked?: boolean; onSelect?: () => void; onCheck?: () => void; onStart?: () => void; disabled?: boolean }) {
  return <article className={`challenge-card ${selected ? "is-selected" : ""}`} onClick={onSelect}>
    <div className="card-top"><span className={`difficulty difficulty--${challenge.difficulty}`}>{challenge.difficulty}</span><span className="author">@{challenge.authorLogin}</span>{onCheck && <Toggle className="pick" pressed={checked} onClick={(event) => event.stopPropagation()} onPressedChange={onCheck} aria-label="Select for ballot">{checked ? "✓" : "+"}</Toggle>}</div>
    <h3>{titleCase(challenge.title)}</h3><p>{challenge.objective}</p>
    <div className="chips">{challenge.timeLimitSeconds && <span>{challenge.timeLimitSeconds}s</span>}{challenge.maxAttempts && <span>{challenge.maxAttempts} tries</span>}{challenge.context && <span>{titleCase(challenge.context.label)}</span>}<span>{titleCase(challenge.parserStatus)}</span></div>
    {onStart && <button className="button button--red full" disabled={disabled} onClick={(e) => { e.stopPropagation(); onStart(); }}>{icons.play} Take it live</button>}
  </article>;
}

function ReviewEditor({ challenge, mutate }: { challenge: Challenge; mutate: (task: () => Promise<unknown>) => void }) {
  const [draft, setDraft] = useState<ChallengeDraft>(challenge);
  useEffect(() => setDraft(challenge), [challenge]);
  const save = () => api.updateChallenge(challenge.id, draft);
  const number = (value: string) => value ? Number(value) : null;
  return <div className="review-editor panel-cut">
    <div className="review-head"><b>@{challenge.authorDisplayName}</b><span className={`parser-dot parser-dot--${challenge.parserStatus}`}>{titleCase(challenge.parserStatus)}</span></div>
    <label>Show title<input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })}/></label>
    <label>Objective<textarea value={draft.objective} onChange={(e) => setDraft({ ...draft, objective: e.target.value })}/></label>
    <div className="field-row"><label>Seconds<input type="number" min="5" value={draft.timeLimitSeconds ?? ""} onChange={(e) => setDraft({ ...draft, timeLimitSeconds: number(e.target.value) })}/></label><label>Attempts<input type="number" min="1" value={draft.maxAttempts ?? ""} onChange={(e) => setDraft({ ...draft, maxAttempts: number(e.target.value) })}/></label></div>
    <label>Difficulty<select value={draft.difficulty} onChange={(e) => setDraft({ ...draft, difficulty: e.target.value as ChallengeDraft["difficulty"] })}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option><option value="ridiculous">Ridiculous</option></select></label>
    <div className="review-actions"><button className="button" onClick={() => mutate(async () => { await save(); await api.setStatus(challenge.id, "rejected"); })}>Reject</button><button className="button button--acid" onClick={() => mutate(async () => { await save(); await api.setStatus(challenge.id, "approved"); })}>Approve +1 xp</button></div>
  </div>;
}

function BallotPanel({ state, mutate }: { state: AppState; mutate: (task: () => Promise<unknown>) => void }) {
  const [, tick] = useState(0);
  useEffect(() => { const timer = window.setInterval(() => tick((value) => value + 1), 1000); return () => window.clearInterval(timer); }, []);
  if (!state.ballot) return null;
  const total = state.ballot.entries.reduce((sum, entry) => sum + entry.votes, 0);
  const remaining = Math.max(0, Math.ceil((new Date(state.ballot.endsAt).getTime() - Date.now()) / 1000));
  return <section className="ballot-strip">
    <div><h2>Pick the final {state.ballot.winnersCount}</h2><p>{formatTime(remaining)} · each viewer may choose {state.ballot.votesPerViewer}</p></div>
    {state.ballot.entries.map((entry, index) => <button disabled={remaining === 0} key={entry.challenge.id} onClick={() => mutate(() => api.vote(state.ballot!.id, entry.challenge.id, "control-room-preview"))}><b>{index + 1}</b><span>{titleCase(entry.challenge.title)}<small>{entry.votes} votes · {total ? Math.round(entry.votes / total * 100) : 0}%</small></span></button>)}
    <button className="button button--red" onClick={() => mutate(() => api.closeBallot(state.ballot!.id))}>Lock top {state.ballot.winnersCount}</button>
  </section>;
}

function SessionLifecycle({ state, busy, mutate }: { state: AppState; busy: boolean; mutate: (task: () => Promise<unknown>) => void }) {
  const resolved = state.challenges.filter((challenge) => ["streamer_won", "chat_won", "skipped", "voided"].includes(challenge.status)).length;
  const remaining = state.challenges.filter((challenge) => ["queued", "active"].includes(challenge.status)).length;
  if (state.session.phase === "complete") return <section className="session-lifecycle session-lifecycle--complete"><div><span>Session complete</span><h2>{state.session.winner ? `${titleCase(state.session.winner)} wins` : "Session tied"}</h2><p>{state.session.sweepWinner ? `${state.session.sweepLabel ?? "Clean Sweep"} · ` : ""}{state.session.streamerScore}–{state.session.chatScore} · Overall {state.overallScore.streamer}–{state.overallScore.chat}</p></div><button className="button button--acid" disabled={busy} onClick={() => mutate(async () => { await api.createSession(); window.location.reload(); })}>Start new session</button></section>;
  return <section className="session-lifecycle"><div><span>{titleCase(state.session.phase)} phase</span><h2>{state.session.scoringRules.preset === "custom" ? "Custom scoring" : `${titleCase(state.session.scoringRules.preset)} preset`}</h2><p>{state.session.scoringRules.team.challengeWinPoints} points per challenge · {resolved} resolved{remaining ? ` · ${remaining} remaining` : ""} · Overall {state.overallScore.streamer}–{state.overallScore.chat}</p></div>{state.session.phase === "live" && !state.activeRound && <button className="button" disabled={busy || resolved === 0 || remaining > 0} onClick={() => mutate(api.completeSession)}>Complete session</button>}</section>;
}

function LiveControl({ state, mutate }: { state: AppState; mutate: (task: () => Promise<unknown>) => void }) {
  const active = state.activeRound ? state.challenges.find((item) => item.id === state.activeRound?.challengeId) : null;
  if (!active || !state.activeRound) return <div className="empty-live"><span>{icons.play}</span><h3>The stage is clear</h3><p>Start a ready challenge when the streamer is set.</p></div>;
  const round = state.activeRound;
  const isStarting = new Date(round.startedAt).getTime() > Date.now();
  return <div className="live-control panel-cut"><div className={`on-air ${isStarting ? "is-starting" : ""}`}><span /> {isStarting ? "Starting" : "On air"}</div><h2>{titleCase(active.title)}</h2><p className="challenge-source">From @{active.authorLogin}</p><p>{active.objective}</p><div className="live-metrics"><div><small>Attempts</small><b>{round.attemptsUsed}{active.maxAttempts ? ` / ${active.maxAttempts}` : ""}</b><span><button onClick={() => mutate(() => api.attempt(active.id, -1))}>−</button><button onClick={() => mutate(() => api.attempt(active.id, 1))}>+</button></span></div><div><small>Round value</small><b>{active.roundValue} pt</b></div></div><div className="resolve-grid"><button className="streamer-win" onClick={() => mutate(() => api.resolve(active.id, "streamer_won"))}>Streamer did it</button><button className="chat-win" onClick={() => mutate(() => api.resolve(active.id, "chat_won"))}>Chat called it</button></div><button className="text-button" onClick={() => mutate(() => api.resolve(active.id, "skipped"))}>Skip / void round</button></div>;
}

function FrameworkRunPanel({ run, mutate }: { run: LiveRunProjection | null; mutate: (task: () => Promise<unknown>) => void }) {
  const metric = run?.metrics[0];
  const numericValue = typeof metric?.value === "number" ? metric.value : 0;
  const numericTarget = typeof metric?.target === "number" ? metric.target : null;
  const percent = numericTarget ? Math.min(100, Math.max(0, numericValue / numericTarget * 100)) : 0;
  const terminal = Boolean(run && ["succeeded", "failed", "voided"].includes(run.status));
  const start = () => mutate(() => frameworkClient.createRun(KILL_CHALLENGE_EXAMPLE));
  const increment = () => run && mutate(() => frameworkClient.publishEvent(run.runId, {
    source: "reference-control-panel",
    idempotencyKey: `manual:${run.runId}:${crypto.randomUUID()}`,
    event: { type: "metric.incremented", metric: "kills", by: 1 },
  }));

  return <section className={`framework-run ${run ? `framework-run--${run.status}` : ""}`}>
    <div><h2>{run ? titleCase(run.title) : "Generic run console"}</h2><p>{run?.objective ?? "Start the reference counter challenge, then replace its event source with any game adapter."}</p></div>
    {run && metric ? <Progress.Root className="framework-progress" value={percent}><div className="framework-progress__readout"><Progress.Label>{metric.label}</Progress.Label><b>{String(metric.value)}{metric.target !== null ? ` / ${String(metric.target)}` : ""}</b></div><Progress.Track className="framework-progress__track"><Progress.Indicator className="framework-progress__indicator" /></Progress.Track><small>Rev {run.revision} · {titleCase(run.status)}</small></Progress.Root> : <div className="framework-progress is-empty"><small>Counter + timer + automatic rule</small></div>}
    <div className="framework-actions"><a className="button" href={channelPath("/overlay?engine=framework")} target="_blank" rel="noreferrer">Open v1 overlay</a><button className="button" onClick={start} disabled={Boolean(run && !terminal)}>{terminal ? "New run" : run ? "Run in progress" : "Start kill demo"}</button>{run && !terminal && <button className="button button--acid" disabled={run.status !== "active"} onClick={increment}>+ Report kill</button>}</div>
  </section>;
}

function ThemeLab({ theme, mutate }: { theme: Theme; mutate: (task: () => Promise<unknown>) => void }) {
  const [local, setLocal] = useState(theme);
  useEffect(() => setLocal(theme), [theme]);
  const presets: Record<string, Pick<Theme, "primary" | "accent" | "success" | "failure">> = { arcade: { primary: "#ff4d2e", accent: "#e7ff3c", success: "#58f29b", failure: "#ff4d6d" }, broadcast: { primary: "#265dff", accent: "#ffffff", success: "#1bd675", failure: "#ff375f" }, neon: { primary: "#ff2bd6", accent: "#2bf7ff", success: "#9cff57", failure: "#ff335f" } };
  const choose = (preset: Theme["preset"]) => setLocal({ ...local, preset, ...presets[preset] });
  return <section className="theme-lab">
    <div className="section-title"><h2>Overlay appearance</h2></div>
    <span className="theme-subhead">Color preset</span>
    <div className="preset-row">{(["arcade", "broadcast", "neon"] as const).map((p) => <button className={local.preset === p ? "active" : ""} onClick={() => choose(p)} key={p}>{titleCase(p)}</button>)}</div>
    <div className="color-row">{(["primary", "accent", "success", "failure"] as const).map((key) => <label key={key}>{titleCase(key)}<input type="color" value={local[key]} onChange={(e) => setLocal({ ...local, [key]: e.target.value })}/></label>)}</div>
    <div className="theme-actions"><label className="upload">Upload channel logo<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => { const file = e.target.files?.[0]; if (file) mutate(async () => { const uploaded = await api.upload(file); const next = { ...local, logoUrl: uploaded.url }; setLocal(next); await api.updateTheme(next); }); }}/></label><button className="button button--acid" onClick={() => mutate(() => api.updateTheme(local))}>Save overlay theme</button></div>
  </section>;
}

function AuthEntry({ auth, onAuthenticated }: { auth: AuthSession; onAuthenticated: () => Promise<void> }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [setupToken, setSetupToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (auth.setup === "ready" && password !== confirmation) { setError("Passwords do not match"); return; }
    setBusy(true);
    setError(null);
    try {
      if (auth.setup === "ready") await api.setupOwner(setupToken, password);
      else await api.login(password);
      setPassword("");
      setConfirmation("");
      setSetupToken("");
      await onAuthenticated();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  };
  return <main className="boot auth-screen"><form className="admin-login" onSubmit={submit}>
    <h1>Control room</h1>
    {auth.setup === "needs_setup_token" ? <p>Before the first sign-in, set either <code>OWNER_PASSWORD</code> or <code>OWNER_SETUP_TOKEN</code> as a Worker secret, then reload this page. The public OBS overlay needs no login.</p>
      : auth.setup === "ready" ? <p>Set your owner password using the setup code from your Worker secret. This can only be completed once.</p>
        : <p>Sign in with your owner password. Moderators use the one-time links you create for them.</p>}
    {auth.setup === "ready" && <label>Setup code<input type="password" autoComplete="off" value={setupToken} onChange={(event) => setSetupToken(event.target.value)} required/></label>}
    {auth.setup !== "needs_setup_token" && <label>{auth.setup === "ready" ? "New owner password" : "Owner password"}<input type="password" autoComplete={auth.setup === "ready" ? "new-password" : "current-password"} minLength={auth.setup === "ready" ? 12 : undefined} value={password} onChange={(event) => setPassword(event.target.value)} required/></label>}
    {auth.setup === "ready" && <label>Confirm password<input type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required/></label>}
    {error && <p role="alert">{error}</p>}
    {auth.setup === "needs_setup_token" ? <button className="button button--acid" type="button" onClick={() => window.location.reload()}>Check setup</button>
      : <button className="button button--acid" disabled={busy}>{busy ? "Connecting…" : auth.setup === "ready" ? "Set owner password" : "Sign in"}</button>}
  </form></main>;
}

function MagicInvite() {
  const started = useRef(false);
  const [message, setMessage] = useState("Checking your moderator invite…");
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const token = new URLSearchParams(window.location.hash.slice(1)).get("token");
    const targetChannel = selectedChannelId();
    window.history.replaceState(null, "", channelPath("/invite", targetChannel));
    if (!token) { setMessage("This invite link is missing its sign-in code."); return; }
    void api.consumeInvite(token).then(() => {
      window.location.replace(channelPath("/", targetChannel));
    }).catch((caught) => setMessage(caught instanceof Error ? caught.message : "This invite could not be used"));
  }, []);
  return <main className="boot auth-screen"><div className="admin-login"><h1>Join the control room</h1><p role="status">{message}</p><a href={channelPath("/")}>Back to sign-in</a></div></main>;
}

function ModManagement() {
  const [mods, setMods] = useState<ModSummary[]>([]);
  const [name, setName] = useState("");
  const [invite, setInvite] = useState<ModInvite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [existingId, setExistingId] = useState("");
  useEffect(() => { void api.mods(true).then((result) => setMods(result.mods)).catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load moderators")); }, []);
  const grant = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(null);
    try { setInvite(await api.grantModAccess(existingId)); setMods((current) => current.map((mod) => mod.id === existingId ? { ...mod, active: true, channelIds: [...mod.channelIds, selectedChannelId()] } : mod)); setExistingId(""); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not grant channel access"); }
    finally { setBusy(false); }
  };
  const create = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true); setError(null);
    try {
      const result = await api.createMod(name);
      setMods((current) => [result.mod, ...current]);
      setInvite({ link: result.link, expiresAt: result.expiresAt });
      setName("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not create moderator"); }
    finally { setBusy(false); }
  };
  const regenerate = async (id: string) => {
    setBusy(true); setError(null);
    try { setInvite(await api.regenerateModInvite(id)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not generate invite"); }
    finally { setBusy(false); }
  };
  const revoke = async (id: string) => {
    if (!window.confirm("Remove this moderator's access to this channel? Access to other channels will stay the same.")) return;
    setBusy(true); setError(null);
    try { await api.revokeMod(id); setMods((current) => current.map((mod) => mod.id === id ? { ...mod, active: false } : mod)); setInvite(null); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not remove moderator"); }
    finally { setBusy(false); }
  };
  return <section className="team-section" id="team"><div className="section-heading"><div><h2>Moderators</h2></div><p>Grant access to this channel, then share a one-time sign-in link privately.</p></div>
    <form className="team-create" onSubmit={create}><label>Moderator name<input value={name} onChange={(event) => setName(event.target.value)} maxLength={60} required/></label><button className="button button--acid" disabled={busy}>Create moderator + link</button></form>
    {mods.some((mod) => !mod.active) && <form className="team-create" onSubmit={grant}><label>Existing moderator<select aria-label="Existing moderator" value={existingId} onChange={(event) => setExistingId(event.target.value)} required><option value="">Choose a moderator</option>{mods.filter((mod) => !mod.active).map((mod) => <option key={mod.id} value={mod.id}>{mod.displayName}</option>)}</select></label><button className="button" disabled={busy || !existingId}>Grant channel access + link</button></form>}
    {invite && <div className="team-invite"><b>One-time link · expires {new Date(invite.expiresAt).toLocaleTimeString()}</b><p>Anyone with this link can sign in as this moderator. Share it privately; it stops working after one use or 15 minutes.</p><div><input aria-label="Moderator sign-in link" value={invite.link} readOnly onFocus={(event) => event.target.select()}/><button className="button" onClick={() => void navigator.clipboard.writeText(invite.link).catch(() => setError("Could not copy the link. Select and copy it manually."))}>Copy link</button></div></div>}
    {error && <p className="team-error" role="alert">{error}</p>}
    <div className="team-list">{mods.some((mod) => mod.active) ? mods.filter((mod) => mod.active).map((mod) => <div key={mod.id}><span><b>{mod.displayName}</b><small>Channel moderator</small></span><span className="team-list__actions"><button className="button" disabled={busy} onClick={() => void regenerate(mod.id)}>New link</button><button className="button" disabled={busy} onClick={() => void revoke(mod.id)}>Remove access</button></span></div>) : <p>No moderators have access to this channel yet.</p>}</div>
  </section>;
}

function Dashboard() {
  const [auth, setAuth] = useState<AuthSession | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  useEffect(() => { void api.authSession().then(setAuth).catch((caught) => setAuthError(caught instanceof Error ? caught.message : "Could not check sign-in")); }, []);
  if (authError) return <main className="boot"><h1>Signal lost</h1><p>{authError}</p><button onClick={() => window.location.reload()}>Retry</button></main>;
  if (!auth) return <main className="boot"><span className="loader"/><h1>Checking access</h1></main>;
  if (!auth.authenticated) return <AuthEntry auth={auth} onAuthenticated={async () => { setAuth(await api.authSession()); }}/>;
  return <ChannelDashboardGate auth={auth}/>;
}

function ChannelDashboardGate({ auth }: { auth: AuthSession }) {
  const [channels, setChannels] = useState<ChannelSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void api.channels().then(({ channels: available }) => {
      if (!new URLSearchParams(window.location.search).has("channel") && !available.some((channel) => channel.id === DEFAULT_CHANNEL_ID) && available[0]) {
        window.location.replace(channelPath("/", available[0].id)); return;
      }
      setChannels(available);
    }).catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load channels"));
  }, []);
  if (error) return <main className="boot"><h1>Could not load channels</h1><p>{error}</p><button className="button" onClick={() => window.location.reload()}>Retry</button></main>;
  if (!channels) return <main className="boot"><span className="loader"/><h1>Loading channels</h1></main>;
  if (!channels.some((channel) => channel.id === selectedChannelId())) return <main className="boot"><h1>No channel access</h1><p>{channels.length ? "Choose one of your channels below." : "Ask the owner to grant you access to a channel."}</p>{channels.map((channel) => <a className="button" key={channel.id} href={channelPath("/", channel.id)}>{channel.displayName}</a>)}<button className="button" onClick={async () => { await api.logout(); window.location.reload(); }}>Sign out</button></main>;
  return <AuthenticatedDashboard auth={auth} channels={channels}/>;
}

function AuthenticatedDashboard({ auth, channels }: { auth: AuthSession; channels: ChannelSummary[] }) {
  const { state, liveRun, error, refresh, busy, notice, dismissNotice, mutate, connection } = useChallengeChatController();
  const [selectedId, setSelectedId] = useState<string | null>(null); const [picked, setPicked] = useState<string[]>([]);
  const [voteDuration, setVoteDuration] = useState(600);
  useEffect(() => { if (state) setVoteDuration(state.session.scoringRules.voting.durationSeconds); }, [state?.session.id]);
  if (error && !state) return <main className="boot"><h1>Signal lost</h1><p>{error}</p><button onClick={refresh}>Retry</button></main>;
  if (!state) return <main className="boot"><span className="loader"/><h1>Tuning the signal</h1></main>;
  const pending = state.challenges.filter((item) => item.status === "pending_review");
  const ready = state.challenges.filter((item) => state.session.phase === "collecting" ? ["approved", "queued"].includes(item.status) : item.status === "queued");
  const selected = pending.find((item) => item.id === selectedId) ?? pending[0];
  return <div className="dashboard" style={controlThemeVariables(state.theme)}>
    <Header state={state} auth={auth} channels={channels}/>{notice && <button className="notice" onClick={dismissNotice}>{notice} ×</button>}
    <div className="dashboard-shell">
      <Sidebar state={state} busy={busy} mutate={mutate} pending={pending.length} ready={ready.length} role={auth.role!}/>
      <main>
        <section className="page-heading" id="overview"><div><h1>Control room</h1><p>Review the queue, cue the next challenge, and keep the show moving for {state.channel.displayName}.</p></div><div className="page-heading__score"><span>Session score</span><b>{state.session.streamerScore} <i>—</i> {state.session.chatScore}</b><small>Streamer <i>vs</i> Chat</small></div></section>

        <section className="stat-row" aria-label="Session summary">
          <div className="stat-row__meter stat-row__meter--queue"><span>Review input</span><b>{pending.length}</b><small>{pending.length === 1 ? "challenge needs" : "challenges need"} a decision</small></div>
          <div className="stat-row__meter stat-row__meter--ready"><span>Ready deck</span><b>{ready.length}</b><small>{picked.length ? `${picked.length} selected for voting` : "Build a vote or take one live"}</small></div>
          <div className="stat-row__meter stat-row__meter--program"><span>Program output</span><b className={state.activeRound ? "is-live" : ""}>{state.activeRound ? "On air" : state.ballot ? "Vote" : "Idle"}</b><small>{state.activeRound ? "Challenge is on air" : state.ballot ? "Chat vote is open" : "Overlay is standing by"}</small></div>
        </section>

        <SessionLifecycle state={state} busy={busy} mutate={mutate}/>

        <section className="operations-grid">
          <div className="program-panel" id="broadcast"><div className="lane-head"><span><i className={state.activeRound ? "status-dot status-dot--live" : "status-dot"}/>Live program</span><b>{state.activeRound ? "On air" : "Standby"}</b></div><LiveControl state={state} mutate={mutate}/></div>
          {state.session.phase === "collecting" ? <SuggestionForm busy={busy} mutate={mutate}/> : <div className="suggestion"><div className="section-heading"><h2>Suggestions closed</h2></div><p>This session has moved into {state.session.phase}. Start a new session after the result to collect more suggestions.</p></div>}
        </section>

        <BallotPanel state={state} mutate={mutate}/>

        <section className="workflow-section">
          <div className="section-heading"><div><h2>Review and prepare</h2></div><p>Suggestions move left to right. Approve a clear challenge, then start it directly or add it to a chat vote.</p></div>
          <div className="control-grid">
            <section className="lane" id="moderation"><div className="lane-head"><span>Review queue</span><b>{pending.length}</b></div><div className="card-list">{pending.length ? pending.map((item) => <ChallengeCard key={item.id} challenge={item} selected={selected?.id === item.id} onSelect={() => setSelectedId(item.id)}/>) : <div className="empty-state"><span>✓</span><b>Queue cleared</b><p>New viewer challenges will appear here.</p></div>}</div></section>
            <section className="lane editor-lane"><div className="lane-head"><span>Challenge details</span><b>{selected ? "Editing" : "Empty"}</b></div>{selected ? <ReviewEditor challenge={selected} mutate={mutate}/> : <div className="empty-state empty-state--editor"><span>{icons.inbox}</span><b>Nothing to review</b><p>Use Quick add above to test the moderation flow.</p></div>}</section>
            <section className="lane" id="ready"><div className="lane-head"><span>Ready deck</span><b>{ready.length}</b></div><div className="card-list">{ready.length ? ready.map((item) => <ChallengeCard key={item.id} challenge={item} checked={state.session.phase === "collecting" ? picked.includes(item.id) : undefined} onCheck={state.session.phase === "collecting" ? () => setPicked((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id].slice(-state.session.scoringRules.voting.shortlistSize)) : undefined} onStart={state.session.phase !== "voting" && state.session.phase !== "complete" ? () => mutate(() => api.start(item.id)) : undefined} disabled={Boolean(state.activeRound || state.ballot)}/>) : <div className="empty-state"><span>{icons.layers}</span><b>No challenges ready</b><p>Approved challenges will wait here.</p></div>}</div>{state.session.phase === "collecting" && !state.ballot && <><label className="vote-duration">Voting time<select value={voteDuration} onChange={(event) => setVoteDuration(Number(event.target.value))}><option value={300}>5 minutes</option><option value={600}>10 minutes</option><option value={900}>15 minutes</option></select></label><button className="button button--blue full sticky-action" disabled={picked.length <= state.session.scoringRules.voting.winnersCount || busy || Boolean(state.activeRound)} onClick={() => mutate(async () => { await api.openBallot(picked, voteDuration); setPicked([]); })}>{icons.vote} Start chat vote <span>{picked.length}/{state.session.scoringRules.voting.shortlistSize}</span></button></>}</section>
          </div>
        </section>

        <FrameworkRunPanel run={liveRun} mutate={mutate}/>
        <section className="leaderboards-section" id="leaderboard"><div className="section-heading"><div><h2>Challenger leaderboard</h2></div><p>One channel-wide ranking, based on selected challenges and challenges that beat the streamer.</p></div><div className="leaderboard-view"><div className="leaderboard-description"><h3>All-time challengers</h3><p>Selected ideas earn {state.session.scoringRules.challenger.selectedPoints}; beating the streamer earns another {state.session.scoringRules.challenger.defeatedStreamerPoints}. Change future award values in Session rules.</p></div><div className="leaderboard-ranks">{state.leaderboard.length ? state.leaderboard.slice(0, 10).map((entry) => <div key={entry.userId}><span>{entry.displayName}</span><strong>{entry.points} pts</strong></div>) : <div className="empty-state"><b>No challengers yet</b><p>Scores appear when voted challenges enter a session.</p></div>}</div></div></section>

        {state.sessionHistory.length > 0 && <section className="leaderboards-section"><div className="section-heading"><div><h2>Session history</h2></div></div><div className="session-history">{state.sessionHistory.map((session) => <article key={session.id}><span>{session.completedAt ? new Date(session.completedAt).toLocaleString() : "Completed"}</span><b>{session.streamerScore}–{session.chatScore}</b><p>{session.winner ? `${titleCase(session.winner)} won ${session.streamerChallengeWins}–${session.chatChallengeWins}` : "Tie"}{session.sweepWinner ? ` · ${session.sweepLabel}` : ""}</p></article>)}</div></section>}

        <section className="broadcast-section"><div className="section-heading"><div><h2>Overlay and community</h2></div><a className="text-link" href={channelPath("/overlay-demo")}>Open overlay studio {icons.external}</a></div><div className={`lower-grid ${auth.role === "mod" ? "lower-grid--mod" : ""}`}><section className="preview"><div className="section-title preview-title"><div><h2>Program monitor</h2></div><a href={channelPath("/overlay")} target="_blank" rel="noreferrer">Open live</a></div><OverlayPreview src={channelPath("/overlay")} title="Overlay preview"/></section>{auth.role === "owner" && <ThemeLab theme={state.theme} mutate={mutate}/>}<section className="leaderboard"><div className="section-title"><h2>Challenger ranking</h2></div><p>{state.leaderboard.length} ranked viewers</p><a className="text-link" href="#leaderboard">View leaderboard ↑</a></section></div></section>

        {auth.role === "owner" && <ModManagement/>}
        {auth.role === "owner" && <ScoringSettings rules={state.channel.scoringRules} onSaved={refresh}/>} 
        {auth.role === "owner" && <ChannelSettings channel={state.channel}/>}

        <footer><span className={`footer-status footer-status--${connection.status}`}/>{titleCase(connection.status)} · revision {connection.revision}<span>Challenge.chat live on Cloudflare</span></footer>
      </main>
    </div>
  </div>;
}

const themeDifficulties = ["Easy", "Medium", "Hard", "Ridiculous"];

function ThemeSelect() {
  const [difficulty, setDifficulty] = useState("Hard");
  return <Select.Root value={difficulty} onValueChange={(value) => setDifficulty(value ?? "Hard")}>
    <Select.Trigger className="theme-select__trigger" aria-label="Difficulty">
      <Select.Value>{difficulty}</Select.Value>
      <Select.Icon className="theme-select__icon">⌄</Select.Icon>
    </Select.Trigger>
    <Select.Portal>
      <Select.Positioner className="theme-select__positioner" sideOffset={8}>
        <Select.Popup className="theme-select__popup">
          <Select.List>
            {themeDifficulties.map((item) => <Select.Item className="theme-select__item" value={item} key={item}>
              <Select.ItemText>{item}</Select.ItemText>
              <Select.ItemIndicator className="theme-select__indicator">✓</Select.ItemIndicator>
            </Select.Item>)}
          </Select.List>
        </Select.Popup>
      </Select.Positioner>
    </Select.Portal>
  </Select.Root>;
}

function ThemeDialog() {
  return <Dialog.Root>
    <Dialog.Trigger className="button button--acid">Open confirmation</Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Backdrop className="theme-dialog__backdrop"/>
      <Dialog.Viewport className="theme-dialog__viewport">
        <Dialog.Popup className="theme-dialog__popup">
          <div className="theme-dialog__signal">{icons.broadcast}</div>
          <Dialog.Title className="theme-dialog__title">Take this challenge live?</Dialog.Title>
          <Dialog.Description className="theme-dialog__description">The overlay will switch immediately and the countdown will begin for everyone watching.</Dialog.Description>
          <div className="theme-dialog__actions">
            <Dialog.Close className="button">Keep editing</Dialog.Close>
            <Dialog.Close className="button button--acid">Take it live</Dialog.Close>
          </div>
        </Dialog.Popup>
      </Dialog.Viewport>
    </Dialog.Portal>
  </Dialog.Root>;
}

function ThemeWorkbench() {
  const [armed, setArmed] = useState(true);
  const [selected, setSelected] = useState(false);
  const [level, setLevel] = useState(64);
  return <div className="dashboard theme-workbench">
    <header className="theme-workbench__top">
      <a className="brand" href={channelPath("/")} aria-label="Back to control room"><span className="brand__mark">C</span><span className="brand__wordmark">Challenge<em>.chat</em></span><small>Theme workbench</small></a>
      <a className="button" href={channelPath("/")}>Control room</a>
    </header>
    <main className="theme-workbench__main">
      <section className="theme-workbench__intro">
        <div><h1>Theme workbench</h1></div>
        <p>A focused inventory of the control room's type, color, controls, states, and reusable production components.</p>
      </section>

      <section className="theme-section" id="foundations">
        <div className="theme-section__heading"><div><h2>Foundations</h2><p>Core tokens and typographic hierarchy.</p></div></div>
        <div className="theme-grid theme-grid--foundations">
          <article className="theme-sample theme-type-sample"><h3 className="theme-sample__title">Typography</h3><h1>Fast controls, calm decisions.</h1><h2>Challenge title and panel heading</h2><p>Cal Sans carries interface copy from large display moments down to readable supporting text.</p><code>Geist Mono marks metadata, timers, labels, and system state.</code></article>
          <article className="theme-sample"><h3 className="theme-sample__title">Surface palette</h3><div className="theme-swatches"><div style={{"--swatch":"#111416"} as React.CSSProperties}><i/><b>Deep graphite</b><small>#111416</small></div><div style={{"--swatch":"#2b3134"} as React.CSSProperties}><i/><b>Raised panel</b><small>#2b3134</small></div><div style={{"--swatch":"#ee6039"} as React.CSSProperties}><i/><b>Signal orange</b><small>#ee6039</small></div><div style={{"--swatch":"#84eba8"} as React.CSSProperties}><i/><b>Healthy signal</b><small>#84eba8</small></div></div></article>
        </div>
      </section>

      <section className="theme-section" id="controls">
        <div className="theme-section__heading"><div><h2>Controls</h2><p>Primary actions, physical toggles, and dial states.</p></div></div>
        <div className="theme-grid">
          <article className="theme-sample"><h3 className="theme-sample__title">Buttons</h3><div className="theme-button-row"><button className="button button--acid">Primary action</button><button className="button">Secondary action</button><button className="button" disabled>Disabled action</button></div><div className="theme-button-row"><button className="streamer-win theme-outcome">Streamer did it</button><button className="chat-win theme-outcome">Chat called it</button></div></article>
          <article className="theme-sample"><h3 className="theme-sample__title">Toggle and selection</h3><div className="theme-toggle-row"><Toggle className="pick" pressed={selected} onPressedChange={setSelected} aria-label="Example ballot selection">{selected ? "✓" : "+"}</Toggle><div><b>{selected ? "Selected for vote" : "Available for vote"}</b><small>Base UI toggle primitive</small></div></div><button className={`theme-power ${armed ? "is-armed" : ""}`} aria-pressed={armed} onClick={() => setArmed((current) => !current)}><i/>{armed ? "System armed" : "System idle"}</button></article>
          <article className="theme-sample"><h3 className="theme-sample__title">Rotary values</h3><div className="theme-dials"><div><i style={{transform:`rotate(${level * 2.4 - 120}deg)`}}/><b>{level}</b><small>Audience mix</small></div><div className="is-green"><i style={{transform:"rotate(78deg)"}}/><b>Live</b><small>Program output</small></div></div><label className="theme-range">Adjust dial<input type="range" min="0" max="100" value={level} onChange={(event) => setLevel(Number(event.target.value))}/></label></article>
        </div>
      </section>

      <section className="theme-section" id="forms">
        <div className="theme-section__heading"><div><h2>Forms and overlays</h2><p>Readable inputs, a tactile dropdown, and a decisive modal.</p></div></div>
        <div className="theme-grid theme-grid--forms">
          <article className="theme-sample theme-form">
            <h3 className="theme-sample__title">Text inputs</h3>
            <label>Challenge title<input defaultValue="Waterslide five"/></label>
            <label>Objective<textarea defaultValue="Land five kickflips in a row before the timer expires."/></label>
            <div><label>Duration<input type="number" defaultValue="90"/></label><label>Native select<select defaultValue="hard"><option>Easy</option><option>Medium</option><option value="hard">Hard</option><option>Ridiculous</option></select></label></div>
            <label className="theme-check"><input type="checkbox" defaultChecked/> Announce this challenge on the overlay</label>
          </article>
          <article className="theme-sample theme-select-sample"><h3 className="theme-sample__title">Dropdown</h3><p>A full Base UI select with clear hover, focus, and selected states.</p><label>Challenge difficulty<ThemeSelect/></label></article>
          <article className="theme-sample theme-dialog-sample"><h3 className="theme-sample__title">Confirmation modal</h3><p>Use for high-impact actions that need one calm decision.</p><ThemeDialog/></article>
        </div>
      </section>

      <section className="theme-section" id="feedback">
        <div className="theme-section__heading"><div><h2>Status and feedback</h2><p>Live indicators, tags, progress, and empty states.</p></div></div>
        <div className="theme-grid">
          <article className="theme-sample"><h3 className="theme-sample__title">Tags and indicators</h3><div className="theme-status-row"><span className="difficulty difficulty--easy">Easy</span><span className="difficulty difficulty--hard">Hard</span><span className="parser-dot parser-dot--ai">Ai parsed</span><span className="on-air"><i/> On air</span></div></article>
          <article className="theme-sample"><h3 className="theme-sample__title">Progress</h3><Progress.Root className="framework-progress" value={level}><div className="framework-progress__readout"><Progress.Label>Challenge progress</Progress.Label><b>{level}%</b></div><Progress.Track className="framework-progress__track"><Progress.Indicator className="framework-progress__indicator" /></Progress.Track><small>Revision 14 · Active</small></Progress.Root></article>
          <article className="theme-sample theme-empty"><span className="theme-empty__icon">{icons.inbox}</span><b>Queue cleared</b><p>New viewer challenges will appear here.</p></article>
        </div>
      </section>

      <section className="theme-section" id="cards">
        <div className="theme-section__heading"><div><h2>Cards and panels</h2><p>Representative content surfaces in isolation.</p></div></div>
        <div className="theme-grid">
          <article className="challenge-card is-selected theme-card-example"><div className="card-top"><span className="difficulty difficulty--hard">Hard</span><span className="author">@boardlord</span><Toggle className="pick" pressed aria-label="Selected example">✓</Toggle></div><h3>Waterslide five</h3><p>Land five kickflips in a row before the timer expires.</p><div className="chips"><span>90s</span><span>3 tries</span><span>Waterslide</span></div><button className="button button--red full">{icons.play} Take it live</button></article>
          <article className="theme-sample theme-live-example"><div className="lane-head"><span><i className="status-dot status-dot--live"/>Live program</span><b>On air</b></div><h2>Waterslide five</h2><p><strong>@boardlord</strong> proposed this challenge. Land five kickflips in a row before the timer expires.</p><div className="theme-button-row"><button className="streamer-win theme-outcome">Streamer did it</button><button className="chat-win theme-outcome">Chat called it</button></div></article>
        </div>
      </section>
    </main>
  </div>;
}

function formatTime(seconds: number) { return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`; }
function Overlay() {
  const { state, liveRun } = useChallengeChatState("overlay"); const [, tick] = useState(0);
  const [demoEpoch] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(timer); }, []);
  if (!state) return null;
  const searchParams = new URLSearchParams(window.location.search);
  const requestedDemo = searchParams.get("demo");
  const demoMode = demoOverlayModes.some((mode) => mode.id === requestedDemo) ? requestedDemo as DemoOverlayMode : null;
  const frameworkMode = searchParams.get("engine") === "framework";
  const showGameplay = Boolean(demoMode) && searchParams.get("background") !== "plain";
  const demoCountdown = 10 - (Math.floor((Date.now() - demoEpoch) / 1000) % 10);
  const active = state.activeChallenge;
  const resolved = state.recentResult;
  const startRemaining = state.activeRound ? Math.max(0, Math.ceil((new Date(state.activeRound.startedAt).getTime() - Date.now()) / 1000)) : 0;
  const isStarting = Boolean(active && startRemaining > 0);
  const remaining = state.activeRound?.endsAt ? Math.max(0, Math.ceil((new Date(state.activeRound.endsAt).getTime() - Date.now()) / 1000)) : null;
  const ballotRemaining = state.ballot ? Math.max(0, Math.ceil((new Date(state.ballot.endsAt).getTime() - Date.now()) / 1000)) : null;
  const vars = overlayThemeVariables(state.theme);
  const frameworkMetric = liveRun?.metrics[0];
  const frameworkValue = typeof frameworkMetric?.value === "number" ? frameworkMetric.value : 0;
  const frameworkTarget = typeof frameworkMetric?.target === "number" ? frameworkMetric.target : null;
  const frameworkPercent = frameworkTarget ? Math.min(100, Math.max(0, frameworkValue / frameworkTarget * 100)) : 0;
  const frameworkRemaining = liveRun?.endsAt ? Math.max(0, Math.ceil((new Date(liveRun.endsAt).getTime() - (liveRun.pausedAt ? new Date(liveRun.pausedAt).getTime() : Date.now())) / 1000)) : null;
  return <main className={`overlay overlay--${state.theme.preset} overlay--${state.theme.motion} ${showGameplay ? "overlay--gameplay" : ""}`} style={vars}>
    <div className="overlay-score"><span>STREAMER <b>{state.session.streamerScore}</b>{state.session.scoringRules.streaks.showOnOverlay && state.streaks.streamer.challenge.current > 1 && <small>🔥 {state.streaks.streamer.challenge.current}</small>}</span><i>VS</i><span><b>{state.session.chatScore}</b> CHAT{state.session.scoringRules.streaks.showOnOverlay && state.streaks.chat.challenge.current > 1 && <small>🔥 {state.streaks.chat.challenge.current}</small>}</span></div>
    {state.theme.logoUrl && <img className="overlay-logo" src={state.theme.logoUrl} alt="Channel logo"/>}
    {demoMode === "starting" ? <section className="overlay-card starting"><div className="tape">NEXT CHALLENGE · @boardlord</div><div className="countdown-lockup"><div><h1>Waterslide Five</h1><p>Land five kickflips in a row</p></div><strong className="countdown-number">{demoCountdown}</strong></div><div className="start-rule"><span>GET READY</span><i /></div></section>
      : demoMode === "active" ? <section className="overlay-card active active--compact"><div className="compact-heading"><div><div className="tape">ACTIVE CHALLENGE · @boardlord</div><h1>Waterslide Five</h1></div><strong className="compact-timer">1:24</strong></div><p>Land five kickflips in a row</p><div className="compact-metrics"><span>TRY <b>1/3</b></span><span>FOR <b>1 PT</b></span></div></section>
      : demoMode === "voting" ? <section className="overlay-card voting"><div className="tape">CHAT DECIDES · VOTE NOW</div><h1>PICK THE NEXT CHALLENGE</h1><div className="vote-list"><div><b>1</b><span>Air Mail</span><strong>48</strong></div><div><b>2</b><span>No Meds, No Mercy</span><strong>31</strong></div><div><b>3</b><span>Weird Angle Smith</span><strong>19</strong></div></div></section>
      : demoMode === "streamer-won" ? <section className="overlay-card result streamer_won"><div className="tape">ROUND COMPLETE</div><h1>STREAMER CLUTCHED IT</h1><p>Waterslide Five · proposed by @boardlord</p></section>
      : demoMode === "chat-won" ? <section className="overlay-card result chat_won"><div className="tape">ROUND COMPLETE</div><h1>CHAT CALLED IT</h1><p>Air Mail · proposed by @pixelfiend</p></section>
      : demoMode === "idle" ? <section className="overlay-card idle"><div className="tape">CHALLENGE.CHAT</div><h1>CHAT SETS THE RULES.</h1><p>Drop a challenge. Make it count.</p></section>
      : frameworkMode && liveRun && ["succeeded", "failed", "voided"].includes(liveRun.status) ? <section className={`overlay-card result framework-result framework-result--${liveRun.status}`}><div className="tape">HEADLESS RUN COMPLETE</div><h1>{liveRun.status === "succeeded" ? "CHALLENGE CLEARED" : liveRun.status === "failed" ? "TIME'S UP" : "RUN VOIDED"}</h1><p>{liveRun.title} · {liveRun.resolutionReason}</p></section>
      : frameworkMode && liveRun ? <section className="overlay-card active framework-overlay"><div className="framework-overlay__heading"><div><div className="tape">{liveRun.status === "countdown" ? "GET READY" : liveRun.status === "paused" ? "CHALLENGE PAUSED" : "LIVE CHALLENGE"}</div><h1>{liveRun.title}</h1></div>{frameworkRemaining !== null && <strong className="compact-timer">{formatTime(frameworkRemaining)}</strong>}</div><p>{liveRun.objective}</p>{frameworkMetric && <div className="framework-overlay__progress"><div><span>{frameworkMetric.label}</span><b>{String(frameworkMetric.value)}{frameworkMetric.target !== null ? ` / ${String(frameworkMetric.target)}` : ""}</b></div><i><span style={{ width: `${frameworkPercent}%` }}/></i></div>}</section>
      : active && state.activeRound && isStarting ? <section className="overlay-card starting"><div className="tape">NEXT CHALLENGE · @{active.authorLogin}</div><div className="countdown-lockup"><div><h1>{active.title}</h1><p>{active.objective}</p></div><strong className="countdown-number">{startRemaining}</strong></div><div className="start-rule"><span>GET READY</span><i /></div></section>
      : active && state.activeRound ? <section className="overlay-card active active--compact"><div className="compact-heading"><div><div className="tape">ACTIVE CHALLENGE · @{active.authorLogin}</div><h1>{active.title}</h1></div>{remaining !== null && <strong className="compact-timer">{formatTime(remaining)}</strong>}</div><p>{active.objective}</p><div className="compact-metrics"><span>TRY <b>{state.activeRound.attemptsUsed}{active.maxAttempts ? `/${active.maxAttempts}` : ""}</b></span><span>FOR <b>{active.roundValue} PT</b></span></div></section>
      : state.ballot ? <section className="overlay-card voting"><div className="tape">CHAT DECIDES · TOP {state.ballot.winnersCount} ADVANCE · {formatTime(ballotRemaining ?? 0)}</div><h1>PICK THE SESSION</h1><div className="vote-list">{state.ballot.entries.map((entry, index) => <div key={entry.challenge.id}><b>{index + 1}</b><span>{entry.challenge.title}</span><strong>{entry.votes}</strong></div>)}</div></section>
      : state.session.phase === "complete" ? <section className={`overlay-card result ${state.session.winner === "streamer" ? "streamer_won" : "chat_won"}`}><div className="tape">SESSION COMPLETE</div><h1>{state.session.sweepWinner ? state.session.sweepLabel ?? "CLEAN SWEEP" : state.session.winner ? `${state.session.winner.toUpperCase()} WINS` : "SESSION TIED"}</h1><p>{state.session.streamerScore} STREAMER · {state.session.chatScore} CHAT{state.session.winner && state.streaks[state.session.winner].session.current > 1 ? ` · ${state.streaks[state.session.winner].session.current} SESSION STREAK` : ""}</p></section>
      : resolved ? <section className={`overlay-card result ${resolved.status}`}><div className="tape">ROUND COMPLETE · +{resolved.roundValue}</div><h1>{resolved.status === "streamer_won" ? "STREAMER CLUTCHED IT" : "CHAT CALLED IT"}</h1><p>{resolved.title} · proposed by @{resolved.authorLogin}{state.session.scoringRules.streaks.showOnOverlay && state.streaks[resolved.status === "streamer_won" ? "streamer" : "chat"].challenge.current > 1 ? ` · ${state.streaks[resolved.status === "streamer_won" ? "streamer" : "chat"].challenge.current} WIN STREAK` : ""}</p></section>
      : <section className="overlay-card idle"><div className="tape">CHALLENGE.CHAT</div><h1>CHAT SETS THE RULES.</h1><p>Drop a challenge. Make it count.</p></section>}
  </main>;
}

function OverlayDemo() {
  const [gameplay, setGameplay] = useState(true);
  const [mode, setMode] = useState<DemoOverlayMode>("starting");
  const [version, setVersion] = useState(0);
  const selected = demoOverlayModes.find((item) => item.id === mode)!;
  const select = (next: DemoOverlayMode) => { setMode(next); setVersion((current) => current + 1); };
  const previewUrl = channelPath(`/overlay?demo=${mode}&background=${gameplay ? "gameplay" : "plain"}&v=${version}`);
  return <main className="overlay-studio">
    <header className="studio-header"><a className="studio-brand" href={channelPath("/")} aria-label="Challenge.chat home"><img src="/brand/challenge-chat-logo.png" alt="Challenge.chat"/><small>Overlay studio</small></a><div className="studio-header__meta"><span>Safe preview</span><i /> Does not change live state</div><a className="button" href={previewUrl} target="_blank" rel="noreferrer">Full size ↗</a></header>
    <section className="studio-intro"><div><h1>Try every<br/><em>show moment.</em></h1></div><p>Switch between every broadcast state without starting a real challenge. The countdown automatically loops; select it again to restart from ten.</p></section>
    <div className="studio-background-controls"><span>Preview background</span><button className="button" aria-pressed={gameplay} onClick={() => setGameplay(true)}>Gameplay</button><button className="button" aria-pressed={!gameplay} onClick={() => setGameplay(false)}>Plain</button><small>Fictional game scene · generated artwork</small></div>
    <section className="studio-console">
      <nav className="state-switcher" aria-label="Overlay states">{demoOverlayModes.map((item) => <button key={item.id} className={mode === item.id ? "active" : ""} onClick={() => select(item.id)}><span>{item.label}<small>{item.detail}</small></span><i>{mode === item.id ? "Live" : "View"}</i></button>)}</nav>
      <div className="studio-stage"><div className="stage-chrome"><span><i /> Preview · 1920 × 1080</span><b>{selected.label}</b><button onClick={() => setVersion((current) => current + 1)}>↻ Restart state</button></div><OverlayPreview className="stage-screen" key={previewUrl} src={previewUrl} title={`${selected.label} overlay preview`}/><div className="stage-caption"><div><b>{selected.label}</b><small>{selected.detail}</small></div><code>/overlay?demo={mode}</code></div></div>
    </section>
  </main>;
}

export function App() {
  if (window.location.pathname === "/theme") return <ThemeWorkbench/>;
  if (window.location.pathname === "/overlay") return <Overlay/>;
  if (window.location.pathname === "/overlay-demo") return <OverlayDemo/>;
  if (window.location.pathname === "/invite") return <MagicInvite/>;
  return <Dashboard/>;
}
