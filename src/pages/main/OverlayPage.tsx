import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type PointerEvent, type ReactNode, type RefObject } from 'react';
import { useSearchParams } from 'react-router';
import { ChevronDownIcon, CopyIcon, UploadIcon } from '@/components/icons';
import { Button, Label, MiniSwitch, Panel, SegmentedControl, Select, Tabs, TextField, ThemeSwitcher, useToasts } from '@/components/ui';
import { setOverlayElement, setOverlayTheme, setThemeSettings, useOverlayDisplay } from '@/data/overlayConfig';
import { useSessionSettings } from '@/data/sessionSettings';
import { cn } from '@/lib/cn';
import { embedFor } from '@/overlay/controls/embed';
import { OverlayCanvas } from '@/overlay/controls/OverlayCanvas';
import { ThemeSettingsForm } from '@/overlay/controls/ThemeSettingsForm';
import { createMockSource, type MockSource } from '@/overlay/mock/source';
import {
  getTheme,
  listThemes,
  OverlayProvider,
  OverlayRenderer,
  resolveSettings,
  useDisplay,
  useMetrics,
  useOverlayEvent,
  useOverlayStore,
  useRound,
  useSides,
  useThemes,
  type OverlayEvent,
  type Scene,
  type Side,
} from '@/overlay/sdk';
import { useChatVars } from '@/theme/useChatVars';

/**
 * /overlay — the overlay studio: the broadcast overlay as it sits on stream, over mock gameplay, with a
 * floating panel to build and test it. Authored at 1920×1080 (an OBS browser source) and scaled to fit
 * the window. Everything on the canvas comes from the overlay SDK: a mock source stands in for the
 * Worker, and the registered theme draws it.
 *
 * The panel: Theme (which theme, colours, settings), Game (the control room's buttons, metrics), Elements
 * (what's on screen), Events (fire Twitch alerts, watch every event the overlay gets) and Canvas (background —
 * mock gameplay, a still, or a live Twitch / YouTube player — facecam, safe-area guides). Theme, settings and
 * elements are the board's (src/data/overlayConfig), shared live with the control room; ?scene=&winner=&bg= set the start, and ?ui=0 drops the panel for a clean capture.
 */

const SCENE_LABEL: Record<Scene, string> = {
  idle: 'Off',
  open: 'Ideas',
  vote: 'Vote',
  lock: 'Up next',
  live: 'Live',
  result: 'Winner',
  done: 'Results',
};
const SCENES = Object.keys(SCENE_LABEL) as Scene[];

/** Behind the overlay: the mock gameplay, OBS's transparent checkerboard, a screenshot of your own, or a Twitch / YouTube player. */
type Bg = 'game' | 'clear' | 'own' | 'video';

/* ───────────────────────── Page ───────────────────────── */

function useOverlayParams() {
  const [params, setParams] = useSearchParams();
  const raw = params.get('scene');
  const bg = params.get('bg');
  const set = (patch: Record<string, string>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(patch)) next.set(k, v);
        return next;
      },
      { replace: true },
    );
  return {
    scene: (raw === 'off' ? 'idle' : SCENES.includes(raw as Scene) ? raw : 'live') as Scene,
    winner: (params.get('winner') === 'chat' ? 'chat' : 'streamer') as Side,
    bg: (bg === 'clear' || bg === 'own' || bg === 'video' ? bg : 'game') as Bg,
    ui: params.get('ui') !== '0',
    set,
  };
}

type Params = ReturnType<typeof useOverlayParams>;

const TABS = ['theme', 'game', 'elements', 'events', 'canvas'] as const;
type Tab = (typeof TABS)[number];
/** The studio's own layout, remembered in this browser. */
type Pos = { x: number; y: number };
type Prefs = {
  tab: Tab;
  /** Where the panel was dragged to; null sits it bottom-right. */
  pos: Pos | null;
  /** Panel width, dragged from either side. */
  width: number;
  facecam: boolean; guides: boolean; /** Twitch or YouTube link for the video background. */ video: string; sound: boolean };
const PREFS_KEY = 'challenge-chat:overlay-studio';
const DEFAULT_PREFS: Prefs = { tab: 'theme', pos: null, width: 380, facecam: true, guides: false, video: '', sound: false };

function usePrefs() {
  const [prefs, setPrefs] = useState<Prefs>(() => {
    try {
      const saved = { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') };
      // A tab that's since been renamed or removed opens the first one
      return TABS.includes(saved.tab) ? saved : { ...saved, tab: DEFAULT_PREFS.tab };
    } catch {
      return DEFAULT_PREFS;
    }
  });
  const set = (patch: Partial<Prefs>) =>
    setPrefs((p) => {
      const next = { ...p, ...patch };
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      } catch {
        // storage unavailable — keep it for this visit
      }
      return next;
    });
  return [prefs, set] as const;
}

/** A screenshot picked from disk, for this visit only. */
type Shot = { url: string; name: string };

export function OverlayPage({ readOnly = false }: { readOnly?: boolean }) {
  useChatVars();
  const p = useOverlayParams();
  const [prefs, setPrefs] = usePrefs();
  const [shot, setShot] = useState<Shot | null>(null);
  const display = useOverlayDisplay();
  const { autoNext, autoNextSecs } = useSessionSettings();
  // The URL only seeds the mock; after that the panel drives it
  const [source] = useState(() => createMockSource({ scene: p.scene, winner: p.winner, display, options: { autoNext, autoNextSecs } }));
  // The board's theme, settings and elements, as set here or from the control room in another tab
  useEffect(() => source.controls.setDisplay(display), [source, display]);
  // The control room's auto-next setting, as saved in Settings
  useEffect(() => source.controls.setOptions({ autoNext, autoNextSecs }), [source, autoNext, autoNextSecs]);
  useEffect(() => () => void (shot && URL.revokeObjectURL(shot.url)), [shot]);

  const embed = useMemo(() => embedFor(prefs.video, { sound: prefs.sound }), [prefs.video, prefs.sound]);
  // "Your image" without one picked (a reload), or video without a link that plays, falls back to the mock gameplay
  const own = p.bg === 'own' && shot;
  const canvasBg = p.bg === 'clear' ? 'clear' : p.bg === 'video' && embed ? 'video' : 'game';

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#050607]">
      <OverlayProvider source={source}>
        <OverlayCanvas bg={canvasBg} shot={own ? shot.url : undefined} video={embed?.src} facecam={prefs.facecam} guides={p.ui && prefs.guides}>
          <OverlayRenderer />
        </OverlayCanvas>
        {p.ui && <StudioPanel source={source} params={p} prefs={prefs} setPrefs={setPrefs} shot={shot} setShot={setShot} readOnly={readOnly} />}
      </OverlayProvider>
    </div>
  );
}

/* ───────────────────────── Studio panel ───────────────────────── */

type PanelProps = { source: MockSource; params: Params };
type StudioProps = PanelProps & {
  prefs: Prefs;
  setPrefs: (patch: Partial<Prefs>) => void;
  shot: Shot | null;
  setShot: (shot: Shot | null) => void;
  readOnly: boolean;
};

/** How close the panel may get to the window's edge. */
const EDGE = 12;
/** Narrower and the five tabs stop fitting. */
const MIN_W = 360;
const MAX_W = 720;

function useViewport() {
  const [vp, setVp] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useEffect(() => {
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return vp;
}

/**
 * Floating controls for building and testing the overlay. A fixed height, so most of the frame stays in
 * view. Drag the header to move it out of the way (double-click to send it back), drag either side to
 * make it wider or narrower (double-click a side to reset); H folds it away.
 */
function StudioPanel(props: StudioProps) {
  const { prefs, setPrefs } = props;
  const [open, setOpen] = useState(true);
  const toast = useToasts();
  const log = useEventLog();
  const [autoAlerts, setAutoAlerts] = useAutoAlerts();

  const panel = useRef<HTMLDivElement>(null);
  const vp = useViewport();
  /** Pointer offset inside the panel while dragging. */
  const grab = useRef<Pos | null>(null);
  const [drag, setDrag] = useState<Pos | null>(null);
  /** Where a side drag started, and the panel's box then. */
  const pull = useRef<{ edge: 'left' | 'right'; from: number; x: number; y: number; w: number } | null>(null);
  const [sizing, setSizing] = useState<(Pos & { w: number }) | null>(null);
  const clampW = (w: number) => Math.round(Math.min(Math.max(MIN_W, w), Math.min(MAX_W, vp.w - EDGE * 2)));
  // Saved before width was a setting (or hand-edited): fall back to the default
  const width = sizing?.w ?? clampW(Number.isFinite(prefs.width) ? prefs.width : DEFAULT_PREFS.width);
  // Kept fully on screen, including when the window shrinks after it was placed
  const clamp = (p: Pos): Pos => {
    const h = panel.current?.offsetHeight ?? 560;
    return { x: Math.min(Math.max(EDGE, p.x), Math.max(EDGE, vp.w - width - EDGE)), y: Math.min(Math.max(EDGE, p.y), Math.max(EDGE, vp.h - h - EDGE)) };
  };
  const placed = drag ?? sizing ?? prefs.pos;
  const at = placed ? clamp(placed) : null;

  const onPull = (edge: 'left' | 'right') => (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !panel.current) return;
    const r = panel.current.getBoundingClientRect();
    pull.current = { edge, from: e.clientX, x: r.left, y: r.top, w: r.width };
    e.currentTarget.setPointerCapture(e.pointerId);
    setSizing({ x: r.left, y: r.top, w: r.width });
  };
  const onPullMove = (e: PointerEvent<HTMLDivElement>) => {
    const p = pull.current;
    if (!p) return;
    const dx = e.clientX - p.from;
    // The far side stays put: pulling the left edge moves the panel as it grows
    const w = clampW(p.edge === 'right' ? p.w + dx : p.w - dx);
    setSizing({ x: p.edge === 'right' ? p.x : p.x + p.w - w, y: p.y, w });
  };
  const onPullEnd = () => {
    if (!pull.current) return;
    pull.current = null;
    if (sizing) setPrefs({ width: sizing.w, pos: clamp(sizing) });
    setSizing(null);
  };
  const sideHandle = (edge: 'left' | 'right') => (
    <div
      className={cn('group absolute inset-y-6 z-10 flex w-3 cursor-ew-resize touch-none justify-center', edge === 'left' ? '-left-1.5' : '-right-1.5')}
      onPointerDown={onPull(edge)}
      onPointerMove={onPullMove}
      onPointerUp={onPullEnd}
      onPointerCancel={onPullEnd}
      onDoubleClick={() => setPrefs({ width: DEFAULT_PREFS.width })}
      title="Drag to resize · double-click to reset"
      aria-hidden="true"
    >
      <span className={cn('w-[3px] rounded-full bg-accent transition-opacity', sizing ? 'opacity-80' : 'opacity-0 group-hover:opacity-60')} />
    </div>
  );

  const onGrab = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button') || !panel.current) return;
    const r = panel.current.getBoundingClientRect();
    grab.current = { x: e.clientX - r.left, y: e.clientY - r.top };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ x: r.left, y: r.top });
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => grab.current && setDrag({ x: e.clientX - grab.current.x, y: e.clientY - grab.current.y });
  const onDrop = () => {
    if (!grab.current) return;
    grab.current = null;
    if (drag) setPrefs({ pos: clamp(drag) });
    setDrag(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'h' || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, [contenteditable]')) return;
      setOpen((o) => !o);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const copyLink = async () => {
    const url = `${window.location.origin}/overlay?ui=0&bg=clear`;
    try {
      await navigator.clipboard.writeText(url);
      toast.add({ title: 'Overlay link copied', description: 'Add it to OBS as a 1920 × 1080 browser source' });
    } catch {
      toast.add({ title: "Couldn't copy the link", description: url });
    }
  };

  if (!open) {
    return (
      // Always bottom-right when folded; opening puts the panel back where it was
      <button type="button" onClick={() => setOpen(true)} className="chip fixed right-4 bottom-4 z-30 cursor-pointer border-0">
        Studio ▴
      </button>
    );
  }

  return (
    <Panel
      ref={panel}
      className={cn(
        'fixed z-30 flex h-[min(560px,calc(100dvh-24px))] max-w-[calc(100vw-24px)] flex-col rounded-[20px]',
        !at && 'right-3 bottom-3',
        drag && 'shadow-[0_32px_64px_-12px_rgba(0,0,0,0.85)]',
        sizing && 'select-none',
      )}
      style={{ width, ...(at && { left: at.x, top: at.y }) }}
      aria-label="Overlay studio"
    >
      {sideHandle('left')}
      {sideHandle('right')}
      <div
        className={cn('flex flex-none touch-none items-center gap-1 px-5 pt-4 pb-3 select-none', drag ? 'cursor-grabbing' : 'cursor-grab')}
        onPointerDown={onGrab}
        onPointerMove={onMove}
        onPointerUp={onDrop}
        onPointerCancel={onDrop}
        onDoubleClick={(e) => !(e.target as HTMLElement).closest('button') && setPrefs({ pos: null })}
        title="Drag to move · double-click to put back"
      >
        <span className="mr-1.5 grid flex-none grid-cols-2 gap-[3px] opacity-50" aria-hidden="true">
          {Array.from({ length: 6 }, (_, i) => (
            <i key={i} className="size-[3px] rounded-full bg-ink-sub" />
          ))}
        </span>
        <Label className="flex-1 text-accent-text">Overlay studio</Label>
        <Button size="xs" variant="ghost" icon onClick={copyLink} aria-label="Copy the OBS browser source link" title="Copy OBS link">
          <CopyIcon size={15} />
        </Button>
        <Button size="xs" variant="ghost" icon onClick={() => setOpen(false)} aria-label="Hide the studio (H)" title="Hide (H)">
          <ChevronDownIcon size={15} />
        </Button>
      </div>

      <Tabs
        aria-label="Studio"
        className="min-h-0 flex-1 gap-0 px-5 [&_.tab]:px-2 [&_.tab]:text-[13px]"
        panelClassName="-mx-5 min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-5 pb-6"
        value={prefs.tab}
        onValueChange={(tab) => setPrefs({ tab })}
        items={[
          { value: 'theme', label: 'Theme', content: <ThemeTab readOnly={props.readOnly} /> },
          { value: 'game', label: 'Game', content: <GameTab {...props} /> },
          { value: 'elements', label: 'Elements', content: <ElementsTab readOnly={props.readOnly} /> },
          { value: 'events', label: 'Events', content: <EventsTab log={log} autoAlerts={autoAlerts} setAutoAlerts={setAutoAlerts} /> },
          { value: 'canvas', label: 'Canvas', content: <CanvasTab {...props} /> },
        ]}
      />
    </Panel>
  );
}

/** Drive the session: jump to a scene, or press the control room's buttons and watch the overlay follow. */
function GameTab({ source, params }: PanelProps) {
  const c = source.controls;
  const r = useRound();
  const sides = useSides();
  const metrics = useMetrics();
  const [auto, setAuto] = useState(false);

  const jump = (s: Scene, winner = params.winner) => {
    c.seed(s, winner);
    params.set({ scene: s === 'idle' ? 'off' : s, winner });
  };

  return (
    <div className="flex flex-col gap-6">
      <Row label="Autoplay" hint="Plays whole sessions on its own, back to back">
        <MiniSwitch
          checked={auto}
          onCheckedChange={(on) => {
            setAuto(on);
            c.setAutoplay(on);
          }}
          aria-label="Autoplay"
        />
      </Row>

      <Group label="Jump to">
        <div className="segc well grid grid-cols-4" role="group" aria-label="Overlay scene">
          {SCENES.map((s) => (
            <button
              key={s}
              type="button"
              className={cn('segc-item min-h-[34px] px-1.5 text-[12px]', r.scene === s && 'active')}
              aria-pressed={r.scene === s}
              onClick={() => jump(s)}
            >
              {SCENE_LABEL[s]}
            </button>
          ))}
        </div>
      </Group>

      <Group label={`Now · ${SCENE_LABEL[r.scene]}`}>
        <p className="mono m-0 min-h-[18px] text-[12px] tracking-[.04em] text-ink-sub">{statusLine(r)}</p>
        <Actions source={source} />
        {(r.stage === 'live' || r.stage === 'done') && (
          <p className="m-0 text-[13px] text-ink-sub">
            {sides.streamer.name} <b className="mono text-ink-strong">{r.score.streamer.points.toLocaleString('en-US')}</b> · {sides.chat.name}{' '}
            <b className="mono text-ink-strong">{r.score.chat.points.toLocaleString('en-US')}</b>
            {r.streak.count >= 2 && r.streak.side && ` · ${sides[r.streak.side].name} on ${r.streak.count} in a row`}
          </p>
        )}
      </Group>

      <Group label="Metrics">
        {Object.values(metrics).map((m) => (
          <Row key={m.id} label={m.label} hint={typeof m.target === 'number' ? `${m.value} of ${m.target}` : String(m.value)}>
            <Button size="xs" onClick={() => c.bumpMetric(m.id, -1)} aria-label={`${m.label} down`}>
              −
            </Button>
            <Button size="xs" onClick={() => c.bumpMetric(m.id, m.kind === 'gauge' ? 25 : 1)} aria-label={`${m.label} up`}>
              +{m.kind === 'gauge' ? 25 : 1}
            </Button>
          </Row>
        ))}
      </Group>
    </div>
  );
}

/** What the SDK says is happening, in one line. */
function statusLine(r: ReturnType<typeof useRound>) {
  switch (r.stage) {
    case 'idle':
      return 'No session';
    case 'open':
      return `${r.submissions.count} ${r.submissions.count === 1 ? 'idea' : 'ideas'} · ${r.submissions.open ? 'open' : 'closed'}`;
    case 'vote':
      return `${r.ballot?.total ?? 0} votes · ${r.ballot?.clock?.text ?? ''} left`;
    case 'lock':
      return `${r.lineup.length} locked in`;
    case 'live': {
      const bits = [`${r.progress.number}/${r.progress.total}`, r.phase ?? '', r.countdown != null ? `starts in ${r.countdown}` : (r.clock?.text ?? '')];
      if (r.attempts?.max) bits.push(`try ${r.attempts.current}/${r.attempts.max}`);
      if (r.next) bits.push(`next in ${r.next.text}`);
      return bits.filter(Boolean).join(' · ');
    }
    case 'done':
      return r.winner ? `Over · winner ${r.winner}` : 'Over · all square';
  }
}

/** The control room's buttons for whatever stage the session is in. */
function Actions({ source }: { source: MockSource }) {
  const c = source.controls;
  const r = useRound();
  const sides = useSides();
  const btn = (label: string, onClick: () => void, opts: { accent?: boolean; disabled?: boolean } = {}) => (
    <Button key={label} size="sm" variant={opts.accent ? 'accent' : 'default'} disabled={opts.disabled} onClick={onClick}>
      {label}
    </Button>
  );

  let buttons: ReactNode[] = [];
  switch (r.stage) {
    case 'idle':
      buttons = [btn('Open submissions', c.open, { accent: true })];
      break;
    case 'open':
      buttons = [
        btn('Add idea', c.addIdea, { disabled: !r.submissions.open }),
        btn(r.submissions.open ? 'Close ideas' : 'Reopen', () => c.setIdeasOpen(!r.submissions.open)),
        btn('Start vote', c.vote, { accent: true, disabled: r.submissions.count < 2 }),
      ];
      break;
    case 'vote':
      buttons = [btn('Close vote', c.closeVote, { accent: true })];
      break;
    case 'lock':
      buttons = [btn('Start', c.start, { accent: true })];
      break;
    case 'live':
      buttons = r.call
        ? [btn('Undo', c.undo), btn(r.upNext ? 'Next challenge' : 'Finish', c.next, { accent: true })]
        : [
            btn(`${sides.streamer.name} wins`, () => c.call('streamer'), { accent: true }),
            btn(`${sides.chat.name} wins`, () => c.call('chat'), { accent: true }),
            btn(r.attempts?.last ? 'Fail (last try)' : 'Fail try', c.fail),
            btn(r.phase === 'paused' ? 'Resume' : 'Pause', r.phase === 'paused' ? c.resume : c.pause, { disabled: r.phase === 'countdown' }),
            btn('Skip', c.skip),
            btn('End session', c.end),
          ];
      break;
    case 'done':
      buttons = [btn('New session', c.open, { accent: true }), btn('File & clear', c.reset)];
      break;
  }
  return <div className="flex flex-wrap gap-2">{buttons}</div>;
}

/** Pick the theme and tune it. The form is built from the theme's own settings schema; changes are the board's, so Settings → Theme sees them too. */
function ThemeTab({ readOnly }: { readOnly: boolean }) {
  const display = useDisplay();
  const themes = useThemes();
  const theme = getTheme(display.theme) ?? themes[0];
  const values = resolveSettings(theme.settings, display.settings);

  return (
    <fieldset disabled={readOnly} className="m-0 flex min-w-0 flex-col gap-6 border-0 p-0">
      {readOnly && <p className="hint m-0">Theme controls are owner-only. Preview and mock game controls still work.</p>}
      <Group label="Theme">
        <Select
          aria-label="Overlay theme"
          size="sm"
          options={themes.map((t) => ({ value: t.id, label: t.name }))}
          value={theme.id}
          onValueChange={setOverlayTheme}
        />
        {theme.description && <p className="hint m-0">{theme.description}</p>}
      </Group>

      <Group label="Board colours">
        <ThemeSwitcher size={22} readout={false} />
      </Group>

      <ThemeSettingsForm schema={theme.settings} values={values} onChange={(key, v) => setThemeSettings(theme.id, { [key]: v })} />

      <Button size="sm" variant="ghost" onClick={() => setThemeSettings(theme.id, null)}>
        Reset to defaults
      </Button>
    </fieldset>
  );
}

/* ───────────────────────── Elements ───────────────────────── */

/**
 * The theme's switchable elements, grouped the way the control room's sheet groups them (ungrouped first).
 * Switches are the board's, so the control room sees them too.
 */
function ElementsTab({ readOnly }: { readOnly: boolean }) {
  const display = useDisplay();
  const theme = getTheme(display.theme) ?? listThemes()[0];
  const all = Object.entries(theme.elements);
  const groups = [...new Set(all.map(([, e]) => e.group ?? ''))].sort((a, b) => (a ? 1 : 0) - (b ? 1 : 0));
  const on = all.filter(([id]) => display.elements[id]).length;
  const setAll = (value: boolean) => all.forEach(([id]) => setOverlayElement(id, value));

  return (
    <fieldset disabled={readOnly} className="m-0 flex min-w-0 flex-col gap-6 border-0 p-0">
      {readOnly && <p className="hint m-0">Overlay element switches are owner-only.</p>}
      <div className="flex items-center gap-2">
        <span className="flex-1 text-[13px] text-ink-sub">
          <b className="mono text-ink-strong">{on}</b> of {all.length} on screen
        </span>
        <Button size="xs" variant="ghost" disabled={on === all.length} onClick={() => setAll(true)}>
          All on
        </Button>
        <Button size="xs" variant="ghost" disabled={on === 0} onClick={() => setAll(false)}>
          All off
        </Button>
      </div>
      {groups.map((g) => (
        <Group key={g} label={g || 'Built in'}>
          <div className="flex flex-col gap-1">
            {all
              .filter(([, e]) => (e.group ?? '') === g)
              .map(([id, e]) => (
                <Row key={id} label={e.label} hint={e.description}>
                  <MiniSwitch checked={!!display.elements[id]} onCheckedChange={(v) => setOverlayElement(id, v)} aria-label={e.label} />
                </Row>
              ))}
          </div>
        </Group>
      ))}
    </fieldset>
  );
}

/* ───────────────────────── Events ───────────────────────── */

/** Twitch moments the overlay can alert on, sent as `custom` events with `{ user, amount }`. */
const ALERTS: { name: string; label: string; amount?: () => number }[] = [
  { name: 'follow', label: 'Follow' },
  { name: 'sub', label: 'Sub', amount: () => pick([1, 1, 3, 6, 12, 24]) },
  { name: 'gift', label: 'Gift subs', amount: () => pick([1, 5, 10, 20, 50]) },
  { name: 'raid', label: 'Raid', amount: () => Math.round(20 + Math.random() * 780) },
  { name: 'cheer', label: 'Cheer', amount: () => pick([100, 250, 500, 1000, 5000]) },
];
const VIEWERS = ['pixelbrat', 'mossgirl', 'kodawan', 'birb_watch', 'lowkeyleo', 'quietqueen', 'teaandtoast', 'nova_rx', 'sneakybeak', 'fragqueen'];
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

function useFireAlert() {
  const store = useOverlayStore();
  return (name: string) => {
    const a = ALERTS.find((x) => x.name === name);
    store.emit({ type: 'custom', name, data: { user: pick(VIEWERS), amount: a?.amount?.() } });
  };
}

/** Fires a random alert every few seconds while on, so you can see how the overlay copes with a busy stream. */
function useAutoAlerts() {
  const [on, setOn] = useState(false);
  const fire = useFireAlert();
  const fireRef = useRef(fire);
  useEffect(() => {
    fireRef.current = fire;
  });
  useEffect(() => {
    if (!on) return;
    let t: ReturnType<typeof setTimeout>;
    const loop = () => {
      fireRef.current(pick(ALERTS).name);
      t = setTimeout(loop, 5000 + Math.random() * 7000);
    };
    t = setTimeout(loop, 600);
    return () => clearTimeout(t);
  }, [on]);
  return [on, setOn] as const;
}

type LogEntry = { id: number; at: number; e: OverlayEvent };
type Log = { entries: LogEntry[]; clear: () => void };
let logId = 0;

/** Every event the overlay receives, newest first. Kept while the panel is open, across tabs. */
function useEventLog(): Log {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  useOverlayEvent('*', (e) => setEntries((xs) => [{ id: ++logId, at: Date.now(), e }, ...xs].slice(0, 60)));
  return { entries, clear: () => setEntries([]) };
}

function EventsTab({ log, autoAlerts, setAutoAlerts }: { log: Log; autoAlerts: boolean; setAutoAlerts: (on: boolean) => void }) {
  const fire = useFireAlert();
  const display = useDisplay();
  const sides = useSides();
  const [ticks, setTicks] = useState(false);
  const alertsOff = display.elements.alerts === false;
  // Metric changes arrive every few seconds (followers, kills); hidden unless asked for
  const shown = log.entries.filter((x) => ticks || x.e.type !== 'metric');

  return (
    <div className="flex flex-col gap-6">
      <Group label="Twitch alerts">
        <div className="flex flex-wrap gap-2">
          {ALERTS.map((a) => (
            <Button key={a.name} size="sm" onClick={() => fire(a.name)}>
              {a.label}
            </Button>
          ))}
        </div>
        <Row label="Random alerts" hint="One every 5–12 seconds, like a busy stream">
          <MiniSwitch checked={autoAlerts} onCheckedChange={setAutoAlerts} aria-label="Random alerts" />
        </Row>
        {alertsOff && (
          <Row label="Alerts are off" hint="The theme won't show them until they're on">
            <Button size="xs" variant="accent" onClick={() => setOverlayElement('alerts', true)}>
              Turn on
            </Button>
          </Row>
        )}
      </Group>

      <Group label="Event log">
        <Row label="Metric changes" hint="Follower and kill ticks">
          <MiniSwitch checked={ticks} onCheckedChange={setTicks} aria-label="Show metric changes" />
        </Row>
        <div className="well flex flex-col overflow-hidden rounded-[12px] py-1">
          {shown.length ? (
            shown.map(({ id, at, e }) => (
              <div key={id} className="flex items-baseline gap-2.5 px-3 py-[7px] text-[12px] leading-snug">
                <span className="mono flex-none text-ink-faint">{timeOf(at)}</span>
                <span className="mono flex-none font-semibold text-accent-text">{e.type === 'custom' ? e.name : e.type}</span>
                <span className="min-w-0 flex-1 truncate text-ink-sub">{describe(e, sides)}</span>
              </div>
            ))
          ) : (
            <p className="hint m-0 px-3 py-4">Nothing yet. Press a button here or on the Game tab and each event the overlay gets shows up here</p>
          )}
        </div>
        {log.entries.length > 0 && (
          <Button size="xs" variant="ghost" className="self-start" onClick={log.clear}>
            Clear log
          </Button>
        )}
      </Group>
    </div>
  );
}

const timeOf = (ms: number) => new Date(ms).toLocaleTimeString('en-GB', { hour12: false });

/** One event in a line. */
function describe(e: OverlayEvent, sides: ReturnType<typeof useSides>): string {
  const name = (s: Side) => sides[s].name;
  switch (e.type) {
    case 'stage':
      return `${e.from ?? 'none'} → ${e.to ?? 'none'}`;
    case 'idea':
      return `${e.challenge.title} · ${e.challenge.by}`;
    case 'votes':
      return `+${e.delta} · ${e.total} total`;
    case 'lineup':
      return `${e.lineup.length} challenges`;
    case 'round.start':
      return `#${e.index + 1} ${e.challenge.title}`;
    case 'round.attempt':
      return `try ${e.attempt}${e.max ? ` of ${e.max}` : ''} · ${e.challenge.title}`;
    case 'round.pause':
    case 'round.resume':
    case 'round.undo':
      return e.challenge.title;
    case 'round.call':
      return `${name(e.winner)} +${e.points} · ${e.challenge.title}`;
    case 'round.end':
      return `${e.winner ? name(e.winner) : 'skipped'} · ${e.challenge.title}`;
    case 'lead':
      return e.leader ? `${name(e.leader)} leads` : 'all square';
    case 'streak':
      return `${name(e.side)} × ${e.count}`;
    case 'session.end':
      return `${e.winner ? `${name(e.winner)} wins` : 'tied'} ${e.points.streamer}–${e.points.chat}`;
    case 'metric':
      return `${e.id} ${String(e.from)} → ${String(e.value)}`;
    case 'goal':
      return `${e.id} reached ${e.value}`;
    case 'custom': {
      const d = (e.data ?? {}) as { user?: string; amount?: number };
      return [d.user, d.amount].filter((x) => x != null).join(' · ');
    }
  }
}

/* ───────────────────────── Canvas ───────────────────────── */

/** What's behind the overlay, and guides for lining it up. */
function CanvasTab({ params, prefs, setPrefs, shot, setShot }: StudioProps) {
  const input = useRef<HTMLInputElement>(null);
  const videoField = useRef<HTMLInputElement>(null);
  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setShot({ url: URL.createObjectURL(file), name: file.name });
    params.set({ bg: 'own' });
  };

  return (
    <div className="flex flex-col gap-6">
      <Group label="Background">
        <SegmentedControl
          fill
          aria-label="Background"
          options={[
            { value: 'game', label: 'Gameplay' },
            { value: 'clear', label: 'Transparent' },
            { value: 'own', label: 'Image' },
            { value: 'video', label: 'Video' },
          ]}
          value={params.bg === 'own' && !shot ? 'game' : params.bg}
          onValueChange={(bg) => {
            if (bg === 'own' && !shot) return input.current?.click();
            params.set({ bg });
            if (bg === 'video' && !embedFor(prefs.video)) videoField.current?.focus();
          }}
        />
        <input ref={input} type="file" accept="image/*" className="hidden" onChange={onPick} />
        <Row label={shot ? shot.name : 'Your own screenshot'} hint={shot ? 'Stays until you reload' : 'A 16:9 still from your game, to check the overlay against it'}>
          <Button size="xs" onClick={() => input.current?.click()}>
            <UploadIcon size={14} />
            {shot ? 'Replace' : 'Choose'}
          </Button>
        </Row>
      </Group>

      <VideoSource params={params} prefs={prefs} setPrefs={setPrefs} field={videoField} />

      <Group label="Frame">
        <Row label="Facecam" hint="A stand-in camera, to check nothing sits under it">
          <MiniSwitch checked={prefs.facecam} onCheckedChange={(facecam) => setPrefs({ facecam })} aria-label="Facecam" />
        </Row>
        <Row label="Safe-area guides" hint="Action and title safe, centre lines and thirds">
          <MiniSwitch checked={prefs.guides} onCheckedChange={(guides) => setPrefs({ guides })} aria-label="Safe-area guides" />
        </Row>
      </Group>

      <Group label="On stream">
        <p className="hint m-0">
          The copy button up top gives the link for OBS: add it as a browser source at 1920 × 1080. <span className="mono">?ui=0</span> drops this
          panel and <span className="mono">bg=clear</span> keeps the background transparent. <b className="text-ink-soft">H</b> hides the panel here
        </p>
      </Group>
    </div>
  );
}

/** A real stream or video behind the overlay: a Twitch channel, VOD or clip, or a YouTube video or live link. */
function VideoSource({ params, prefs, setPrefs, field }: Pick<StudioProps, 'params' | 'prefs' | 'setPrefs'> & { field: RefObject<HTMLInputElement | null> }) {
  const [draft, setDraft] = useState(prefs.video);
  const parsed = embedFor(draft);
  const playing = params.bg === 'video' && embedFor(prefs.video);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!parsed) return;
    setPrefs({ video: draft.trim() });
    params.set({ bg: 'video' });
  };

  return (
    <Group label="Video">
      <form className="flex flex-col gap-3" onSubmit={submit}>
        <TextField
          ref={field}
          label="Stream or video link"
          placeholder="twitch.tv/channel or youtube.com/watch?v=…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          error={draft.trim() && !parsed ? 'Paste a Twitch channel, VOD or clip, or a YouTube link' : undefined}
          description={parsed ? `${parsed.label}${playing && draft.trim() === prefs.video ? ' · playing' : ''}` : 'Plays muted behind the overlay, filling the frame like OBS would'}
        />
        <div className="flex items-center gap-2">
          <Button type="submit" size="sm" variant={parsed && draft.trim() !== prefs.video ? 'accent' : 'default'} disabled={!parsed}>
            {playing && draft.trim() === prefs.video ? 'Playing' : 'Play'}
          </Button>
          {prefs.video && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setDraft('');
                setPrefs({ video: '' });
                if (params.bg === 'video') params.set({ bg: 'game' });
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </form>
      <Row label="Sound" hint="Off by default; browsers only autoplay muted">
        <MiniSwitch checked={prefs.sound} onCheckedChange={(sound) => setPrefs({ sound })} aria-label="Video sound" />
      </Row>
    </Group>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[38px] items-center gap-2">
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[14px] font-semibold text-ink-soft">{label}</span>
        {hint && <span className="hint text-[12px]">{hint}</span>}
      </span>
      {children}
    </div>
  );
}
