import { useEffect, useState, type FormEvent } from "react";
import type { AppState } from "../shared/contracts";
import type { ChannelSummary } from "../shared/channels";
import { api } from "./api";
import { channelPath } from "./framework/channel";
import { scoringPreset, type ScoringRules } from "../shared/scoring";

const message = (error: unknown) => error instanceof Error ? error.message : "Something went wrong";

export function ChannelPicker({ channels, currentId, owner }: { channels: ChannelSummary[]; currentId: string; owner: boolean }) {
  return <div className="channel-picker"><label>Channel<select aria-label="Switch channel" value={currentId} onChange={(event) => window.location.assign(channelPath("/", event.target.value))}>{channels.map((channel) => <option key={channel.id} value={channel.id}>{channel.displayName}</option>)}</select></label>{owner && <a className="channel-picker__create" href="#channels" aria-label="Create a new channel">+ New</a>}</div>;
}

export function ChannelSettings({ channel }: { channel: AppState["channel"] }) {
  const [displayName, setDisplayName] = useState(channel.displayName);
  const [slug, setSlug] = useState(channel.slug);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenInfo, setTokenInfo] = useState<Awaited<ReturnType<typeof api.integrationStatus>> | null>(null);
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => { void api.integrationStatus().then(setTokenInfo).catch((caught) => setError(message(caught))); }, []);
  const save = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(null);
    try { await api.updateChannel(displayName, slug); window.location.reload(); }
    catch (caught) { setError(message(caught)); setBusy(false); }
  };
  const create = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(null);
    try { const { channel: created } = await api.createChannel(newName, newSlug, { twitchLogin: newSlug.replace(/-/g, "_"), primary: "#EE6039", accent: "#39C7EE" }); window.location.assign(channelPath("/", created.id)); }
    catch (caught) { setError(message(caught)); setBusy(false); }
  };
  const rotate = async () => {
    if ((tokenInfo?.token || tokenInfo?.environmentFallback) && !window.confirm("Replace this channel's integration token? Existing adapters will need the new token.")) return;
    setBusy(true); setError(null);
    try { const result = await api.rotateIntegrationToken(); setToken(result.token); setTokenInfo(await api.integrationStatus()); }
    catch (caught) { setError(message(caught)); }
    finally { setBusy(false); }
  };
  const overlayUrl = new URL(channelPath("/overlay"), window.location.origin).toString();
  return <section className="channel-section" id="channels">
    <div className="section-heading"><div><h2>Your channels</h2></div><p>Each channel has its own live program, branding, moderators, and Challenger leaderboard.</p></div>
    {error && <p className="team-error" role="alert">{error}</p>}
    <div className="channel-settings-grid">
      <form className="channel-form" onSubmit={save}><h3>{channel.displayName}</h3><label>Channel name<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={60} required/></label><label>Channel slug<input value={slug} onChange={(event) => setSlug(event.target.value)} pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={60} required/></label><button className="button" disabled={busy}>Save channel</button></form>
      <form className="channel-form channel-form--new" onSubmit={create}><h3>Create a channel</h3><p>Add another creator or brand.</p><label>New channel name<input value={newName} onChange={(event) => { setNewName(event.target.value); if (!newSlug || newSlug === newName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")) setNewSlug(event.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")); }} maxLength={60} required/></label><label>New channel slug<input value={newSlug} onChange={(event) => setNewSlug(event.target.value)} pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={60} required/></label><button className="button button--acid" disabled={busy}>Create channel</button></form>
    </div>
    <div className="channel-connections"><div><h3>Obs browser source</h3><p>This URL always follows this channel, including when you switch the control panel.</p><input aria-label="Channel OBS URL" readOnly value={overlayUrl} onFocus={(event) => event.target.select()}/><a className="text-link" href={channelPath("/overlay")} target="_blank" rel="noreferrer">Open channel overlay ↗</a></div><div><h3>Game and service integrations</h3><p>{tokenInfo?.token ? `Channel token ending in ${tokenInfo.token.lastFour}.` : tokenInfo?.environmentFallback ? "Using the default channel's environment token." : "Create a token for adapters that report metrics to this channel."}</p><code>channelId: {channel.id}</code><button className="button" type="button" disabled={busy || !tokenInfo} onClick={() => void rotate()}>{tokenInfo?.token || tokenInfo?.environmentFallback ? "Replace integration token" : "Generate integration token"}</button>{token && <label className="token-reveal">Copy this token now; it is shown only here.<input aria-label="New channel integration token" readOnly value={token} onFocus={(event) => event.target.select()}/></label>}</div></div>
  </section>;
}

export function ScoringSettings({ rules, onSaved }: { rules: ScoringRules; onSaved: () => Promise<void> }) {
  const [draft, setDraft] = useState(rules);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setDraft(rules), [rules]);
  const custom = (next: ScoringRules): ScoringRules => ({ ...next, preset: "custom" });
  const choosePreset = (preset: "classic" | "arcade") => setDraft(scoringPreset(preset));
  const save = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(null);
    try { await api.updateScoringRules(draft); await onSaved(); }
    catch (caught) { setError(message(caught)); }
    finally { setBusy(false); }
  };
  return <section className="channel-section scoring-settings" id="scoring"><div className="section-heading"><div><h2>Session rules</h2></div><p>Changes apply to a collecting session until its first ballot or challenge starts; otherwise they become the snapshot for the next session.</p></div>
    <form className="leaderboard-editor" onSubmit={save}>
      <div className="preset-row"><button type="button" className={draft.preset === "classic" ? "active" : ""} onClick={() => choosePreset("classic")}>Classic · 1 point</button><button type="button" className={draft.preset === "arcade" ? "active" : ""} onClick={() => choosePreset("arcade")}>Arcade · 100 points</button><button type="button" className={draft.preset === "custom" ? "active" : ""} onClick={() => setDraft(custom(draft))}>Custom</button></div>
      <fieldset><legend>Team scoring</legend><label>Points per challenge<input type="number" min={0} max={1000000} value={draft.team.challengeWinPoints} onChange={(event) => setDraft(custom({ ...draft, team: { ...draft.team, challengeWinPoints: Number(event.target.value) } }))}/></label><label>Session-win bonus<input type="number" min={0} max={1000000} value={draft.team.sessionWinBonus} onChange={(event) => setDraft(custom({ ...draft, team: { ...draft.team, sessionWinBonus: Number(event.target.value) } }))}/></label><label>Clean-sweep multiplier<input type="number" min={100} max={1000} step={5} disabled={!draft.team.cleanSweep.enabled} value={draft.team.cleanSweep.multiplierPercent} onChange={(event) => setDraft(custom({ ...draft, team: { ...draft.team, cleanSweep: { ...draft.team.cleanSweep, multiplierPercent: Number(event.target.value) } } }))}/></label><label>Clean-sweep name<input maxLength={40} value={draft.team.cleanSweep.label} onChange={(event) => setDraft(custom({ ...draft, team: { ...draft.team, cleanSweep: { ...draft.team.cleanSweep, label: event.target.value } } }))}/></label><label className="theme-check"><input type="checkbox" checked={draft.team.cleanSweep.enabled} onChange={(event) => setDraft(custom({ ...draft, team: { ...draft.team, cleanSweep: { ...draft.team.cleanSweep, enabled: event.target.checked } } }))}/> Apply the sweep multiplier</label></fieldset>
      <fieldset><legend>Voting</legend><label>Shortlist size<input type="number" min={2} max={10} value={draft.voting.shortlistSize} onChange={(event) => setDraft(custom({ ...draft, voting: { ...draft.voting, shortlistSize: Number(event.target.value) } }))}/></label><label>Challenges selected (and votes per viewer)<input type="number" min={1} max={Math.max(1, draft.voting.shortlistSize - 1)} value={draft.voting.winnersCount} onChange={(event) => { const winnersCount = Number(event.target.value); setDraft(custom({ ...draft, voting: { ...draft.voting, winnersCount, votesPerViewer: winnersCount } })); }}/></label><label>Voting time (seconds)<input type="number" min={10} max={900} value={draft.voting.durationSeconds} onChange={(event) => setDraft(custom({ ...draft, voting: { ...draft.voting, durationSeconds: Number(event.target.value) } }))}/></label></fieldset>
      <fieldset><legend>Challenger scoring</legend><label>Selected challenge<input type="number" min={0} max={1000000} value={draft.challenger.selectedPoints} onChange={(event) => setDraft(custom({ ...draft, challenger: { ...draft.challenger, selectedPoints: Number(event.target.value) } }))}/></label><label>Challenge beats streamer<input type="number" min={0} max={1000000} value={draft.challenger.defeatedStreamerPoints} onChange={(event) => setDraft(custom({ ...draft, challenger: { ...draft.challenger, defeatedStreamerPoints: Number(event.target.value) } }))}/></label></fieldset>
      <fieldset><legend>Streak presentation</legend><label className="theme-check"><input type="checkbox" checked={draft.streaks.showOnOverlay} onChange={(event) => setDraft(custom({ ...draft, streaks: { ...draft.streaks, showOnOverlay: event.target.checked } }))}/> Show active streaks on the overlay</label></fieldset>
      {error && <p className="team-error" role="alert">{error}</p>}<button className="button button--acid" disabled={busy}>{busy ? "Saving…" : "Save rules"}</button>
    </form>
  </section>;
}
