import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  BoltIcon,
  ExternalIcon,
  ListIcon,
  MonitorIcon,
  PlusIcon,
  SettingsIcon,
  SparkleIcon,
  TrophyIcon,
  UsersIcon,
} from '@/components/icons';
import {
  Button,
  ColorPopover,
  ConfirmDialog,
  Divider,
  KeyValue,
  Label,
  Panel,
  RockerSwitch,
  Screen,
  SegmentedControl,
  Select,
  Stepper,
  TextField,
  ThemeSwitcher,
  MiniSwitch,
  Toggle,
  Timer,
  useToasts,
  Well,
} from '@/components/ui';
import { ORIGIN, SITE, VOTE_LENGTHS, type Channel, type Moderator } from '@/model';
import { setOverlayTheme, setThemeSettings, useOverlayConfig, useOverlayDisplay } from '@/data/overlayConfig';
import { setSessionSettings, useSessionSettings } from '@/data/sessionSettings';
import { formatClock } from '@/lib/format';
import { cn } from '@/lib/cn';
import { EDGE_TABLE } from '@/pages/main/Boards';
import { OverlayPreview } from '@/overlay/controls/OverlayCanvas';
import { getTheme, resolveSettings, useThemes, type SettingDef } from '@/overlay/sdk';
import { lighten } from '@/theme/accent';
import { useTheme } from '@/theme/ThemeProvider';
import { api, type ModSummary } from '@/api';
import { AppPage, TopBar, useChannel, useRole } from './shell-context';
import { Avatar, CopyField, Led, OwnerOnly, PageTitle, Section } from './parts';

export const SETTINGS_TABS = [
  { value: 'general', label: 'General', icon: SettingsIcon },
  { value: 'scoring', label: 'Scoring', icon: TrophyIcon },
  { value: 'voting', label: 'Voting', icon: ListIcon },
  { value: 'theme', label: 'Theme', icon: SparkleIcon },
  { value: 'mods', label: 'Mods', icon: UsersIcon },
  { value: 'obs', label: 'OBS', icon: MonitorIcon },
  { value: 'ai', label: 'AI', icon: BoltIcon },
] as const;

const TABS = SETTINGS_TABS;
export type SettingsTab = (typeof TABS)[number]['value'];
type Tab = SettingsTab;

export function ChannelSettings() {
  const { channelId, tab = 'general' } = useParams();
  const channel = useChannel(channelId);
  const role = useRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (!channel) navigate('/dev/app/channels', { replace: true });
  }, [channel, navigate]);
  if (!channel) return null;

  const current = (TABS.some((t) => t.value === tab) ? tab : 'general') as Tab;

  return (
    <AppPage>
      <TopBar channel={channel} />
      {role !== 'owner' ? (
        <OwnerOnly what="Board settings" />
      ) : (
        <>
          <PageTitle eyebrow={channel.displayName} title="Settings" />
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[230px_minmax(0,1fr)]">
            <Panel as="nav" aria-label="Settings sections" className="flex gap-1 overflow-x-auto rounded-[20px] p-2.5 lg:sticky lg:top-6 lg:flex-col">
              {TABS.map((t) => (
                <Link key={t.value} to={`/dev/app/c/${channel.id}/settings/${t.value}`} className="navitem max-lg:w-auto" aria-current={t.value === current ? 'page' : undefined}>
                  <t.icon size={17} />
                  {t.label}
                </Link>
              ))}
            </Panel>
            <Panel className="flex min-w-0 flex-col gap-8 p-6 sm:p-8">
              <SettingsBody tab={current} channel={channel} />
            </Panel>
          </div>
        </>
      )}
    </AppPage>
  );
}

/** The body of one settings section. Shared by this page and the main (/) settings page. */
export function SettingsBody({ tab, channel }: { tab: SettingsTab; channel: Channel }) {
  return (
    <>
      {tab === 'general' && <General channel={channel} part="general" />}
      {tab === 'scoring' && <General channel={channel} part="scoring" />}
      {tab === 'voting' && <General channel={channel} part="voting" />}
      {tab === 'theme' && <OverlayTheme />}
      {tab === 'mods' && <Moderators channel={channel} />}
      {tab === 'obs' && <Overlays channel={channel} />}
      {tab === 'ai' && <AiSettings />}
    </>
  );
}

/* ───────── General ───────── */

type Scoring = { win: number; sessionBonus: number; sweep: boolean; sweepPct: number; sweepLabel: string; selected: number; beats: number };
type ScoringPreset = 'classic' | 'arcade' | 'custom';

/** Starting points for every scoring field. Editing any of them leaves neither preset selected. */
const PRESETS: Record<Exclude<ScoringPreset, 'custom'>, Scoring> = {
  classic: { win: 1, sessionBonus: 0, sweep: false, sweepPct: 150, sweepLabel: 'Clean Sweep', selected: 1, beats: 1 },
  arcade: { win: 100, sessionBonus: 50, sweep: true, sweepPct: 150, sweepLabel: 'Clean Sweep', selected: 100, beats: 100 },
};
const SCORING_KEYS = Object.keys(PRESETS.classic) as (keyof Scoring)[];
const presetOf = (s: Scoring): ScoringPreset =>
  (Object.keys(PRESETS) as Exclude<ScoringPreset, 'custom'>[]).find((p) => SCORING_KEYS.every((k) => PRESETS[p][k] === s[k])) ?? 'custom';

const PRESET_NOTE: Record<ScoringPreset, string> = {
  classic: '1 point a challenge, like 3–2',
  arcade: '100 points a challenge, like 500–300',
  custom: 'Edited from a preset — pick one to start over',
};

/** The read-only Current Session card on General. Hidden for now; flip to bring it back. */
const SHOW_SESSION_CARD = false;

/** A setting's control with a line underneath on what it does. */
function Rule({ hint, children }: { hint: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      {children}
      <p className="hint m-0 leading-relaxed">{hint}</p>
    </div>
  );
}

/** A worked example that recomputes as the values above change. */
function Example({ children }: { children: ReactNode }) {
  return (
    <Well className="flex flex-col gap-1.5 px-5 py-4 text-[13px] leading-relaxed text-ink-soft">
      <Label>Example</Label>
      {children}
    </Well>
  );
}

function General({ channel, part }: { channel: Channel; part: 'general' | 'scoring' | 'voting' }) {
  const toast = useToasts();
  const session = useSessionSettings();
  const initial = useMemo(
    () => {
      const rules = channel.scoringRules;
      return ({
      name: channel.displayName,
      win: rules?.team.challengeWinPoints ?? PRESETS.arcade.win,
      sessionBonus: rules?.team.sessionWinBonus ?? PRESETS.arcade.sessionBonus,
      sweep: rules?.team.cleanSweep.enabled ?? PRESETS.arcade.sweep,
      sweepPct: rules?.team.cleanSweep.multiplierPercent ?? PRESETS.arcade.sweepPct,
      sweepLabel: rules?.team.cleanSweep.label ?? PRESETS.arcade.sweepLabel,
      selected: rules?.challenger.selectedPoints ?? PRESETS.arcade.selected,
      beats: rules?.challenger.defeatedStreamerPoints ?? PRESETS.arcade.beats,
      shortlist: rules?.voting.shortlistSize ?? 10,
      picks: rules?.voting.winnersCount ?? 5,
      votes: rules?.voting.votesPerViewer ?? 3,
      vote: String(rules?.voting.durationSeconds ?? 600),
      streaks: rules?.streaks.showOnOverlay ?? true,
      autoNext: session.autoNext,
      autoNextSecs: session.autoNextSecs,
      publicPage: session.publicPage,
      login: session.twitchLogin ?? channel.broadcasterLogin,
    });
    },
    // Read once on open; saving writes back.
    [channel],
  );
  const [form, setForm] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [overwrite, setOverwrite] = useState<Exclude<ScoringPreset, 'custom'> | null>(null);
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const preset = presetOf(form);
  /** The channel's public scoreboard page; served by this app, so it opens here too. */
  const publicUrl = `${window.location.origin}/c/${channel.id}`;
  const applyPreset = (p: Exclude<ScoringPreset, 'custom'>) => setForm((f) => ({ ...f, ...PRESETS[p] }));

  // Mock session: a live channel has already started its rounds, so new rules wait for the next session.
  const started = channel.live;
  const phase = channel.live ? 'Live' : 'Collecting';

  // Worked examples, from the current values.
  const won = 3;
  const lost = 2;
  const streamer = won * form.win;
  const chat = lost * form.win;
  const swept = Math.round(5 * form.win * (form.sweepPct / 100));
  const fmtPts = (n: number) => n.toLocaleString('en-US');

  return (
    <>
      {part === 'general' && (
        <>
          <Section
            title="Board Details"
            actions={
              <Button size="sm" variant="ghost" nativeButton={false} render={<a href={`${SITE}/docs`} target="_blank" rel="noopener noreferrer" />}>
                Docs
                <ExternalIcon size={14} />
              </Button>
            }
          >
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <TextField label="Board name" value={form.name} onChange={(e) => set('name', e.target.value)} />
              <TextField
                label="Twitch channel"
                prefix={<span className="mono text-[13px] text-ink-faint">twitch.tv/</span>}
                value={form.login}
                maxLength={25}
                spellCheck={false}
                // Pasting a whole URL keeps just the login; Twitch logins are letters, numbers and underscores
                onChange={(e) => set('login', e.target.value.replace(/^\s*(https?:\/\/)?(www\.)?twitch\.tv\//i, '').replace(/[^a-zA-Z0-9_]/g, ''))}
                error={form.login ? undefined : 'Add the channel the public page links to'}
              />
              {/* The link, with its on/off switch inline: off dims the URL and the page shows a private notice */}
              <div className="flex flex-col gap-2 md:col-span-2">
                <Label>Public page</Label>
                <CopyField
                  value={publicUrl}
                  label="Public page URL"
                  className={cn('[&>code]:transition-opacity', !form.publicPage && '[&>code]:opacity-40')}
                  actions={
                    <>
                      <Button size="xs" icon aria-label="Open public page" nativeButton={false} render={<a href={publicUrl} target="_blank" rel="noopener noreferrer" />}>
                        <ExternalIcon size={15} />
                      </Button>
                      <span className="mx-1 w-px self-stretch bg-white/10" aria-hidden="true" />
                      <MiniSwitch checked={form.publicPage} onCheckedChange={(v) => set('publicPage', v)} aria-label="Public page" />
                    </>
                  }
                />
                {/* The public page's Watch on Twitch button goes here */}
                {form.publicPage ? (
                  <span className="hint flex flex-wrap items-center gap-2">
                    Public, linking to
                    <a
                      href={`https://twitch.tv/${form.login}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mono inline-flex items-center gap-1 rounded-full bg-white/[.05] px-2 py-0.5 text-[12px] text-ink-soft no-underline shadow-[inset_0_0_0_1px_rgba(255,255,255,.07)] transition-colors hover:text-ink-strong"
                    >
                      twitch.tv/{form.login}
                      <ExternalIcon size={11} />
                    </a>
                  </span>
                ) : (
                  <span className="hint">Private</span>
                )}
              </div>
            </div>
          </Section>

          <Divider />

          <Appearance name={form.name} />

          <Divider />

          {SHOW_SESSION_CARD && (
            <>
              <Section title="Current Round" sub="Read-only, start and run rounds from the control room">
                <Well className="grid grid-cols-2 gap-x-6 gap-y-4 px-5 py-4 sm:grid-cols-5">
                  {[
                    ['Phase', phase],
                    ["Scoring", presetOf(saved)[0].toUpperCase() + presetOf(saved).slice(1)],
                    ['Challenge value', `${fmtPts(saved.win)} pts`],
                    ['Challenges', `${saved.picks}`],
                    ['Score', `${fmtPts(channel.score.streamer)}–${fmtPts(channel.score.chat)}`],
                  ].map(([k, v]) => (
                    <div key={k} className="flex min-w-0 flex-col gap-1.5">
                      <Label>{k}</Label>
                      <span className="truncate text-[15px] font-semibold text-ink-strong">{v}</span>
                    </div>
                  ))}
                </Well>
                <p className="hint m-0 flex items-center gap-2">
                  <Led tone={started ? 'warn' : 'ok'} />
                  {started ? 'This round has started, so rule changes apply from the next round' : 'No vote or challenge yet, so rule changes apply to this round'}
                </p>
              </Section>

              <Divider />
            </>
          )}

          <Section title="Between Challenges">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <Toggle
                label="Auto-start next challenge"
                description="Counts down under the result, then moves on unless you press Undo, Next or Cancel"
                checked={form.autoNext}
                onCheckedChange={(v) => set('autoNext', v)}
              />
              {form.autoNext && (
                <Stepper label="Countdown" unit="s" value={form.autoNextSecs} min={5} max={300} step={5} onValueChange={(v) => set('autoNextSecs', v)} />
              )}
            </div>
          </Section>

          <Divider />

          <Section title="Delete Board">
            <Well className="flex flex-wrap items-center gap-4 px-5 py-4">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-[13px] leading-relaxed text-ink-soft">Removes {channel.displayName} with its rounds, challenges and moderators, and its OBS links stop working</span>
                <span className="hint">Board deletion is not available yet.</span>
              </div>
              <Button size="sm" variant="ghost" disabled title="Board deletion is not implemented by the server yet">
                Delete board
              </Button>
            </Well>
          </Section>
        </>
      )}
      {part === 'scoring' && (
        <>
          <Section
            title="Scoring Preset"
            sub="Fills in every value below, and changes never rewrite rounds already played"
          >
            <Rule hint={PRESET_NOTE[preset]}>
              <SegmentedControl
                aria-label="Scoring preset"
                options={[
                  { value: 'classic', label: 'Classic' },
                  { value: 'arcade', label: 'Arcade' },
                ]}
                value={preset}
                onValueChange={(p) => {
                  if (p === 'custom') return;
                  if (preset === 'custom') setOverwrite(p);
                  else applyPreset(p);
                }}
              />
            </Rule>
          </Section>

          <Divider />

          <Section title="Team Scoring" sub="The streamer-versus-chat score in the control room and on the overlay">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <Rule hint="Locked in when the challenge starts">
                <Stepper label="Points per challenge" unit="pts" value={form.win} min={1} max={1000} step={form.win < 10 ? 1 : 10} onValueChange={(v) => set('win', v)} />
              </Rule>
              <Rule hint="None on a tie">
                <Stepper label="Round-win bonus" unit="pts" value={form.sessionBonus} min={0} max={1000} step={form.win < 10 ? 1 : 10} onValueChange={(v) => set('sessionBonus', v)} />
              </Rule>
            </div>
            <RockerSwitch
              label="Clean-sweep multiplier"
              description="When one side wins every challenge in a round, multiply their score before the round-win bonus is added"
              checked={form.sweep}
              onCheckedChange={(v) => set('sweep', v)}
            />
            {form.sweep && (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <Stepper label="Multiplier" unit="%" value={form.sweepPct} min={100} max={500} step={10} onValueChange={(v) => set('sweepPct', v)} />
                <TextField label="Sweep label" value={form.sweepLabel} onChange={(e) => set('sweepLabel', e.target.value)} />
              </div>
            )}
            <Example>
              <span>
                Streamer wins {won} of 5: {fmtPts(streamer)}–{fmtPts(chat)}
                {form.sessionBonus > 0 && (
                  <>
                    , plus the {fmtPts(form.sessionBonus)} bonus makes it{' '}
                    <b className="text-ink-strong">
                      {fmtPts(streamer + form.sessionBonus)}–{fmtPts(chat)}
                    </b>
                  </>
                )}
              </span>
              {form.sweep && (
                <span>
                  Streamer wins all 5: {fmtPts(5 * form.win)} × {form.sweepPct}% = {fmtPts(swept)}
                  {form.sessionBonus > 0 && `, then +${fmtPts(form.sessionBonus)}`} ={' '}
                  <b className="text-ink-strong">{fmtPts(swept + form.sessionBonus)}</b> ·{' '}
                  <span className="mono text-[11px] tracking-[.12em] text-accent-text uppercase">{form.sweepLabel || 'Clean Sweep'}</span>
                </span>
              )}
            </Example>
          </Section>

          <Divider />

          <Section
            title="Challenger Scoring"
            sub="Points for the viewers who suggest challenges, counted toward Top challengers but not the streamer-versus-chat score"
          >
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <Stepper label="Challenge selected" unit="pts" value={form.selected} min={0} max={1000} step={form.selected < 10 ? 1 : 10} onValueChange={(v) => set('selected', v)} />
              <Rule hint="On top of being selected">
                <Stepper label="Beats the streamer" unit="pts" value={form.beats} min={0} max={1000} step={form.beats < 10 ? 1 : 10} onValueChange={(v) => set('beats', v)} />
              </Rule>
            </div>
            <Example>
              <span>
                Casey's challenge is selected (+{fmtPts(form.selected)}) and beats the streamer (+{fmtPts(form.beats)}):{' '}
                <b className="text-ink-strong">{fmtPts(form.selected + form.beats)} Challenger points</b>, recorded when earned and never recalculated
              </span>
            </Example>
          </Section>

          <Divider />

          <Section title="Streaks" sub="Worked out from challenge and round history, never entered by hand">
            <RockerSwitch
              label="Show streaks on overlay"
              description="A flame beside the team score and a win-streak line on challenge results"
              checked={form.streaks}
              onCheckedChange={(v) => set('streaks', v)}
            />
          </Section>
        </>
      )}
      {part === 'voting' && (
        <>
          <Section title="Voting Rules">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              <Stepper
                label="Shortlist size"
                value={form.shortlist}
                min={2}
                max={10}
                onValueChange={(v) => setForm((f) => ({ ...f, shortlist: v, picks: Math.min(f.picks, v - 1), votes: Math.min(f.votes, v) }))}
              />
              <Rule hint="Ties keep shortlist order">
                <Stepper label="Challenges selected" value={form.picks} min={1} max={form.shortlist - 1} onValueChange={(v) => set('picks', v)} />
              </Rule>
              <Rule hint="One vote per challenge">
                <Stepper label="Votes per viewer" value={form.votes} min={1} max={Math.min(5, form.shortlist)} onValueChange={(v) => set('votes', v)} />
              </Rule>
            </div>
            <Rule hint="You can still change it when you open each vote">
              <Label>Default voting length</Label>
              <SegmentedControl aria-label="Default voting length" options={VOTE_LENGTHS} value={form.vote} onValueChange={(v) => set('vote', v)} />
            </Rule>
          </Section>
        </>
      )}

      {dirty && (
        <Well className="sticky bottom-4 z-10 flex flex-wrap items-center gap-3 p-3 pl-5">
          <Led tone="warn" />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-sm font-semibold text-ink-strong">Unsaved changes</span>
            <span className="hint">{started ? 'This round already started, so these apply from the next one' : 'These apply to the current round'}</span>
          </span>
          <Button size="sm" variant="ghost" onClick={() => setForm(saved)}>
            Discard
          </Button>
          <Button
            size="sm"
            variant="accent"
            onClick={() => {
              setSaved(form);
              setSessionSettings({ autoNext: form.autoNext, autoNextSecs: form.autoNextSecs, publicPage: form.publicPage, twitchLogin: form.login });
              void api.updateChannel(form.name, channel.slug);
              if (channel.scoringRules) {
                void api.updateScoringRules({
                  ...channel.scoringRules,
                  preset: presetOf(form),
                  team: {
                    challengeWinPoints: form.win,
                    sessionWinBonus: form.sessionBonus,
                    cleanSweep: { enabled: form.sweep, multiplierPercent: form.sweepPct, label: form.sweepLabel },
                  },
                  challenger: { selectedPoints: form.selected, defeatedStreamerPoints: form.beats },
                  voting: { shortlistSize: form.shortlist, winnersCount: form.picks, votesPerViewer: form.votes, durationSeconds: Number(form.vote) },
                  streaks: { ...channel.scoringRules.streaks, showOnOverlay: form.streaks },
                });
              }
              toast.add({ title: 'Saved', description: started ? 'New rules start next round' : 'Applied to the current round' });
            }}
          >
            Save changes
          </Button>
        </Well>
      )}

      <ConfirmDialog
        open={!!overwrite}
        onOpenChange={(o) => !o && setOverwrite(null)}
        title="Replace your scoring?"
        description={`Switching to ${overwrite === 'classic' ? 'Classic' : 'Arcade'} overwrites every scoring value you've changed`}
        confirmLabel="Replace"
        cancelLabel="Keep my values"
        onConfirm={() => overwrite && applyPreset(overwrite)}
      />
    </>
  );
}

/* ───────── Moderators ───────── */

type Invite = { id: string; url: string; expires: number };

function Moderators({ channel }: { channel: Channel }) {
  const toast = useToasts();
  const [mods, setMods] = useState<Moderator[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [fresh, setFresh] = useState<Invite | null>(null);
  const [removing, setRemoving] = useState<Moderator | null>(null);
  const now = useNow();

  const asModerator = (mod: ModSummary): Moderator => ({
    id: mod.id,
    name: mod.displayName,
    role: 'Moderator',
    channels: mod.channelIds.length,
    active: mod.active,
    added: new Date(mod.createdAt).toLocaleDateString(),
    online: false,
    lastSeen: mod.active ? 'Has access' : 'No access',
  });

  useEffect(() => {
    void api.mods(true).then(({ mods: available }) => setMods(available.filter((mod) => mod.channelIds.includes(channel.id)).map(asModerator))).catch(() => undefined);
  }, [channel.id]);

  const invite = async () => {
    const displayName = window.prompt('Moderator display name')?.trim();
    if (!displayName) return;
    try {
      const created = await api.createMod(displayName);
      const inv = { id: created.mod.id, url: created.link, expires: new Date(created.expiresAt).getTime() };
      setInvites((list) => [inv, ...list]);
      setFresh(inv);
      setMods((list) => [...list, asModerator(created.mod)]);
    } catch (caught) {
      toast.add({ title: 'Could not create moderator', description: caught instanceof Error ? caught.message : 'Try again' });
    }
  };

  // The invite just made shows in the card above; older live ones list in the table.
  const pending = invites.filter((i) => i.expires > now && i.id !== fresh?.id);

  return (
    <>
      <Section
        title="Moderators"
        actions={
          <Button variant="accent" size="sm" onClick={() => void invite()}>
            <PlusIcon size={16} />
            Invite moderator
          </Button>
        }
      >
        {fresh && fresh.expires > now && (
          <Screen className="flex flex-col gap-4 px-6 py-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="flex flex-col gap-2">
                <span className="status">Invite link ready</span>
                <span className="text-sm text-ink-soft">Send it by DM, not in chat — it works once</span>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <Label className="text-ink-sub">Expires in</Label>
                <Timer value={formatClock(Math.max(0, Math.round((fresh.expires - now) / 1000)))} className="text-[36px]" />
              </div>
            </div>
            <CopyField value={fresh.url} label="Invite link" />
            <div className="flex justify-end gap-2.5">
              <Button size="xs" variant="ghost" onClick={() => (setInvites((l) => l.filter((i) => i.id !== fresh.id)), setFresh(null))}>
                Revoke
              </Button>
              <Button size="xs" onClick={() => setFresh(null)}>
                Done
              </Button>
            </div>
          </Screen>
        )}

        {/* Runs to the panel's edges like the inbox; pending invites sit above the moderators they'll become. */}
        <div className="-mx-4 sm:-mx-7">
          <table className={EDGE_TABLE}>
            <thead>
              <tr>
                <th>Moderator</th>
                <th className="w-[120px] max-sm:hidden">Added</th>
                <th className="w-[150px] max-sm:w-[120px]">Status</th>
                <th className="w-[96px] max-sm:w-[84px]">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {pending.map((i) => (
                <tr key={i.id}>
                  <td>
                    <span className="block text-[15px] font-semibold text-ink-sub">Invite link</span>
                    <code className="mono block truncate pt-0.5 text-[11px] text-ink-muted">{i.url}</code>
                  </td>
                  <td className="text-[14px] text-ink-muted max-sm:hidden">—</td>
                  <td>
                    <span className="flex items-center gap-2 text-[14px] text-ink-soft">
                      <Led tone="warn" />
                      <span>
                        Expires <span className="mono">{formatClock(Math.round((i.expires - now) / 1000))}</span>
                      </span>
                    </span>
                  </td>
                  <td>
                    <span className="flex justify-end">
                      <Button size="xs" variant="ghost" onClick={() => setInvites((l) => l.filter((x) => x.id !== i.id))}>
                        Revoke
                      </Button>
                    </span>
                  </td>
                </tr>
              ))}
              {mods.map((m) => (
                <tr key={m.id} className="transition-colors hover:[&>td]:bg-white/[.03]">
                  <td>
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="flex max-sm:hidden">
                        <Avatar name={m.name} size={32} />
                      </span>
                      <span className="min-w-0">
                        <span className="mono block truncate text-[15px] font-semibold text-ink-strong">@{m.name}</span>
                        <span className="block pt-0.5 text-[12px] text-ink-muted sm:hidden">Added {m.added}</span>
                      </span>
                    </span>
                  </td>
                  <td className="text-[14px] text-ink-soft max-sm:hidden">{m.added}</td>
                  <td>
                    <span className={cn('flex items-center gap-2 text-[14px]', m.online ? 'text-ink-soft' : 'text-ink-muted')}>
                      <Led tone={m.online ? 'ok' : undefined} />
                      <span className="truncate">{m.lastSeen}</span>
                    </span>
                  </td>
                  <td>
                    <span className="flex justify-end">
                      <Button size="xs" variant="ghost" onClick={() => setRemoving(m)}>
                        Remove
                      </Button>
                    </span>
                  </td>
                </tr>
              ))}
              {mods.length === 0 && pending.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-[14px] text-ink-muted">
                    No moderators yet — invite someone you trust to run the queue while you play
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      <Divider />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Well className="flex flex-col gap-3 p-5">
          <Label>Moderators can</Label>
          {['Add, edit, approve and reject suggestions', 'Pick ballots and open or close votes', 'Start, pause and resolve challenges', 'Adjust attempts and void challenges'].map((t) => (
            <span key={t} className="flex items-center gap-2.5 text-[13px] text-ink-soft">
              <Led tone="ok" />
              {t}
            </span>
          ))}
        </Well>
        <Well className="flex flex-col gap-3 p-5">
          <Label>Only you can</Label>
          {['Create boards and change settings', 'Invite or remove moderators', 'Change branding and themes', 'Change scoring and AI settings'].map((t) => (
            <span key={t} className="flex items-center gap-2.5 text-[13px] text-ink-sub">
              <Led />
              {t}
            </span>
          ))}
        </Well>
      </div>

      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Remove ${removing?.name}?`}
        description="They're signed out of this board right away, and their past approvals stay in the history"
        confirmLabel="Remove"
        cancelLabel="Keep"
        onConfirm={() => {
          if (!removing) return;
          void api.revokeMod(removing.id).then(() => {
            setMods((list) => list.filter((mod) => mod.id !== removing.id));
            toast.add({ title: 'Moderator removed', description: removing.name });
          }).catch((caught) => toast.add({ title: 'Could not remove moderator', description: caught instanceof Error ? caught.message : 'Try again' }));
        }}
      />
    </>
  );
}

function useNow(interval = 1000) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(id);
  }, [interval]);
  return now;
}

/* ───────── OBS ───────── */

function Overlays({ channel }: { channel: Channel }) {
  const url = `${ORIGIN}/overlay?channel=${channel.id}`;

  return (
    <>
      <Section
        title="OBS"
        sub="Public browser sources that never see moderator data"
        actions={
          // The ID every OBS link carries, handy when setting up a source by hand
          <div className="flex items-center gap-3">
            <span className="lbl pb-0">Board ID</span>
            <CopyField value={channel.id} label="Board ID" className="min-h-[40px] w-[170px]" />
          </div>
        }
      >
        <Well className="flex flex-col gap-3.5 p-5">
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="text-[15px] font-semibold text-ink-strong">Challenge Overlay</span>
            <span className="max-w-[62ch] text-[13px] leading-relaxed text-ink-sub">
              Switches between voting, countdown, live challenge and results on its own, and shows nothing in between
            </span>
          </div>
          <CopyField
            value={url}
            label="Challenge Overlay URL"
            actions={
              <Button size="xs" icon aria-label="Open Challenge Overlay" nativeButton={false} render={<a href={url} target="_blank" rel="noopener noreferrer" />}>
                <ExternalIcon size={15} />
              </Button>
            }
          />
        </Well>
      </Section>

      <Divider />

      <Section title="Browser Source Settings" sub="What to enter in OBS when you add the URL">
        <Well className="px-5 py-2">
          <KeyValue label="Source type">Browser</KeyValue>
          <KeyValue label="Width × height">1920 × 1080</KeyValue>
          <KeyValue label="Shutdown source when not visible">Off</KeyValue>
          <KeyValue label="Refresh browser when scene becomes active">Off</KeyValue>
        </Well>
        <span className="hint">Leaving both off keeps the live connection open, so state changes land instantly when you switch scenes</span>
      </Section>
    </>
  );
}

/* ───────── AI ───────── */

/** Everything the model helps with. Each switch takes effect straight away; drafts always keep the viewer's original text. */
function AiSettings() {
  const session = useSessionSettings();
  const [parse, setParse] = useState(true);
  const [titles, setTitles] = useState(true);
  const [tone, setTone] = useState<'playful' | 'hype' | 'straight'>('playful');

  return (
    <>
      <Section title="Provider">
        <Well className="flex flex-wrap items-center gap-3 px-5 py-4">
          <Led tone="ok" />
          <span className="text-sm font-semibold text-ink-strong">OpenAI connected</span>
          <span className="mono text-xs text-ink-muted">gpt-6-astra</span>
          <span className="hint ml-auto">If it's down, everything below falls back to the built-in rules</span>
        </Well>
      </Section>

      <Divider />

      <Section title="Suggestions" sub="Turns free-form !challenge text into a structured draft for moderators to approve">
        <RockerSwitch
          label="Use AI parsing"
          description="Off uses the built-in rules parser, which is faster but needs more moderator edits"
          checked={parse}
          onCheckedChange={setParse}
        />
        {parse && <RockerSwitch label="Write challenge titles" description="A short, readable name like “Pistol Purist”" checked={titles} onCheckedChange={setTitles} />}
        <p className="hint m-0">Every draft keeps the viewer's original text and shows which parser made it</p>
      </Section>

      <Divider />

      <Section title="Round Naming" sub="Suggests a name for each round when you lock in the lineup, and you can rewrite or regenerate it">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Toggle
            label="Name rounds automatically"
            description="Off leaves rounds untitled until you name them"
            checked={session.aiTitles}
            onCheckedChange={(v) => setSessionSettings({ aiTitles: v })}
          />
          {session.aiTitles && (
            <Rule hint={tone === 'playful' ? 'Puns and in-jokes, like “Knives Out, Agents Random”' : tone === 'hype' ? 'Big and loud, like “The Low-Sens Gauntlet”' : 'Plain and descriptive, like “Five Pistol Challenges”'}>
              <Label>Tone</Label>
              <SegmentedControl
                aria-label="Naming tone"
                options={[
                  { value: 'playful', label: 'Playful' },
                  { value: 'hype', label: 'Hype' },
                  { value: 'straight', label: 'Straight' },
                ]}
                value={tone}
                onValueChange={setTone}
              />
            </Rule>
          )}
        </div>
      </Section>
    </>
  );
}

/* ───────── Overlay ───────── */

/** Scenes the preview can hold. Each side's win gets its own, to check both colours. */
const PREVIEW_SCENES = [
  { value: 'idle', label: 'Off' },
  { value: 'open', label: 'Ideas' },
  { value: 'vote', label: 'Vote' },
  { value: 'lock', label: 'Lineup' },
  { value: 'live', label: 'Live' },
  { value: 'streamer', label: 'Streamer wins' },
  { value: 'chat', label: 'Chat wins' },
  { value: 'done', label: 'Results' },
] as const;
type PreviewScene = (typeof PREVIEW_SCENES)[number]['value'];

/** The overlay's look: pick a theme, then fill in whatever settings it defines. Changes reach the overlay straight away. */
function OverlayTheme() {
  const config = useOverlayConfig();
  const display = useOverlayDisplay();
  const themes = useThemes();
  const theme = getTheme(display.theme) ?? themes[0];
  const values = resolveSettings(theme.settings, display.settings);
  const edited = Object.keys(config.settings[theme.id] ?? {}).length > 0;
  const [scene, setScene] = useState<PreviewScene>('live');

  // The theme's settings in its own groups, in the order it declares them
  const groups = new Map<string, [string, SettingDef][]>();
  for (const entry of Object.entries(theme.settings)) {
    const g = entry[1].group ?? 'Settings';
    groups.set(g, [...(groups.get(g) ?? []), entry]);
  }

  return (
    <>
      <Section
        title="Overlay Theme"
        actions={
          <Select
            aria-label="Overlay theme"
            className="w-[260px] max-sm:w-full"
            options={themes.map((t) => ({ value: t.id, label: t.name, group: 'Built-in', meta: `${Object.keys(t.settings).length} settings` }))}
            value={theme.id}
            onValueChange={setOverlayTheme}
          />
        }
      >
        <div className="flex flex-col gap-5">
          {/* The real overlay, drawn by the theme with these settings */}
          <OverlayPreview
            display={display}
            scene={scene === 'streamer' || scene === 'chat' ? 'result' : scene}
            winner={scene === 'chat' ? 'chat' : 'streamer'}
            className="aspect-video rounded-[14px] bg-black shadow-[inset_0_0_0_1px_rgba(255,255,255,.08),0_0_0_1px_rgba(0,0,0,.7)]"
          />
          <div className="-mx-1 overflow-x-auto px-1 pb-1">
            <SegmentedControl fill aria-label="Preview scene" options={[...PREVIEW_SCENES]} value={scene} onValueChange={setScene} />
          </div>
        </div>
      </Section>

      {/* Built entirely from the theme's settings schema */}
      <Section
        title="Config"
        actions={
          edited && (
            <Button size="sm" variant="ghost" onClick={() => setThemeSettings(theme.id, null)}>
              Reset
            </Button>
          )
        }
      >
        {[...groups].map(([group, list], i) => (
          <div key={group} className={cn('flex flex-col gap-3', i > 0 && 'mt-4')}>
            {/* A ruled heading, so a group's name doesn't read as the label of the field above */}
            <div className="flex items-center gap-3">
              <Label className="pb-0 text-accent-text">{group}</Label>
              <span className="h-px flex-1 bg-white/[.07]" aria-hidden="true" />
            </div>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {list.map(([key, def]) => (
                <SettingControl key={`${theme.id}.${key}`} def={def} value={values[key]} onChange={(v) => setThemeSettings(theme.id, { [key]: v })} />
              ))}
            </div>
          </div>
        ))}
      </Section>
    </>
  );
}

/** A config field with its label and control on one row, spread apart. */
function InlineField({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  // The description sits under its label, so the control keeps the right side to itself
  return (
    <div className="flex min-h-[54px] items-center justify-between gap-4">
      <span className="flex min-w-0 flex-col gap-1">
        <span className="lbl pb-0">{label}</span>
        {hint && <span className="hint">{hint}</span>}
      </span>
      {children}
    </div>
  );
}

/**
 * One schema setting as a form control. Numbers, switches and short choices sit on one row; colours, text
 * and long lists stack. Inline rows are bottom-aligned so they line up with a stacked field beside them.
 */
function SettingControl({ def, value, onChange }: { def: SettingDef; value: unknown; onChange: (v: unknown) => void }) {
  const { hex } = useTheme();
  switch (def.type) {
    case 'boolean':
      return (
        <div className="self-end">
          <Toggle inline label={def.label} description={def.description} checked={value as boolean} onCheckedChange={onChange} />
        </div>
      );
    case 'number':
      return (
        <div className="self-end">
          <InlineField label={def.label} hint={def.description}>
            <div className="w-[190px] max-w-[60%]">
              <Stepper hideLabel label={def.label} unit={def.unit} value={value as number} min={def.min} max={def.max} step={def.step} onValueChange={onChange} />
            </div>
          </InlineField>
        </div>
      );
    case 'select':
      return def.options.length <= 3 ? (
        <div className="self-end">
          <InlineField label={def.label} hint={def.description}>
            <SegmentedControl aria-label={def.label} options={[...def.options]} value={value as string} onValueChange={onChange} />
          </InlineField>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Label>{def.label}</Label>
          <Select aria-label={def.label} options={[...def.options]} value={value as string} onValueChange={onChange} />
          {def.description && <span className="hint">{def.description}</span>}
        </div>
      );
    case 'color': {
      // Unset follows the board's own colours
      const set = value as string | null;
      return (
        <div className="flex items-center gap-2.5">
          <ColorPopover value={set ?? hex} onChange={onChange} aria-label={def.label}>
            <button type="button" className="colorwell well min-w-0 flex-1 text-left">
              <i style={{ background: set ?? 'repeating-linear-gradient(135deg, #4a4d52 0 5px, #2a2c30 5px 10px)' }} />
              <span className="flex min-w-0 flex-col gap-1">
                <span className="lbl">{def.label}</span>
                <span className="mono truncate text-xs text-ink-soft">{set ? set.toUpperCase() : (def.description ?? 'Follows the board')}</span>
              </span>
            </button>
          </ColorPopover>
          {set && (
            <Button size="sm" variant="ghost" onClick={() => onChange(null)}>
              Reset
            </Button>
          )}
        </div>
      );
    }
    case 'text': {
      const text = value as string;
      return (
        <TextField
          label={def.label}
          value={text}
          maxLength={def.maxLength}
          placeholder={def.placeholder}
          onChange={(e) => onChange(e.target.value)}
          description={def.description ?? (def.maxLength ? `${text.length}/${def.maxLength}` : undefined)}
        />
      );
    }
  }
}

/* ───────── Appearance (on General) ───────── */

/** The control panel's own colours: a primary from the presets or a custom pick, and chat's colour, which follows the primary unless picked. `name` labels the streamer's side of the preview. */
function Appearance({ name }: { name: string }) {
  const theme = useTheme();
  const chatAuto = !theme.chat;
  const vars = { '--sw-size': '30px' } as CSSProperties;

  return (
    <Section title="Appearance">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label>Primary</Label>
          <ThemeSwitcher size={30} />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Chat</Label>
          <div className="flex flex-wrap items-center gap-3">
            <ColorPopover value={theme.chatHex} onChange={theme.setChat} aria-label="Pick a custom chat colour">
              <button
                type="button"
                className="sw sw-picker"
                data-on=""
                style={{ ...vars, background: `linear-gradient(180deg, ${lighten(theme.chatHex, 0.28)}, ${theme.chatHex})` }}
                title="Custom chat colour"
              />
            </ColorPopover>
            <SegmentedControl
              aria-label="Chat colour"
              options={[
                { value: 'auto', label: 'Auto' },
                { value: 'custom', label: 'Custom' },
              ]}
              value={chatAuto ? 'auto' : 'custom'}
              onValueChange={(v) => theme.setChat(v === 'auto' ? null : theme.chatHex)}
            />
            <span className="mono text-[11px] tracking-[.08em] text-ink-label">{theme.chatHex.toUpperCase()}</span>
          </div>
        </div>
      </div>
      {/* The two sides as the scoreboard paints them: each glows in from its own edge, scores on the outside. */}
      <Well
        className="flex items-center gap-4 overflow-hidden px-5 py-4"
        style={{ background: `linear-gradient(90deg, ${theme.hex}1f, transparent 35%, transparent 65%, ${theme.chatHex}1f), linear-gradient(180deg, #0c0e0f 0%, #121416 100%)` }}
      >
        <span className="flex flex-none items-center gap-3">
          <span className="pixel text-[28px] leading-none" style={{ color: lighten(theme.hex, 0.28), textShadow: `0 0 14px ${theme.hex}99` }}>
            3,500
          </span>
          <span className="size-2.5 rounded-full" style={{ background: theme.hex, boxShadow: `0 0 10px ${theme.hex}` }} />
        </span>
        <span className="h-px flex-1 bg-white/10" aria-hidden="true" />
        <span className="flex flex-none items-baseline gap-2.5 text-[13px] font-semibold text-ink-strong">
          {name || 'Streamer'}
          <span className="text-[17px] font-medium text-ink-muted">vs</span>
          Chat
        </span>
        <span className="h-px flex-1 bg-white/10" aria-hidden="true" />
        <span className="flex flex-none items-center gap-3">
          <span className="size-2.5 rounded-full" style={{ background: theme.chatHex, boxShadow: `0 0 10px ${theme.chatHex}` }} />
          <span className="pixel text-[28px] leading-none" style={{ color: lighten(theme.chatHex, 0.28), textShadow: `0 0 14px ${theme.chatHex}99` }}>
            2,250
          </span>
        </span>
      </Well>
    </Section>
  );
}
