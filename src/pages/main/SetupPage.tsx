import { useEffect, useRef, useState } from 'react';
import { CheckIcon, ExternalIcon, MegaphoneIcon, PlayIcon, RocketIcon, UsersIcon } from '@/components/icons';
import { Logo } from '@/components/Logo';
import { Button, Label, Panel, Screen, Select, TextField, ThemeSwitcher, useToasts, VLine, Well } from '@/components/ui';
import { SITE } from '@/model';
import { useOverlayConfig, useOverlayDisplay } from '@/data/overlayConfig';
import { useThemes } from '@/overlay/sdk';
import { useTheme } from '@/theme/ThemeProvider';
import { ACCENT_PRESETS } from '@/theme/accent';
import { useChatVars } from '@/theme/useChatVars';
import '@/pages/app/app.css';
import '@/scoreboard/scoreboard.css';
import { useChallengeChatController } from '@/framework/use-challenge-chat';
import { channelPath } from '@/framework/channel';

/** A chat command, set like a key on the board */
const Cmd = ({ children }: { children: string }) => (
  <span className="mono rounded-[6px] bg-white/[.06] px-1.5 py-px text-[12px] text-ink-strong shadow-[inset_0_0_0_1px_rgba(255,255,255,.08)]">{children}</span>
);

const STEPS = [
  { title: 'Chat Suggests', body: <>Viewers type <Cmd>!challenge</Cmd> and their idea</>, Icon: MegaphoneIcon },
  { title: 'You Pick', body: 'Approve the good ones for a vote', Icon: CheckIcon },
  { title: 'Chat Votes', body: <>Chat picks with <Cmd>!vote</Cmd>, and the top ones make the round</>, Icon: UsersIcon },
  { title: 'You Play', body: 'Beat it and you score, fail it and chat does', Icon: PlayIcon },
];

/**
 * /setup — what someone sees before they have a board: what Challenge.Chat is, how a round runs,
 * and a short form for their first board. Everything here can change later in Settings.
 */
export function SetupPage() {
  useChatVars();
  const toast = useToasts();
  const controller = useChallengeChatController();
  const [name, setName] = useState('');
  const [login, setLogin] = useState('');
  const themes = useThemes();
  const display = useOverlayDisplay();
  const config = useOverlayConfig();
  const theme = useTheme();
  const accentApplied = useRef(false);
  const fieldsInitialized = useRef(false);
  const [overlay, setOverlay] = useState(display.theme);
  const [tried, setTried] = useState(false);
  const ready = name.trim() && login;

  useEffect(() => {
    if (accentApplied.current) return;
    accentApplied.current = true;
    const requested = Number(new URLSearchParams(window.location.search).get('accent'));
    if (Number.isInteger(requested) && requested >= 0 && requested < ACCENT_PRESETS.length) theme.setPreset(requested);
  }, [theme]);

  useEffect(() => {
    if (!controller.state || fieldsInitialized.current) return;
    fieldsInitialized.current = true;
    if (controller.state.channel.setupComplete) {
      setName(controller.state.channel.displayName);
      setLogin(controller.state.sessionSettings.twitchLogin ?? controller.state.channel.broadcasterLogin);
    }
    setOverlay(controller.state.overlayConfig.theme);
  }, [controller.state]);

  const create = () => {
    setTried(true);
    if (!ready || !controller.state) return;
    void controller.mutate(async () => {
      await controller.actions.updateChannel(name.trim(), controller.state!.channel.slug);
      await controller.actions.updateSessionSettings({ ...controller.state!.sessionSettings, twitchLogin: login });
      await controller.actions.updateOverlayConfig({ ...config, theme: overlay });
      await controller.actions.updateTheme({ ...controller.state!.theme, primary: theme.hex, accent: theme.chatHex });
      toast.add({ title: 'Board ready', description: name.trim() });
      window.location.assign(channelPath('/', controller.state!.channel.id));
    });
  };

  return (
    <div className="page-bg flex min-h-screen flex-col text-ink">
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6 px-4 pt-6 pb-16 sm:px-8">
        <Panel as="header" className="flex items-center gap-3 rounded-[20px] py-4 pr-4 pl-4 sm:gap-4 sm:pl-6">
          <a href={SITE} target="_blank" rel="noopener noreferrer" className="flex flex-none rounded-lg no-underline" aria-label="Challenge.Chat">
            <Logo size={24} />
          </a>
          <VLine />
          <span className="text-[15px] leading-none font-semibold text-ink-soft sm:text-[17px]">Setup</span>
          <div className="flex-1" />
          <Button size="sm" variant="ghost" nativeButton={false} render={<a href={`${SITE}/docs`} target="_blank" rel="noopener noreferrer" />}>
            Docs
            <ExternalIcon size={14} />
          </Button>
        </Panel>

        {/* ───────── Hero + first board ───────── */}
        <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
          <Screen className="flex flex-col justify-center gap-8 px-6 py-7 sm:px-8 sm:py-9">
            <div className="flex flex-col gap-4">
              <h1 className="m-0 text-[clamp(30px,4.4vw,44px)] leading-[1.05] font-bold tracking-[-.02em] text-white">Let chat set your challenges</h1>
              <p className="m-0 max-w-[46ch] text-[15px] leading-relaxed text-ink-soft">
                Viewers suggest challenges, vote on the best ones, and you play them live for points against chat
              </p>
            </div>
            <ScoreStrip />
          </Screen>

          <Panel as="section" aria-label="Create your first board" className="settings-form flex flex-col gap-6 px-5 py-6 sm:px-7 sm:py-7">
            <h2 className="m-0 text-[20px] font-bold tracking-[-.01em] text-ink-strong">Create Your First Board</h2>
            <TextField
              label="Board name"
              placeholder="Friday Night Challenges"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={tried && !name.trim() ? 'Give the board a name' : undefined}
            />
            <TextField
              label="Twitch channel"
              prefix={<span className="mono text-[13px] text-ink-faint">twitch.tv/</span>}
              placeholder="your_channel"
              value={login}
              maxLength={25}
              spellCheck={false}
              onChange={(e) => setLogin(e.target.value.replace(/^\s*(https?:\/\/)?(www\.)?twitch\.tv\//i, '').replace(/[^a-zA-Z0-9_]/g, ''))}
              error={tried && !login ? 'Add the channel chat plays from' : undefined}
            />
            {/* Presets only here; a custom colour and theme settings wait for Settings */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>Colour</Label>
                <div className="flex min-h-[48px] items-center">
                  <ThemeSwitcher size={26} readout={false} custom={false} />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Overlay theme</Label>
                <Select aria-label="Overlay theme" options={themes.map((t) => ({ value: t.id, label: t.name }))} value={overlay} onValueChange={setOverlay} />
              </div>
            </div>
            <Button variant="accent" size="lg" className="mt-auto w-full" loading={controller.busy} loadingLabel="Creating…" onClick={create}>
              <RocketIcon size={18} />
              Create Board
            </Button>
          </Panel>
        </div>

        {/* ───────── How a round works ───────── */}
        <Panel as="section" aria-label="How a round works" className="flex flex-col gap-5 px-5 py-6 sm:px-7">
          <h2 className="m-0 text-[17px] font-bold tracking-[-.01em] text-ink-strong">How a Round Works</h2>
          {/* A track: lit stops joined by a line that fades toward the end, stacked on phones */}
          <ol className="m-0 grid list-none grid-cols-1 gap-x-5 gap-y-4 p-0 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((st, i) => (
              <li key={st.title} className="relative flex gap-3.5 lg:flex-col lg:gap-3">
                {i < STEPS.length - 1 && (
                  <span
                    className="absolute top-5 right-[-20px] left-[52px] hidden h-px bg-[linear-gradient(90deg,rgba(var(--ar),.55),rgba(var(--ar),.08))] lg:block"
                    aria-hidden="true"
                  />
                )}
                <span className="relative grid size-10 flex-none place-items-center rounded-full bg-[radial-gradient(circle_at_50%_35%,rgba(var(--ar),.32),rgba(var(--ar),.1))] text-accent-text shadow-[inset_0_0_0_1px_rgba(var(--ar),.45),0_0_16px_rgba(var(--ar),.25)]">
                  <st.Icon size={17} />
                </span>
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="text-[15px] font-semibold text-ink-strong">{st.title}</span>
                  <span className="text-[13px] leading-snug text-pretty text-ink-sub">{st.body}</span>
                </span>
              </li>
            ))}
          </ol>
        </Panel>

        <footer className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 pt-2 pr-3 pl-4 sm:pr-6 sm:pl-7">
          <a href={SITE} target="_blank" rel="noopener noreferrer" className="flex rounded-md no-underline" aria-label="Challenge.Chat">
            <Logo size={16} animated={false} challengeBg="#3a4046" challengeText="#d6dce1" chatBg="#24282b" chatText="#8f99a2" />
          </a>
          <a href={`${SITE}/docs`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[13px] text-ink-muted no-underline hover:text-ink-strong">
            Docs
            <ExternalIcon size={11} />
          </a>
        </footer>
      </div>
    </div>
  );
}

/** The streamer-versus-chat score in the hero, in the board's colours */
function ScoreStrip() {
  const theme = useTheme();
  return (
    <Well
      className="flex items-center gap-2.5 px-4 py-4 sm:gap-4 sm:px-5"
      style={{ background: `linear-gradient(90deg, rgba(var(--ar),.14), transparent 38%, transparent 62%, rgba(var(--cr),.14)), linear-gradient(180deg, #0c0e0f 0%, #121416 100%)` }}
    >
      <span className="pixel text-[clamp(22px,3.4vw,32px)] leading-none" style={{ color: 'var(--a-hi)', textShadow: `0 0 14px ${theme.hex}99` }}>
        3,500
      </span>
      <span className="h-px min-w-2 flex-1 bg-white/10" aria-hidden="true" />
      <span className="flex items-baseline gap-2.5 text-[13px] font-semibold text-ink-strong">
        You <span className="text-[17px] font-medium text-ink-muted">vs</span> Chat
      </span>
      <span className="h-px min-w-2 flex-1 bg-white/10" aria-hidden="true" />
      <span className="pixel text-[clamp(22px,3.4vw,32px)] leading-none" style={{ color: 'var(--c-hi)', textShadow: `0 0 14px ${theme.chatHex}99` }}>
        2,250
      </span>
    </Well>
  );
}
