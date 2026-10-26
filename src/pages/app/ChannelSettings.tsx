import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  ArrowRightIcon,
  BoltIcon,
  CheckIcon,
  ExternalIcon,
  ListIcon,
  MonitorIcon,
  PlusIcon,
  SettingsIcon,
  SparkleIcon,
  TrophyIcon,
  UsersIcon,
  KeyIcon,
  LockIcon,
  TwitchIcon,
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
  Sheet,
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
import { displayOf, hydrateOverlayConfig, useOverlayConfig, type OverlayConfig } from '@/data/overlayConfig';
import { hydrateSessionSettings, setSessionSettings, useSessionSettings } from '@/data/sessionSettings';
import { formatClock } from '@/lib/format';
import { cn } from '@/lib/cn';
import { EDGE_TABLE } from '@/pages/main/Boards';
import { OverlayPreview } from '@/overlay/controls/OverlayCanvas';
import { getTheme, resolveSettings, useThemes, type SettingDef } from '@/overlay/sdk';
import { complement, lighten } from '@/theme/accent';
import { useTheme } from '@/theme/ThemeProvider';
import { api, type ApiTokenSummary, type ModSummary } from '@/api';
import { channelPath } from '@/framework/channel';
import { frameworkClient } from '@/framework/client';
import { mockViewerId, parseMockChatMessage } from '@/dev/mock-chat';
import { KILL_CHALLENGE_EXAMPLE } from '@/examples/kill-challenge';
import { AppPage, TopBar, useChannel, useRole } from './shell-context';
import { Avatar, CopyField, Led, OwnerOnly, PageTitle, Section } from './parts';
import { DEFAULT_THEME, type AppState } from '../../../shared/contracts';
import type { LiveRunProjection } from '../../../shared/framework';

export const SETTINGS_TABS = [
  { value: 'general', label: 'General', icon: SettingsIcon },
  { value: 'scoring', label: 'Scoring', icon: TrophyIcon },
  { value: 'voting', label: 'Voting', icon: ListIcon },
  { value: 'theme', label: 'Theme', icon: SparkleIcon },
  { value: 'mods', label: 'Moderators', icon: UsersIcon },
  { value: 'obs', label: 'OBS', icon: MonitorIcon },
  { value: 'twitch', label: 'Twitch', icon: TwitchIcon },
  { value: 'ai', label: 'AI', icon: BoltIcon },
  { value: 'api', label: 'API', icon: KeyIcon },
  { value: 'dev', label: 'Dev', icon: KeyIcon },
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
export function SettingsBody({ tab, channel, onSaved }: { tab: SettingsTab; channel: Channel; onSaved?: () => Promise<void> }) {
  return (
    <>
      {tab === 'general' && <General channel={channel} part="general" onSaved={onSaved} />}
      {tab === 'scoring' && <General channel={channel} part="scoring" onSaved={onSaved} />}
      {tab === 'voting' && <General channel={channel} part="voting" onSaved={onSaved} />}
      {tab === 'theme' && <OverlayTheme channelName={channel.displayName} onSaved={onSaved} />}
      {tab === 'mods' && <Moderators channel={channel} />}
      {tab === 'obs' && <Overlays channel={channel} />}
      {tab === 'twitch' && <TwitchSettings channel={channel} />}
      {tab === 'ai' && <AiSettings />}
      {tab === 'api' && <Connections channel={channel} />}
      {tab === 'dev' && <DevTools channel={channel} onSaved={onSaved} />}
    </>
  );
}

/* ───────── General ───────── */

type Scoring = { win: number; sessionBonus: number; sweep: boolean; sweepPct: number; sweepLabel: string; selected: number; beats: number };
type ScoringPreset = 'classic' | 'arcade' | 'custom';

/** Starting points for every scoring field. Editing any of them leaves neither preset selected. */
const PRESETS: Record<Exclude<ScoringPreset, 'custom'>, Scoring> = {
  classic: { win: 1, sessionBonus: 0, sweep: false, sweepPct: 150, sweepLabel: 'Clean Sweep', selected: 1, beats: 1 },
  arcade: { win: 100, sessionBonus: 0, sweep: false, sweepPct: 150, sweepLabel: 'Clean Sweep', selected: 100, beats: 100 },
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

function General({ channel, part, onSaved }: { channel: Channel; part: 'general' | 'scoring' | 'voting'; onSaved?: () => Promise<void> }) {
  const toast = useToasts();
  const session = useSessionSettings();
  const theme = useTheme();
  const boardTheme = channel.theme ?? DEFAULT_THEME;
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
      votes: rules?.voting.winnersCount ?? 5,
      vote: String(rules?.voting.durationSeconds ?? 600),
      streaks: rules?.streaks.showOnOverlay ?? true,
      autoNext: session.autoNext,
      autoNextSecs: session.autoNextSecs,
      publicPage: session.publicPage,
      login: session.twitchLogin ?? channel.broadcasterLogin,
      primary: boardTheme.primary,
      chat: boardTheme.accent.toLowerCase() === complement(boardTheme.primary).toLowerCase() ? null : boardTheme.accent,
    });
    },
    // Read once on open; saving writes back.
    [channel],
  );
  const [form, setForm] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [overwrite, setOverwrite] = useState<Exclude<ScoringPreset, 'custom'> | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const preset = presetOf(form);
  /** The channel's public scoreboard page; served by this app, so it opens here too. */
  const publicUrl = `${window.location.origin}/c/${channel.id}`;
  const applyPreset = (p: Exclude<ScoringPreset, 'custom'>) => setForm((f) => ({ ...f, ...PRESETS[p] }));
  const applyAppearance = (primary: string, chat: string | null) => theme.applyBoard(primary, chat ?? complement(primary));

  const save = async () => {
    setSaving(true);
    try {
      const tasks: Promise<unknown>[] = [];
      if (form.name !== saved.name) tasks.push(api.updateChannel(form.name, channel.slug));
      if (form.autoNext !== saved.autoNext || form.autoNextSecs !== saved.autoNextSecs || form.publicPage !== saved.publicPage || form.login !== saved.login) {
        tasks.push(api.updateSessionSettings({ ...session, autoNext: form.autoNext, autoNextSecs: form.autoNextSecs, publicPage: form.publicPage, twitchLogin: form.login })
          .then(({ settings }) => hydrateSessionSettings(settings)));
      }
      if (form.primary !== saved.primary || form.chat !== saved.chat) {
        tasks.push(api.updateTheme({ ...boardTheme, primary: form.primary, accent: form.chat ?? complement(form.primary) }));
      }
      const scoringChanged = [
        'win', 'sessionBonus', 'sweep', 'sweepPct', 'sweepLabel', 'selected', 'beats', 'shortlist', 'picks', 'votes', 'vote', 'streaks',
      ].some((key) => form[key as keyof typeof form] !== saved[key as keyof typeof saved]);
      if (channel.scoringRules && scoringChanged) {
        tasks.push(api.updateScoringRules({
          ...channel.scoringRules,
          preset: presetOf(form),
          team: {
            challengeWinPoints: form.win,
            sessionWinBonus: form.sessionBonus,
            cleanSweep: { enabled: form.sweep, multiplierPercent: form.sweepPct, label: form.sweepLabel },
          },
          challenger: { selectedPoints: form.selected, defeatedStreamerPoints: form.beats },
          voting: { shortlistSize: form.shortlist, winnersCount: form.picks, votesPerViewer: form.picks, durationSeconds: Number(form.vote) },
          streaks: { ...channel.scoringRules.streaks, showOnOverlay: form.streaks },
        }));
      }
      await Promise.all(tasks);
      await onSaved?.();
      setSaved(form);
      toast.add({ title: 'Saved', description: started ? 'New rules start next round' : 'Applied to the current round' });
    } catch (caught) {
      toast.add({ title: 'Could not save settings', description: caught instanceof Error ? caught.message : 'Try again' });
    } finally {
      setSaving(false);
    }
  };

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

          <Appearance
            name={form.name}
            primary={form.primary}
            chat={form.chat}
            onPrimaryChange={(primary) => {
              set('primary', primary);
              applyAppearance(primary, form.chat);
            }}
            onChatChange={(chat) => {
              set('chat', chat);
              applyAppearance(form.primary, chat);
            }}
          />

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
                <span className="text-[13px] leading-relaxed text-ink-soft">Removes {channel.displayName} with its rounds, challenges and moderator access. Its OBS links will stop working.</span>
              </div>
              <Button size="sm" variant="ghost" className="text-[#ff8a95]" onClick={() => setDeleteOpen(true)} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Delete board'}
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

        </>
      )}
      {part === 'voting' && (
        <>
          <Section title="Voting Rules">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <Stepper
                label="Shortlist size"
                value={form.shortlist}
                min={2}
                max={10}
                onValueChange={(v) => setForm((f) => {
                  const picks = Math.min(f.picks, v - 1);
                  return { ...f, shortlist: v, picks, votes: picks };
                })}
              />
              <Rule hint={`Each viewer gets ${form.picks} distinct vote${form.picks === 1 ? '' : 's'}; cast votes cannot be removed`}>
                <Stepper label="Challenges selected" value={form.picks} min={1} max={form.shortlist - 1} onValueChange={(v) => setForm((f) => ({ ...f, picks: v, votes: v }))} />
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
          <Button size="sm" variant="ghost" disabled={saving} onClick={() => {
            setForm(saved);
            applyAppearance(saved.primary, saved.chat);
          }}>
            Discard
          </Button>
          <Button
            size="sm"
            variant="accent"
            disabled={saving}
            onClick={() => void save()}
          >
            {saving ? 'Saving…' : 'Save changes'}
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
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${channel.displayName}?`}
        description="This permanently deletes its rounds, challenges, moderator access, uploaded branding, and integration token. Existing OBS links will stop working. This cannot be undone."
        confirmLabel="Delete board"
        cancelLabel="Keep board"
        confirmVariant="danger"
        onConfirm={() => {
          setDeleting(true);
          void api.deleteChannel().then(({ nextChannel }) => {
            window.location.assign(channelPath('/', nextChannel.id));
          }).catch((caught) => {
            setDeleting(false);
            toast.add({ title: 'Could not delete board', description: caught instanceof Error ? caught.message : 'Try again' });
          });
        }}
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
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
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

  const openInvite = () => {
    setInviteName('');
    setInviteError(null);
    setInviteOpen(true);
  };

  const invite = async () => {
    const displayName = inviteName.trim();
    if (!displayName) {
      setInviteError('Enter a name for this moderator');
      return;
    }
    setInviteBusy(true);
    setInviteError(null);
    try {
      const created = await api.createMod(displayName);
      const inv = { id: created.mod.id, url: created.link, expires: new Date(created.expiresAt).getTime() };
      setInvites((list) => [inv, ...list]);
      setFresh(inv);
      setMods((list) => [...list, asModerator(created.mod)]);
      setInviteOpen(false);
      setInviteName('');
      toast.add({ title: 'Invite link ready', description: `Send it to ${created.mod.displayName}` });
    } catch (caught) {
      setInviteError(caught instanceof Error ? caught.message : 'Could not create this invite');
    } finally {
      setInviteBusy(false);
    }
  };

  // The invite just made shows in the card above; older live ones list in the table.
  const pending = invites.filter((i) => i.expires > now && i.id !== fresh?.id);

  return (
    <>
      <Section
        title="Moderators"
        actions={
          (mods.length > 0 || pending.length > 0) && (
            <Button variant="accent" size="sm" onClick={openInvite}>
              <PlusIcon size={16} />
              Invite moderator
            </Button>
          )
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

        {mods.length === 0 && pending.length === 0 ? (
          <div className="pt-3 pb-2">
            <Screen className="relative overflow-hidden px-6 py-10 text-center sm:px-10 sm:py-12">
              <div className="pointer-events-none absolute inset-x-[18%] top-0 h-px bg-gradient-to-r from-transparent via-accent/70 to-transparent" aria-hidden="true" />
              <div className="relative mx-auto flex max-w-[520px] flex-col items-center">
                <div className="relative mb-6 flex h-[74px] w-[74px] items-center justify-center" aria-hidden="true">
                  <span className="relative grid h-16 w-16 place-items-center rounded-[20px] border border-accent/35 bg-accent/10 text-accent-text shadow-[0_0_28px_rgba(var(--ar),.12)]">
                    <UsersIcon size={29} />
                  </span>
                  <span className="absolute right-0 bottom-0 grid h-8 w-8 place-items-center rounded-full border-[3px] border-[#101214] bg-accent text-accent-ink shadow-[0_0_16px_rgba(var(--ar),.45)]">
                    <PlusIcon size={14} />
                  </span>
                </div>
                <strong className="text-2xl leading-tight font-bold tracking-[-.015em] text-pretty text-ink-strong">Bring someone into the control room</strong>
                <p className="mt-3 mb-0 max-w-[48ch] text-sm leading-relaxed text-pretty text-ink-sub">
                  Invite someone you trust to review challenges, run votes, and keep rounds moving while you play.
                </p>
                <Button variant="accent" className="mt-6" onClick={openInvite}>
                  <PlusIcon size={16} />
                  Invite moderator
                </Button>
                <span className="mt-4 text-xs leading-relaxed text-ink-muted">Invite links work once and expire after 15 minutes.</span>
              </div>
            </Screen>
          </div>
        ) : (
          /* Runs to the panel's edges like the inbox; pending invites sit above the moderators they'll become. */
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
            </tbody>
          </table>
          </div>
        )}
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
          {['Create boards and change settings', 'Invite or remove moderators', 'Change branding and themes', 'Change scoring and AI settings', 'Create API and game tokens'].map((t) => (
            <span key={t} className="flex items-center gap-2.5 text-[13px] text-ink-sub">
              <Led />
              {t}
            </span>
          ))}
        </Well>
      </div>

      <Sheet
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        title={<span className="text-[20px] leading-tight font-bold">Invite moderator</span>}
        footer={
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button variant="accent" disabled={inviteBusy || !inviteName.trim()} onClick={() => void invite()}>
              {inviteBusy ? 'Creating invite…' : 'Create invite'}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-5 pt-2">
          <p className="m-0 text-sm leading-relaxed text-pretty text-ink-sub">
            Give them a recognizable name. You’ll get a private, one-use link to send directly to them.
          </p>
          <TextField
            label="Moderator name"
            placeholder="Alex"
            value={inviteName}
            maxLength={60}
            autoFocus
            error={inviteError ?? undefined}
            onChange={(event) => {
              setInviteName(event.target.value);
              if (inviteError) setInviteError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !inviteBusy) void invite();
            }}
          />
          <span className="hint">Invite links work once and expire after 15 minutes.</span>
        </div>
      </Sheet>

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

/* ───────── Twitch ───────── */

function TwitchSettings({ channel }: { channel: Channel }) {
  const role = useRole();
  const toast = useToasts();
  const [status, setStatus] = useState<Awaited<ReturnType<typeof api.twitchStatus>> | null>(null);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [editingConfiguration, setEditingConfiguration] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setError(null);
    const next = await api.twitchStatus();
    setStatus(next);
    setClientId(next.configuration.clientId);
    setEditingConfiguration(!next.configuration.ready);
  };

  useEffect(() => {
    if (role !== 'owner') return;
    setStatus(null);
    setClientId('');
    setClientSecret('');
    setEditingConfiguration(true);
    void refresh().catch((caught) => setError(caught instanceof Error ? caught.message : 'Could not load Twitch connection'));
  }, [channel.id, role]);

  const connectionStatus = status?.connection?.status;
  useEffect(() => {
    if (connectionStatus !== 'connecting') return;
    let cancelled = false;
    let requestPending = false;
    const poll = async () => {
      if (requestPending) return;
      requestPending = true;
      try {
        const next = await api.twitchStatus();
        if (!cancelled) {
          setStatus(next);
          setClientId(next.configuration.clientId);
        }
      } catch {
        // EventSub confirmation can be briefly unavailable; the next bounded poll retries.
      } finally {
        requestPending = false;
      }
    };
    void poll();
    const interval = window.setInterval(() => void poll(), 1500);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [channel.id, connectionStatus]);

  if (role !== 'owner') return <OwnerOnly what="Twitch connection" />;

  const connect = async () => {
    setBusy(true);
    setError(null);
    try {
      const { authorizationUrl } = await api.connectTwitch();
      window.location.assign(authorizationUrl);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not start Twitch authorization');
      setBusy(false);
    }
  };

  const disconnect = async () => {
    if (!window.confirm(`Disconnect @${status?.connection?.broadcasterLogin ?? 'this Twitch account'} from ${channel.displayName}?`)) return;
    setBusy(true);
    setError(null);
    try {
      await api.disconnectTwitch();
      await refresh();
      toast.add({ title: 'Twitch disconnected', description: 'Chat commands and live moments are off' });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not disconnect Twitch');
    } finally {
      setBusy(false);
    }
  };

  const saveConfiguration = async () => {
    setBusy(true);
    setError(null);
    try {
      const next = await api.saveTwitchConfiguration(clientId, clientSecret);
      setStatus(next);
      setClientSecret('');
      setEditingConfiguration(false);
      toast.add({ title: 'Twitch app saved', description: 'The credentials and generated webhook secret are stored in D1' });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save the Twitch application');
    } finally {
      setBusy(false);
    }
  };

  const config = status?.configuration;
  const connection = status?.connection;
  const ready = Boolean(config?.ready);
  const enabled = connection?.subscriptions.filter((subscription) => subscription.status === 'enabled').length ?? 0;
  const maskedClientId = clientId ? `${'•'.repeat(Math.min(12, Math.max(6, clientId.length - 6)))}${clientId.slice(-6)}` : 'Not available';

  const cancelConfigurationEdit = () => {
    setClientId(config?.clientId ?? '');
    setClientSecret('');
    setEditingConfiguration(false);
    setError(null);
  };

  return (
    <>
      <Section
        title="Twitch connection"
        sub="One verified connection turns Twitch chat into submissions and votes, and sends live community moments to OBS."
        actions={
          <Button size="sm" variant="ghost" nativeButton={false} render={<a href="https://dev.twitch.tv/console/apps" target="_blank" rel="noopener noreferrer" />}>
            Developer Console <ExternalIcon size={14} />
          </Button>
        }
      >
        <Screen className="relative overflow-hidden p-0">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,rgba(145,70,255,.22),transparent_38%),linear-gradient(135deg,rgba(145,70,255,.08),transparent_55%)]" aria-hidden="true" />
          <div className="relative flex flex-col gap-5 p-5 sm:p-6">
            <div className="flex flex-wrap items-start gap-4">
              <span className="grid size-12 flex-none place-items-center rounded-[15px] bg-[#9146ff] text-white shadow-[0_10px_30px_rgba(145,70,255,.28)]">
                <TwitchIcon size={24} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex flex-wrap items-center gap-2 text-lg font-semibold text-ink-strong">
                  {connection ? `@${connection.broadcasterLogin}` : 'Not connected'}
                  <span
                    className={cn('status inline-flex items-center gap-1.5 whitespace-nowrap', connection?.status === 'connected' && 'text-emerald-300')}
                    aria-live="polite"
                  >
                    {connection?.status === 'connecting' && <span className="size-1.5 animate-pulse rounded-full bg-current" aria-hidden="true" />}
                    {connection?.status ?? (ready ? 'READY' : 'SETUP')}
                  </span>
                </span>
                <span className="max-w-[62ch] text-sm leading-relaxed text-ink-sub">
                  {connection
                    ? connection.status === 'connecting'
                      ? `${enabled}/${connection.subscriptions.length} EventSub listeners enabled. Twitch is confirming the rest—this updates automatically.`
                      : `${enabled}/${connection.subscriptions.length} EventSub listeners enabled for ${channel.displayName}.`
                    : ready
                      ? 'The Twitch application is ready. Authorize the broadcaster account to finish.'
                      : 'Create the Twitch application, save its credentials below, then connect your broadcaster.'}
                </span>
              </span>
              {connection ? (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" disabled={busy || !ready} onClick={() => void connect()}>Reconnect</Button>
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => void disconnect()}>Disconnect</Button>
                </div>
              ) : (
                <Button variant="accent" disabled={busy || !ready} onClick={() => void connect()}>
                  {busy ? 'Opening Twitch…' : 'Connect broadcaster'}
                </Button>
              )}
            </div>

            {connection?.lastError && <span className="rounded-xl border border-red-400/20 bg-red-400/[.07] px-4 py-3 text-sm text-red-200" role="alert">{connection.lastError}</span>}
            {connection && (
              <div className="grid grid-cols-1 gap-3 border-t border-white/[.07] pt-4 sm:grid-cols-3">
                <KeyValue label="Twitch user">{connection.broadcasterDisplayName}</KeyValue>
                <KeyValue label="Last event">{connection.lastEventAt ? new Date(connection.lastEventAt).toLocaleString() : 'Waiting for activity'}</KeyValue>
                <KeyValue label="Authorized">{new Date(connection.connectedAt).toLocaleDateString()}</KeyValue>
              </div>
            )}
          </div>
        </Screen>
        {error && <span className="text-sm text-red-300" role="alert">{error}</span>}
      </Section>

      <Divider />

      <Section title="1 · Register the application" sub="Use these exact values in the Twitch Developer Console. The Worker URL is the correct self-hosted application URL.">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Well className="flex min-w-0 flex-col gap-3 p-5">
            <Label>Worker / application URL</Label>
            <CopyField value={config?.applicationUrl ?? window.location.origin} label="Twitch application URL" />
            <span className="hint">Your deployed Worker. Use this if Twitch asks for a website/application URL; otherwise keep it as your reference.</span>
          </Well>
          <Well className="flex min-w-0 flex-col gap-3 p-5">
            <Label>OAuth Redirect URL</Label>
            <CopyField value={config?.callbackUrl ?? `${window.location.origin}/api/twitch/oauth/callback`} label="Twitch OAuth redirect URL" />
            <span className="hint">Add this exact URL under OAuth Redirect URLs. Do not use only the Worker homepage.</span>
          </Well>
        </div>
        <Well className="px-5 py-2">
          <KeyValue label="Name">Challenge.chat plus your name, if Twitch says the name is taken</KeyValue>
          <KeyValue label="Category">Chat Bot; use Website Integration if Chat Bot is unavailable</KeyValue>
          <KeyValue label="Client secret">After creation, open Manage and choose New Secret</KeyValue>
        </Well>
        <span className="hint">After registration, open <b className="text-ink-soft">Manage</b>, copy the Client ID, and create one Client Secret. The EventSub callback is installed automatically after authorization.</span>
      </Section>

      <Divider />

      <Section title="2 · Application credentials" sub="One Twitch application powers every channel in this Challenge.chat deployment.">
        {ready && !editingConfiguration ? (
          <Screen className="relative overflow-hidden p-0">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_20%,rgba(145,70,255,.18),transparent_35%),linear-gradient(110deg,rgba(255,255,255,.025),transparent_60%)]" aria-hidden="true" />
            <div className="relative flex flex-col gap-5 p-5 sm:p-6">
              <div className="flex flex-wrap items-start gap-4">
                <span className="grid size-11 flex-none place-items-center rounded-[14px] border border-emerald-300/20 bg-emerald-300/[.08] text-emerald-300 shadow-[0_10px_30px_rgba(16,185,129,.08)]">
                  <LockIcon size={20} />
                </span>
                <span className="flex min-w-[220px] flex-1 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2 text-base font-semibold text-ink-strong">
                    Application locked in
                    <span className="status inline-flex items-center gap-1 whitespace-nowrap text-emerald-300"><CheckIcon size={12} /> READY</span>
                  </span>
                  <span className="text-sm leading-relaxed text-ink-sub">Your credentials are stored server-side and ready for Twitch authorization.</span>
                </span>
                <Button size="sm" variant="ghost" disabled={busy || Boolean(connection)} onClick={() => setEditingConfiguration(true)}>
                  <LockIcon size={14} /> {connection ? 'Disconnect to unlock' : 'Unlock to edit'}
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-3 border-t border-white/[.07] pt-4 sm:grid-cols-3">
                <KeyValue label="Client ID"><span className="mono text-xs tracking-[.08em]">{maskedClientId}</span></KeyValue>
                <KeyValue label="Client Secret"><span className="flex items-center gap-2"><LockIcon size={13} /> Stored</span></KeyValue>
                <KeyValue label="EventSub signing"><span className="flex items-center gap-2"><LockIcon size={13} /> Generated</span></KeyValue>
              </div>
              <span className="text-xs text-ink-faint">{config?.source === 'database' ? 'Saved in D1' : 'Loaded from Worker secrets'} · Secret values are never returned to this page</span>
            </div>
          </Screen>
        ) : (
          <Screen className="relative overflow-hidden p-0">
            <div className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-[#9146ff]" aria-hidden="true" />
            <div className="flex flex-col gap-5 p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <span className="flex flex-col gap-1">
                  <span className="font-semibold text-ink-strong">{ready ? 'Credentials unlocked' : 'Add your Twitch application'}</span>
                  <span className="text-sm text-ink-sub">Paste both values from Twitch Manage. Saving locks them into this deployment.</span>
                </span>
                {ready && <Button size="sm" variant="ghost" disabled={busy} onClick={cancelConfigurationEdit}>Cancel</Button>}
              </div>
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <TextField
                  label="Client ID"
                  value={clientId}
                  onChange={(event) => setClientId(event.target.value)}
                  placeholder="Paste the Client ID"
                  autoComplete="off"
                  disabled={busy || Boolean(connection)}
                />
                <TextField
                  label="Client Secret"
                  type="password"
                  value={clientSecret}
                  onChange={(event) => setClientSecret(event.target.value)}
                  placeholder={ready ? 'Paste the new Client Secret' : 'Paste the Client Secret'}
                  autoComplete="new-password"
                  disabled={busy || Boolean(connection)}
                />
              </div>
              <div className="flex flex-wrap items-center gap-3 border-t border-white/[.07] pt-4">
                <Button
                  variant="accent"
                  disabled={busy || Boolean(connection) || clientId.trim().length < 5 || clientSecret.trim().length < 10}
                  onClick={() => void saveConfiguration()}
                >
                  <LockIcon size={14} /> {busy ? 'Saving…' : 'Save & lock'}
                </Button>
                <span className="text-xs leading-relaxed text-ink-sub">A fresh EventSub signing secret is generated automatically.</span>
              </div>
            </div>
          </Screen>
        )}
        {!ready && <span className="flex items-center gap-2 text-sm text-amber-200"><Led tone="warn" /> Client ID and Client Secret required</span>}
        {connection && <span className="hint">Disconnect the broadcaster before changing the global Twitch application credentials.</span>}
      </Section>

      <Divider />

      <Section title="3 · What viewers can do" sub="Commands are case-insensitive and use Twitch's stable viewer ID for authorship and vote limits.">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Well className="flex flex-col gap-2 p-5">
            <span className="mono text-sm font-semibold text-[#b99cff]">!challenge Win without healing</span>
            <span className="text-sm leading-relaxed text-ink-sub">Creates a real suggestion. If submissions are paused, the server safely places it in Inbox.</span>
          </Well>
          <Well className="flex flex-col gap-2 p-5">
            <span className="mono text-sm font-semibold text-[#b99cff]">!vote 2</span>
            <span className="text-sm leading-relaxed text-ink-sub">Votes for the numbered entry in the active ballot. Repeated votes remain idempotent.</span>
          </Well>
        </div>
        <Well className="flex flex-wrap items-center gap-3 px-5 py-4">
          {['Follows', 'Subscriptions', 'Gift subs', 'Raids', 'Cheers'].map((event) => <span key={event} className="rounded-full bg-white/[.05] px-3 py-1.5 text-xs font-medium text-ink-soft shadow-[inset_0_0_0_1px_rgba(255,255,255,.07)]">{event}</span>)}
          <span className="min-w-[220px] flex-1 text-sm text-ink-sub">These become transient overlay alerts and are never allowed to change a challenge result.</span>
          <Button size="sm" variant="ghost" nativeButton={false} render={<Link to={channelPath('/settings/theme')} />}>Configure alerts <ArrowRightIcon size={14} /></Button>
        </Well>
      </Section>

      {connection && (
        <>
          <Divider />
          <Section title="EventSub listeners" sub="Twitch verifies each webhook independently. Reconnect if any listener needs attention.">
            <Well className="overflow-hidden p-0">
              <div className="divide-y divide-white/[.07]">
                {connection.subscriptions.map((subscription) => (
                  <div key={subscription.id} className="flex items-center gap-3 px-5 py-3.5">
                    <Led tone={subscription.status === 'enabled' ? 'ok' : 'warn'} />
                    <span className="mono min-w-0 flex-1 truncate text-xs text-ink-soft">{subscription.type}</span>
                    <span className="status">{subscription.status}</span>
                  </div>
                ))}
              </div>
            </Well>
          </Section>
        </>
      )}
    </>
  );
}

/* ───────── API & MCP ───────── */

function Connections({ channel }: { channel: Channel }) {
  const toast = useToasts();
  const [tokens, setTokens] = useState<ApiTokenSummary[]>([]);
  const [name, setName] = useState('');
  const [freshToken, setFreshToken] = useState<string | null>(null);
  const [integration, setIntegration] = useState<Awaited<ReturnType<typeof api.integrationStatus>> | null>(null);
  const [freshIntegration, setFreshIntegration] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const base = window.location.origin;
  const restUrl = `${base}/api/v1/board?channel=${encodeURIComponent(channel.id)}`;
  const mcpUrl = `${base}/mcp?channel=${encodeURIComponent(channel.id)}`;
  const openApiUrl = `${base}/api/v1/board/openapi.json?channel=${encodeURIComponent(channel.id)}`;

  const refresh = async () => {
    const [{ tokens: next }, integrationStatus] = await Promise.all([api.apiTokens(), api.integrationStatus()]);
    setTokens(next);
    setIntegration(integrationStatus);
  };

  useEffect(() => {
    setFreshToken(null);
    setFreshIntegration(null);
    void refresh().catch((caught) => setError(caught instanceof Error ? caught.message : 'Could not load API access'));
  }, [channel.id]);

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const { token, ...created } = await api.createApiToken(name.trim());
      setFreshToken(token);
      setName('');
      setTokens((current) => [created, ...current]);
      toast.add({ title: 'Board token created', description: 'Copy it now — it is shown once' });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create the token');
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (token: ApiTokenSummary) => {
    if (!window.confirm(`Revoke “${token.name}”? Anything using it will lose access immediately.`)) return;
    setBusy(true);
    try {
      await api.revokeApiToken(token.id);
      setTokens((current) => current.filter((item) => item.id !== token.id));
      toast.add({ title: 'Board token revoked', description: token.name });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not revoke the token');
    } finally {
      setBusy(false);
    }
  };

  const rotateIntegration = async () => {
    if ((integration?.token || integration?.environmentFallback) && !window.confirm('Replace the game integration token? Existing adapters will stop working immediately.')) return;
    setBusy(true);
    setError(null);
    try {
      const created = await api.rotateIntegrationToken();
      setFreshIntegration(created.token);
      setIntegration(await api.integrationStatus());
      toast.add({ title: 'Game token ready', description: 'Copy it now — it is shown once' });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create the game token');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Section
        title="Board API & MCP"
        sub="Named tokens can read and operate this board through REST or MCP. They cannot manage moderators, branding, settings or other boards."
        actions={<Button size="sm" variant="ghost" nativeButton={false} render={<a href={openApiUrl} target="_blank" rel="noopener noreferrer" />}>OpenAPI <ExternalIcon size={14} /></Button>}
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Well className="flex min-w-0 flex-col gap-3 p-5">
            <Label>REST endpoint</Label>
            <CopyField value={restUrl} label="Board REST endpoint" />
            <span className="hint">Send <b className="mono text-ink-soft">Authorization: Bearer ccat_…</b> and keep the channel query parameter.</span>
          </Well>
          <Well className="flex min-w-0 flex-col gap-3 p-5">
            <Label>Remote MCP endpoint</Label>
            <CopyField value={mcpUrl} label="Board MCP endpoint" />
            <span className="hint">Stateless Streamable HTTP with the same board token. Supports MCP 2025 and 2026 clients.</span>
          </Well>
        </div>

        {freshToken && (
          <Screen className="flex flex-col gap-3 px-5 py-4">
            <span className="status">New token · shown once</span>
            <CopyField value={freshToken} label="New board API token" />
            <span className="hint">Challenge.chat stores only its SHA-256 hash. Save it in your MCP client or server secret store before leaving this page.</span>
          </Screen>
        )}

        <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <TextField label="Token name" placeholder="Stream Deck" value={name} maxLength={60} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void create(); }} />
          <Button variant="accent" disabled={busy || !name.trim()} onClick={() => void create()}>Create token</Button>
        </div>

        {tokens.length > 0 && (
          <Well className="overflow-hidden p-0">
            <div className="divide-y divide-white/[.07]">
              {tokens.map((token) => (
                <div key={token.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="text-sm font-semibold text-ink-strong">{token.name}</span>
                    <span className="mono text-[11px] text-ink-muted">ccat_…{token.lastFour} · created {new Date(token.createdAt).toLocaleDateString()}</span>
                  </div>
                  <span className="text-xs text-ink-muted">{token.lastUsedAt ? `Used ${new Date(token.lastUsedAt).toLocaleString()}` : 'Never used'}</span>
                  <Button size="xs" variant="ghost" disabled={busy} onClick={() => void revoke(token)}>Revoke</Button>
                </div>
              ))}
            </div>
          </Well>
        )}
        {error && <span className="text-sm text-red-300" role="alert">{error}</span>}
      </Section>

      <Divider />

      <Section title="Browser WebMCP" sub="When the owner opens the control room in a supported browser, the same board tools are registered directly on the page.">
        <Well className="flex flex-wrap items-center gap-3 px-5 py-4">
          <Led tone="ok" />
          <span className="text-sm font-semibold text-ink-strong">Owner session only</span>
          <span className="text-sm text-ink-sub">No API token is copied into the page, and moderators do not receive these tools.</span>
        </Well>
      </Section>

      <Divider />

      <Section title="Game event token" sub="A narrower credential for game adapters and verified chat backends. It can report metrics and trusted votes, but cannot operate the board.">
        {freshIntegration && (
          <Screen className="flex flex-col gap-3 px-5 py-4">
            <span className="status">New game token · shown once</span>
            <CopyField value={freshIntegration} label="New game integration token" />
          </Screen>
        )}
        <Well className="flex flex-wrap items-center gap-4 px-5 py-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-sm font-semibold text-ink-strong">
              {integration?.token ? `Token ending in ${integration.token.lastFour}` : integration?.environmentFallback ? 'Using the deployment environment token' : 'No game token yet'}
            </span>
            <span className="hint">Board ID: <b className="mono text-ink-soft">{channel.id}</b></span>
          </div>
          <Button size="sm" disabled={busy || !integration} onClick={() => void rotateIntegration()}>
            {integration?.token || integration?.environmentFallback ? 'Replace token' : 'Create token'}
          </Button>
        </Well>
      </Section>
    </>
  );
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
  const [status, setStatus] = useState<Awaited<ReturnType<typeof api.aiStatus>> | null>(null);
  useEffect(() => { void api.aiStatus().then(setStatus).catch(() => setStatus(null)); }, []);
  const parse = session.aiParsing;
  const titles = session.aiChallengeTitles;
  const tone = session.aiRoundNameTone;

  return (
    <>
      <Section title="Provider">
        <Well className="flex flex-wrap items-center gap-3 px-5 py-4">
          <Led tone={status?.configured ? 'ok' : 'warn'} />
          <span className="text-sm font-semibold text-ink-strong">{status?.configured ? 'AI Gateway ready' : 'AI Gateway unavailable'}</span>
          <span className="mono text-xs text-ink-muted">{status ? `${status.gateway} · ${status.model}` : 'checking…'}</span>
          <span className="hint ml-auto">If it's down, everything below falls back to the built-in rules</span>
        </Well>
      </Section>

      <Divider />

      <Section title="Suggestions" sub="Turns free-form !challenge text into a structured draft for moderators to approve">
        <RockerSwitch
          label="Use AI parsing"
          description="Off uses the built-in rules parser, which is faster but needs more moderator edits"
          checked={parse}
          onCheckedChange={(value) => setSessionSettings({ aiParsing: value })}
        />
        {parse && <RockerSwitch label="Write challenge titles" description="A short, readable name like “Pistol Purist”" checked={titles} onCheckedChange={(value) => setSessionSettings({ aiChallengeTitles: value })} />}
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
                onValueChange={(value) => setSessionSettings({ aiRoundNameTone: value })}
              />
            </Rule>
          )}
        </div>
      </Section>
    </>
  );
}

/* ───────── Dev ───────── */

type MockChatLine = {
  id: string;
  viewer: string;
  message: string;
  detail: string;
  failed?: boolean;
};

function DevTools({ channel, onSaved }: { channel: Channel; onSaved?: () => Promise<void> }) {
  const [state, setState] = useState<AppState | null>(null);
  const overlayConfig = useOverlayConfig();
  const [viewer, setViewer] = useState('TestViewer');
  const [message, setMessage] = useState('');
  const [lines, setLines] = useState<MockChatLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gameRun, setGameRun] = useState<LiveRunProjection | null>(null);
  const [gameBusy, setGameBusy] = useState(false);
  const [gameError, setGameError] = useState<string | null>(null);
  const [gameEvents, setGameEvents] = useState<string[]>([]);

  useEffect(() => {
    void api.state().then(setState).catch((caught) => setError(caught instanceof Error ? caught.message : 'Could not load the board'));
    void frameworkClient.liveRun().then(({ projection }) => setGameRun(projection)).catch(() => undefined);
  }, [channel.id]);

  const append = (line: Omit<MockChatLine, 'id'>) => {
    setLines((current) => [...current, { ...line, id: crypto.randomUUID() }].slice(-30));
  };

  const sync = async () => {
    const next = await api.state();
    setState(next);
    if (onSaved) await onSaved();
    return next;
  };

  const send = async () => {
    const name = viewer.trim();
    const text = message.trim();
    if (!name) return setError('Give the mock viewer a name');
    if (!text) return setError('Write a chat message or command');
    setBusy(true);
    setError(null);
    try {
      const command = parseMockChatMessage(text);
      let detail = 'Local chat message — no board event sent';

      if (command.type === 'invalid') {
        throw new Error(command.error);
      } else if (command.type === 'challenge') {
        const current = await api.state();
        await api.createChallenge({ text: command.text, game: 'Mock chat', author: { displayName: name.slice(0, 40) } });
        detail = current.session.phase === 'collecting' && current.session.submissionsOpen ? 'Challenge sent to Submissions' : 'Challenge saved to Inbox';
      } else if (command.type === 'vote') {
        const current = await api.state();
        const entry = current.ballot?.entries[command.position - 1];
        if (!current.ballot) throw new Error('Open voting before sending a !vote command');
        if (!entry) throw new Error(`Choose a vote from 1–${current.ballot.entries.length}`);
        await api.vote(current.ballot.id, entry.challenge.id, mockViewerId(name));
        detail = `Vote sent for ${entry.challenge.title}`;
      }

      append({ viewer: name, message: text, detail });
      setMessage('');
      if (command.type !== 'message') await sync();
    } catch (caught) {
      const description = caught instanceof Error ? caught.message : 'Could not send this event';
      setError(description);
      append({ viewer: name, message: text, detail: description, failed: true });
    } finally {
      setBusy(false);
    }
  };

  const phase = state?.session.phase ?? 'loading';
  const challengeDestination = state?.session.phase === 'collecting' && state.session.submissionsOpen ? 'Submissions' : 'Inbox';
  const kills = gameRun?.metrics.find((metric) => metric.id === 'kills');
  const gameActive = gameRun && ['countdown', 'active', 'paused'].includes(gameRun.status);

  const ensureKillCounter = async () => {
    if (overlayConfig.elements.kills) return;
    const { config } = await api.updateOverlayConfig({
      ...overlayConfig,
      elements: { ...overlayConfig.elements, kills: true },
    });
    hydrateOverlayConfig(config);
    await onSaved?.();
  };

  const startGameRun = async () => {
    setGameBusy(true);
    setGameError(null);
    try {
      const current = await frameworkClient.liveRun();
      let projection = current.projection;
      if (projection && ['countdown', 'active', 'paused'].includes(projection.status)) {
        if (!projection.metrics.some((metric) => metric.id === 'kills')) {
          throw new Error('Another custom game run is active. Finish it before starting the kill tracker.');
        }
      } else {
        projection = (await frameworkClient.createRun({ ...KILL_CHALLENGE_EXAMPLE, countdownSeconds: 0 })).projection;
        setGameEvents([]);
      }
      await ensureKillCounter();
      setGameRun(projection);
      setGameEvents((events) => [...events, 'Kill tracker connected — OBS counter enabled'].slice(-12));
    } catch (caught) {
      setGameError(caught instanceof Error ? caught.message : 'Could not start the game event test');
    } finally {
      setGameBusy(false);
    }
  };

  const sendKill = async () => {
    if (!gameRun || !gameActive) return;
    setGameBusy(true);
    setGameError(null);
    try {
      const { projection } = await frameworkClient.publishEvent(gameRun.runId, {
        source: 'dev-custom-game',
        idempotencyKey: `dev-custom-game:${crypto.randomUUID()}`,
        occurredAt: new Date().toISOString(),
        event: { type: 'metric.incremented', metric: 'kills', by: 1 },
      });
      setGameRun(projection);
      const value = projection.metrics.find((metric) => metric.id === 'kills')?.value ?? 0;
      setGameEvents((events) => [...events, `enemy_defeated → kills ${value}`].slice(-12));
    } catch (caught) {
      setGameError(caught instanceof Error ? caught.message : 'Could not send the game event');
    } finally {
      setGameBusy(false);
    }
  };

  return (
    <>
      <Section title="Mock Chat" sub={`Send realistic chat commands into ${channel.displayName}. These use the selected board's real server state.`}>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,.8fr)]">
          <Screen className="flex min-h-[360px] flex-col overflow-hidden p-0">
            <div className="flex items-center justify-between gap-4 border-b border-white/[.07] px-5 py-3.5">
              <span className="flex items-center gap-2 text-sm font-semibold text-ink-strong">
                <Led tone="ok" />
                #{channel.broadcasterLogin || channel.slug}
              </span>
              <span className="mono text-[11px] tracking-[.1em] text-ink-muted">{phase.toUpperCase()}</span>
            </div>
            <div className="flex flex-1 flex-col justify-end gap-3 overflow-y-auto px-5 py-5" aria-live="polite">
              {lines.length ? lines.map((line) => (
                <div key={line.id} className="flex items-start gap-3 text-sm">
                  <Avatar name={line.viewer} size={28} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <b className="font-semibold text-accent-text">{line.viewer}</b>
                      <span className="break-words text-ink">{line.message}</span>
                    </span>
                    <span className={cn('mt-1 block text-xs', line.failed ? 'text-red-300' : 'text-ink-muted')}>{line.detail}</span>
                  </span>
                </div>
              )) : (
                <div className="m-auto flex max-w-[320px] flex-col items-center gap-2 text-center">
                  <span className="grid size-12 place-items-center rounded-[16px] border border-accent/25 bg-accent/10 text-accent-text">
                    <BoltIcon size={22} />
                  </span>
                  <strong className="text-lg text-ink-strong">Chat simulator ready</strong>
                  <span className="text-sm leading-relaxed text-pretty text-ink-sub">Send a command below and watch it enter the real round flow.</span>
                </div>
              )}
            </div>
          </Screen>

          <form
            className="flex flex-col gap-5"
            onSubmit={(event) => {
              event.preventDefault();
              if (!busy) void send();
            }}
          >
            <TextField
              label="Viewer"
              value={viewer}
              maxLength={40}
              placeholder="TestViewer"
              onChange={(event) => setViewer(event.target.value)}
            />
            <TextField
              label="Chat message"
              value={message}
              maxLength={500}
              placeholder="!challenge Win without healing"
              error={error ?? undefined}
              onChange={(event) => {
                setMessage(event.target.value);
                if (error) setError(null);
              }}
              suffix={
                <Button type="submit" variant="accent" size="xs" icon disabled={busy || !message.trim()} aria-label="Send chat event">
                  <ArrowRightIcon size={15} />
                </Button>
              }
            />

            <Well className="flex flex-col gap-3 p-4">
              <Label>Quick commands</Label>
              <button type="button" className="mono cursor-pointer border-0 bg-transparent p-0 text-left text-xs text-accent-text hover:text-ink-strong" onClick={() => setMessage('!challenge Win the next fight without healing')}>
                !challenge Win the next fight without healing
              </button>
              <button type="button" className="mono cursor-pointer border-0 bg-transparent p-0 text-left text-xs text-accent-text hover:text-ink-strong" onClick={() => setMessage('!vote 1')}>
                !vote 1
              </button>
              <span className="hint">Challenge commands currently go to <b className="text-ink-soft">{challengeDestination}</b>.</span>
            </Well>

            {state?.ballot ? (
              <Well className="flex flex-col gap-2.5 p-4">
                <Label>Open vote</Label>
                {state.ballot.entries.map((entry, index) => (
                  <button
                    key={entry.challenge.id}
                    type="button"
                    className="flex cursor-pointer items-center gap-3 border-0 bg-transparent p-0 text-left text-sm text-ink-soft hover:text-ink-strong"
                    onClick={() => setMessage(`!vote ${index + 1}`)}
                  >
                    <span className="mono grid size-6 flex-none place-items-center rounded-md bg-white/[.06] text-xs text-ink-strong">{index + 1}</span>
                    <span className="truncate">{entry.challenge.title}</span>
                  </button>
                ))}
              </Well>
            ) : (
              <span className="hint">Open a vote in the control room to enable <b className="mono text-ink-soft">!vote</b> events.</span>
            )}
          </form>
        </div>
      </Section>

      <Divider />

      <Section title="Custom Game API" sub="Exercise the real framework event path: a game adapter reports an enemy defeat, Cloudflare updates the run, and the React overlay SDK renders the kill counter.">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,.8fr)]">
          <Screen className="flex min-h-[240px] flex-col overflow-hidden p-0">
            <div className="flex items-center justify-between gap-4 border-b border-white/[.07] px-5 py-3.5">
              <span className="flex items-center gap-2 text-sm font-semibold text-ink-strong">
                <Led tone={gameActive ? 'ok' : undefined} />
                Game event stream
              </span>
              <span className="mono text-[11px] tracking-[.1em] text-ink-muted">{gameRun?.status.toUpperCase() ?? 'OFFLINE'}</span>
            </div>
            <div className="flex flex-1 flex-col justify-end gap-2 overflow-y-auto px-5 py-5" aria-live="polite">
              {gameEvents.length ? gameEvents.map((event, index) => (
                <div key={`${event}-${index}`} className="mono text-xs text-ink-sub">
                  <span className="mr-3 text-accent-text">{String(index + 1).padStart(2, '0')}</span>{event}
                </div>
              )) : (
                <div className="m-auto flex max-w-[360px] flex-col items-center gap-2 text-center">
                  <span className="mono text-5xl font-bold text-ink-strong">{typeof kills?.value === 'number' ? String(kills.value).padStart(2, '0') : '00'}</span>
                  <strong className="text-lg text-ink-strong">Kill counter ready to test</strong>
                  <span className="text-sm leading-relaxed text-pretty text-ink-sub">Start a tracked run, then send the same normalized event a game integration would report.</span>
                </div>
              )}
            </div>
          </Screen>

          <div className="flex flex-col gap-4">
            <Well className="flex flex-col gap-3 p-5">
              <KeyValue label="Metric">kills</KeyValue>
              <KeyValue label="Current">{typeof kills?.value === 'number' ? `${kills.value} / ${typeof kills.target === 'number' ? kills.target : '—'}` : 'Not running'}</KeyValue>
              <KeyValue label="OBS element">{overlayConfig.elements.kills ? 'Enabled' : 'Off'}</KeyValue>
            </Well>
            <Button variant="accent" disabled={gameBusy} onClick={() => void (gameActive ? sendKill() : startGameRun())}>
              {gameActive ? 'Send enemy defeated' : 'Start kill tracker'}
            </Button>
            {gameActive && !overlayConfig.elements.kills && (
              <Button disabled={gameBusy} onClick={() => void ensureKillCounter()}>Enable kill counter</Button>
            )}
            {gameError && <span className="text-sm text-red-300">{gameError}</span>}
            <span className="hint">The adapter sends <b className="mono text-ink-soft">metric.incremented</b>; it never writes to OBS directly.</span>
          </div>
        </div>
      </Section>

      <Divider />

      <Section title="Supported Events" sub="The simulator uses authenticated control-room APIs and never talks to the overlay directly.">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Well className="flex flex-col gap-2 p-5">
            <span className="mono text-sm font-semibold text-accent-text">!challenge idea</span>
            <span className="text-sm leading-relaxed text-ink-sub">Creates a real viewer suggestion. Closed submissions route it to Inbox automatically.</span>
          </Well>
          <Well className="flex flex-col gap-2 p-5">
            <span className="mono text-sm font-semibold text-accent-text">!vote number</span>
            <span className="text-sm leading-relaxed text-ink-sub">Casts one real vote for the named mock viewer while a ballot is open.</span>
          </Well>
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

/** The overlay's look: draft a theme and its settings, then save them together. */
function OverlayTheme({ channelName, onSaved }: { channelName: string; onSaved?: () => Promise<void> }) {
  const config = useOverlayConfig();
  const [draft, setDraft] = useState(config);
  const [saved, setSaved] = useState(config);
  const [saving, setSaving] = useState(false);
  const toast = useToasts();
  const display = useMemo(() => displayOf(draft), [draft]);
  const themes = useThemes();
  const theme = getTheme(display.theme) ?? themes[0];
  const values = resolveSettings(theme.settings, display.settings);
  const edited = Object.keys(draft.settings[theme.id] ?? {}).length > 0;
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const [scene, setScene] = useState<PreviewScene>('live');

  useEffect(() => {
    setDraft(config);
    setSaved(config);
  }, [config]);

  const setTheme = (id: string) => setDraft((current) => ({ ...current, theme: id }));
  const setSettings = (id: string, patch: Record<string, unknown> | null) => {
    const safe = Object.fromEntries(Object.entries(patch ?? {}).filter(([, value]) =>
      value === null || typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value)),
    )) as OverlayConfig['settings'][string];
    setDraft((current) => ({
      ...current,
      settings: { ...current.settings, [id]: patch ? { ...current.settings[id], ...safe } : {} },
    }));
  };
  const save = async () => {
    setSaving(true);
    try {
      const { config: persisted } = await api.updateOverlayConfig(draft);
      hydrateOverlayConfig(persisted);
      setDraft(persisted);
      setSaved(persisted);
      await onSaved?.();
      toast.add({ title: 'Overlay updated', description: 'Theme and config are live in OBS' });
    } catch (caught) {
      toast.add({ title: 'Could not update overlay', description: caught instanceof Error ? caught.message : 'Try again' });
    } finally {
      setSaving(false);
    }
  };

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
            onValueChange={setTheme}
          />
        }
      >
        <div className="flex flex-col gap-5">
          {/* The real overlay, drawn by the theme with these settings */}
          <OverlayPreview
            display={display}
            scene={scene === 'streamer' || scene === 'chat' ? 'result' : scene}
            winner={scene === 'chat' ? 'chat' : 'streamer'}
            channelName={channelName}
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
            <Button size="sm" variant="ghost" onClick={() => setSettings(theme.id, null)}>
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
                <SettingControl key={`${theme.id}.${key}`} def={def} value={values[key]} onChange={(v) => setSettings(theme.id, { [key]: v })} />
              ))}
            </div>
          </div>
        ))}
      </Section>

      {dirty && (
        <Well className="sticky bottom-4 z-10 flex flex-wrap items-center gap-3 p-3 pl-5">
          <Led tone="warn" />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-sm font-semibold text-ink-strong">Unsaved overlay changes</span>
            <span className="hint">Previewed here only until you update the overlay</span>
          </span>
          <Button size="sm" variant="ghost" disabled={saving} onClick={() => setDraft(saved)}>
            Discard
          </Button>
          <Button size="sm" variant="accent" disabled={saving} onClick={() => void save()}>
            {saving ? 'Updating…' : 'Update overlay'}
          </Button>
        </Well>
      )}
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

/** Board-owned colours: a primary from the presets or a custom pick, and chat's colour, which follows the primary unless picked. */
function Appearance({
  name,
  primary,
  chat,
  onPrimaryChange,
  onChatChange,
}: {
  name: string;
  primary: string;
  chat: string | null;
  onPrimaryChange: (hex: string) => void;
  onChatChange: (hex: string | null) => void;
}) {
  const chatHex = chat ?? complement(primary);
  const chatAuto = chat === null;
  const vars = { '--sw-size': '30px' } as CSSProperties;

  return (
    <Section title="Appearance">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label>Primary</Label>
          <ThemeSwitcher size={30} value={primary} onChange={onPrimaryChange} />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Chat</Label>
          <div className="flex flex-wrap items-center gap-3">
            <ColorPopover value={chatHex} onChange={onChatChange} aria-label="Pick a custom chat colour">
              <button
                type="button"
                className="sw sw-picker"
                data-on=""
                style={{ ...vars, background: `linear-gradient(180deg, ${lighten(chatHex, 0.28)}, ${chatHex})` }}
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
              onValueChange={(v) => onChatChange(v === 'auto' ? null : chatHex)}
            />
            <span className="mono text-[11px] tracking-[.08em] text-ink-label">{chatHex.toUpperCase()}</span>
          </div>
        </div>
      </div>
      {/* The two sides as the scoreboard paints them: each glows in from its own edge, scores on the outside. */}
      <Well
        className="flex items-center gap-4 overflow-hidden px-5 py-4"
        style={{ background: `linear-gradient(90deg, ${primary}1f, transparent 35%, transparent 65%, ${chatHex}1f), linear-gradient(180deg, #0c0e0f 0%, #121416 100%)` }}
      >
        <span className="flex flex-none items-center gap-3">
          <span className="pixel text-[28px] leading-none" style={{ color: lighten(primary, 0.28), textShadow: `0 0 14px ${primary}99` }}>
            3,500
          </span>
          <span className="size-2.5 rounded-full" style={{ background: primary, boxShadow: `0 0 10px ${primary}` }} />
        </span>
        <span className="h-px flex-1 bg-white/10" aria-hidden="true" />
        <span className="flex flex-none items-baseline gap-2.5 text-[13px] font-semibold text-ink-strong">
          {name || 'Streamer'}
          <span className="text-[17px] font-medium text-ink-muted">vs</span>
          Chat
        </span>
        <span className="h-px flex-1 bg-white/10" aria-hidden="true" />
        <span className="flex flex-none items-center gap-3">
          <span className="size-2.5 rounded-full" style={{ background: chatHex, boxShadow: `0 0 10px ${chatHex}` }} />
          <span className="pixel text-[28px] leading-none" style={{ color: lighten(chatHex, 0.28), textShadow: `0 0 14px ${chatHex}99` }}>
            2,250
          </span>
        </span>
      </Well>
    </Section>
  );
}
