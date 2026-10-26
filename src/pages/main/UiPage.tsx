import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import * as Icons from '@/components/icons';
import { ExternalIcon, InboxIcon, LayoutIcon, PlusIcon, SettingsIcon, TrashIcon } from '@/components/icons';
import { Logo } from '@/components/Logo';
import {
  Button,
  Chip,
  ColorPopover,
  ConfirmDialog,
  CountBadge,
  Label,
  MiniSwitch,
  Panel,
  RockerSwitch,
  Screen,
  SegmentedControl,
  SegmentMeter,
  Select,
  Sheet,
  Stepper,
  Tag,
  TextField,
  ThemeSwitcher,
  Timer,
  Toggle,
  Tooltip,
  useToasts,
  VLine,
  Well,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import { CopyField, Led, Section } from '@/pages/app/parts';
import { useTheme } from '@/theme/ThemeProvider';
import { useChatVars } from '@/theme/useChatVars';
import { EDGE_TABLE } from './Boards';
import '@/pages/app/app.css';
import '@/scoreboard/scoreboard.css';

const SECTIONS = [
  { id: 'rules', label: 'Rules' },
  { id: 'color', label: 'Colour' },
  { id: 'type', label: 'Type' },
  { id: 'buttons', label: 'Buttons' },
  { id: 'fields', label: 'Fields' },
  { id: 'toggles', label: 'Toggles' },
  { id: 'surfaces', label: 'Surfaces' },
  { id: 'feedback', label: 'Feedback' },
  { id: 'data', label: 'Data' },
  { id: 'icons', label: 'Icons' },
];

/** The three product terms, in the order they nest */
const TERMS = [
  { term: 'Board', meaning: 'A named home for challenges, scores and a leaderboard', example: 'Halloween Week, Friday Night Challenges' },
  { term: 'Round', meaning: 'One cycle of collecting suggestions, voting and picking what gets played', example: 'Round 3, Knives Only' },
  { term: 'Challenge', meaning: 'One specific thing someone attempts', example: 'Get three eliminations without taking damage' },
];

const COPY_RULES = [
  'No periods at the end of any UI copy, including hints, toasts and dialogs',
  'One sentence per line of copy, so join or cut rather than add a second',
  'Title case for section titles, field labels and buttons, sentence case for hints',
  'Say streamer-versus-chat in lower case, and vs without a period',
  'Use · to join a bold tooltip heading to its detail',
  'Use an em dash at most once per line, and only for a real aside',
  'Name things after what they do on screen, not how they work',
  'Status lines are plain sentence case, like Chat is voting, with no arrows or caps',
  'Add a subtitle or hint only when it says something the title or label doesn\'t',
];

const LAYOUT_RULES = [
  'Settings fields sit in a two-column grid that stacks on phones',
  'Labels go above controls, except overlay segments, numbers and toggles, which sit on one row',
  'Sections are split by a divider, with actions in the section header on the right',
  'Panels pad 16px on phones and 28px from sm up, and tables run edge to edge',
  'Destructive buttons stay ghost, and the confirm dialog carries the warning',
  'Icon buttons get the primary ring when pressed or when something they control is live',
];

const ACCENT_SHADES = ['--a-pale', '--a-text', '--a-hi', '--a', '--a-lo', '--a-deep', '--a-ink'];
const CHAT_SHADES = ACCENT_SHADES.map((v) => v.replace('--a', '--c'));
/** Theme tokens as literal classes, so Tailwind emits them (it drops theme vars nothing uses) */
const CHASSIS = ['bg-chassis-950', 'bg-chassis-900', 'bg-chassis-850', 'bg-chassis-800', 'bg-chassis-750', 'bg-chassis-700', 'bg-chassis-650', 'bg-chassis-600'];
const INKS = ['bg-ink-strong', 'bg-ink', 'bg-ink-soft', 'bg-ink-label', 'bg-ink-sub', 'bg-ink-muted', 'bg-ink-faint'];

/** /ui — every part the product uses, live, with the rules for putting them together */
export function UiPage() {
  useChatVars();
  const toast = useToasts();
  const theme = useTheme();
  const [text, setText] = useState('Halloween Week');
  const [num, setNum] = useState(45);
  const [seg, setSeg] = useState('10');
  const [state, setState] = useState('live');
  const [pick, setPick] = useState('arcade');
  const [color, setColor] = useState('#58f29b');
  const [toggles, setToggles] = useState({ a: true, b: false, c: true, d: true });
  const [sheet, setSheet] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const flip = (k: keyof typeof toggles) => (v: boolean) => setToggles((t) => ({ ...t, [k]: v }));

  const icons = Object.entries(Icons).filter(([name]) => name.endsWith('Icon')) as [string, (p: { size?: number }) => ReactNode][];

  return (
    <div className="page-bg flex min-h-screen flex-col text-ink">
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6 px-4 pt-6 pb-24 sm:px-8">
        <Panel as="header" className="flex items-center gap-3 rounded-[20px] py-4 pr-4 pl-4 sm:gap-4 sm:pl-6">
          <Link to="/" className="flex flex-none rounded-lg no-underline" aria-label="Back to the app">
            <Logo size={24} />
          </Link>
          <VLine />
          <h1 className="m-0 text-[15px] leading-none font-semibold text-ink-strong sm:text-[17px]">UI</h1>
          <div className="flex-1" />
          <ThemeSwitcher size={20} readout={false} />
        </Panel>

        <nav aria-label="UI sections" className="sticky top-0 z-20 -mx-4 overflow-x-auto bg-[#0e1012]/85 px-4 backdrop-blur-sm [scrollbar-width:none] sm:-mx-8 sm:px-8 [&::-webkit-scrollbar]:hidden">
          <div className="utabs w-max min-w-full gap-4">
            {SECTIONS.map((s) => (
              <a key={s.id} href={`#${s.id}`} className="utab px-2 tracking-wider whitespace-nowrap no-underline">
                {s.label}
              </a>
            ))}
          </div>
        </nav>

        <div className="settings-form flex flex-col gap-6">
          {/* ───────── Rules ───────── */}
          <Block id="rules" title="Rules" sub="How copy, layout and colour fit together across the product">
            <div className="-mx-4 sm:-mx-7">
              <table className={EDGE_TABLE}>
                <thead>
                  <tr>
                    <th className="w-[120px]">Term</th>
                    <th>Meaning</th>
                    <th className="w-[34%] max-sm:hidden">Example</th>
                  </tr>
                </thead>
                <tbody>
                  {TERMS.map((t) => (
                    <tr key={t.term}>
                      <td className="text-[15px] font-semibold text-ink-strong">{t.term}</td>
                      <td className="text-[14px] text-ink-soft">{t.meaning}</td>
                      <td className="text-[13px] text-ink-muted max-sm:hidden">{t.example}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <RuleList title="Copy" items={COPY_RULES} />
              <RuleList title="Layout" items={LAYOUT_RULES} />
            </div>
          </Block>

          {/* ───────── Colour ───────── */}
          <Block id="color" title="Colour" sub="The primary drives the streamer's side, and chat is its opposite hue unless picked in Settings">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <Swatches label={`Primary · ${theme.hex.toUpperCase()}`} vars={ACCENT_SHADES} />
              <Swatches label={`Chat · ${theme.chatHex.toUpperCase()}`} vars={CHAT_SHADES} />
              <Swatches label="Chassis" vars={CHASSIS} />
              <Swatches label="Ink" vars={INKS} />
            </div>
          </Block>

          {/* ───────── Type ───────── */}
          <Block id="type" title="Type" sub="Geist for words, Geist Mono for codes and times, Geist Pixel for scores">
            <div className="flex flex-col gap-4">
              <Specimen meta="Section title · 17 bold">
                <span className="text-[17px] font-bold tracking-[-.01em] text-ink-strong">Board Details</span>
              </Specimen>
              <Specimen meta="Body · 15 semibold">
                <span className="text-[15px] font-semibold text-ink-strong">Knife Only Round</span>
              </Specimen>
              <Specimen meta="Hint · 13">
                <span className="hint">Goes to whoever wins each challenge, at the value it started with</span>
              </Specimen>
              <Specimen meta="Label · 13 semibold">
                <span className="lbl">Points Per Challenge</span>
              </Specimen>
              <Specimen meta="Status · 13 semibold primary">
                <span className="status">Chat is voting</span>
              </Specimen>
              <Specimen meta="Code · mono 13">
                <span className="mono text-[13px] text-ink-soft">ch_7k2m9q</span>
              </Specimen>
              <Specimen meta="Score · pixel 28">
                <span className="pixel text-[28px] leading-none" style={{ color: 'var(--a-hi)', textShadow: '0 0 14px rgba(var(--ar),.6)' }}>
                  3,500
                </span>
              </Specimen>
            </div>
          </Block>

          {/* ───────── Buttons ───────── */}
          <Block id="buttons" title="Buttons" sub="Accent for the one main action, default and ghost around it, quiet in the header">
            <Row label="Variants">
              <Button variant="accent">Save Changes</Button>
              <Button>Default</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="solid">Solid</Button>
              <Button variant="quiet">Quiet</Button>
            </Row>
            <Row label="Sizes">
              <Button size="lg" variant="accent">Large</Button>
              <Button>Medium</Button>
              <Button size="sm">Small</Button>
              <Button size="xs">Extra Small</Button>
            </Row>
            <Row label="With icons">
              <Button variant="accent">
                <PlusIcon size={16} />
                New Round
              </Button>
              <Button variant="ghost" size="sm">
                Docs
                <ExternalIcon size={14} />
              </Button>
              <Button size="xs" icon aria-label="Delete">
                <TrashIcon size={14} />
              </Button>
            </Row>
            <Row label="Header icons">
              <Button variant="quiet" icon aria-label="Inbox, 6 new">
                <InboxIcon size={17} />
                <CountBadge n={6} />
              </Button>
              <Button variant="quiet" icon aria-label="Overlay elements, 2 on screen" data-active>
                <LayoutIcon size={17} />
                <CountBadge n={2} accent />
              </Button>
              <Button variant="quiet" aria-pressed>
                <SettingsIcon size={15} />
                Settings
              </Button>
            </Row>
            <p className="hint m-0">The plain count is information, and the primary ring means you're on that screen or something it controls is live</p>
          </Block>

          {/* ───────── Fields ───────── */}
          <Block id="fields" title="Fields" sub="Label above, control in a recessed well, hint below">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <TextField label="Board name" value={text} onChange={(e) => setText(e.target.value)} description={`${text.length}/24`} maxLength={24} />
              <Stepper label="Countdown" unit="s" value={num} min={5} max={300} step={5} onValueChange={setNum} />
              <div className="flex flex-col gap-2">
                <Label>Voting length</Label>
                <SegmentedControl
                  aria-label="Voting length"
                  options={[
                    { value: '5', label: '5 min' },
                    { value: '10', label: '10 min' },
                    { value: '15', label: '15 min' },
                  ]}
                  value={seg}
                  onValueChange={setSeg}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Style</Label>
                <Select
                  aria-label="Style"
                  options={[
                    { value: 'horror', label: 'Horror Nights', group: 'Your styles', meta: '9 settings' },
                    { value: 'arcade', label: 'Arcade', group: 'Built-in', meta: '9 settings' },
                    { value: 'neon', label: 'Neon', group: 'Built-in', meta: '8 settings' },
                  ]}
                  value={pick}
                  onValueChange={setPick}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Board ID</Label>
                <CopyField
                  value="ch_7k2m9q"
                  label="Board ID"
                  actions={
                    <Button size="xs" icon aria-label="Open">
                      <ExternalIcon size={15} />
                    </Button>
                  }
                />
              </div>
              <ColorPopover value={color} onChange={setColor} aria-label="Accent color">
                <button type="button" className="colorwell well w-full self-end text-left">
                  <i style={{ background: color }} />
                  <span className="flex flex-col gap-1">
                    <span className="lbl">Accent Color</span>
                    <span className="mono text-xs text-ink-soft">{color.toUpperCase()}</span>
                  </span>
                </button>
              </ColorPopover>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Full-width segments</Label>
              <SegmentedControl
                fill
                aria-label="Overlay state"
                options={['off', 'voting', 'live', 'result'].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) }))}
                value={state}
                onValueChange={setState}
              />
            </div>
          </Block>

          {/* ───────── Toggles ───────── */}
          <Block id="toggles" title="Toggles" sub="Compact in form grids, a full row for options that need a description, bare inside another field">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <Toggle label="Auto-start next challenge" description="Stacked, the default in a form grid" checked={toggles.a} onCheckedChange={flip('a')} />
              <div className="self-end">
                <Toggle inline label="Scanlines" description="Inline, for short config fields" checked={toggles.b} onCheckedChange={flip('b')} />
              </div>
            </div>
            <RockerSwitch label="Use AI parsing" description="A full row, when the option needs its own description" checked={toggles.c} onCheckedChange={flip('c')} />
            <div className="flex flex-col gap-2">
              <Label>Public page</Label>
              <CopyField
                value="challenge.chat/c/ch_7k2m9q"
                label="Public page URL"
                actions={
                  <>
                    <span className="mx-1 w-px self-stretch bg-white/10" aria-hidden="true" />
                    <MiniSwitch checked={toggles.d} onCheckedChange={flip('d')} aria-label="Public page" />
                  </>
                }
              />
              <span className="hint">Bare, when the switch belongs to the field next to it</span>
            </div>
          </Block>

          {/* ───────── Surfaces ───────── */}
          <Block id="surfaces" title="Surfaces" sub="Panels are raised, wells are recessed, screens are lit">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              <Panel className="flex min-h-[96px] items-end p-4">
                <Label>Panel</Label>
              </Panel>
              <Well className="flex min-h-[96px] items-end p-4">
                <Label>Well</Label>
              </Well>
              <Screen className="flex min-h-[96px] items-end p-4">
                <span className="status">Screen</span>
              </Screen>
            </div>
            <Row label="Marks">
              <Tag>Next Round</Tag>
              <Chip>Sponsor · Acme</Chip>
              <span className="flex items-center gap-2 text-[13px] text-ink-soft">
                <Led tone="ok" /> OK
              </span>
              <span className="flex items-center gap-2 text-[13px] text-ink-soft">
                <Led tone="warn" /> Warn
              </span>
              <span className="flex items-center gap-2 text-[13px] text-ink-soft">
                <Led tone="live" /> Live
              </span>
              <span className="flex items-center gap-2 text-[13px] text-ink-soft">
                <Led /> Off
              </span>
            </Row>
            <Well className="px-5 py-4">
              <Section title="Section" sub="A title, an optional one-line sub, and actions on the right" actions={<Button size="sm">Action</Button>}>
                {null}
              </Section>
            </Well>
          </Block>

          {/* ───────── Feedback ───────── */}
          <Block id="feedback" title="Feedback" sub="Toasts confirm, dialogs ask before anything that can't be undone, drawers hold side tasks">
            <Row label="Try them">
              <Button onClick={() => toast.add({ title: 'Saved', description: 'Applied to the current round' })}>Show Toast</Button>
              <Button onClick={() => setConfirm(true)}>Open Dialog</Button>
              <Button onClick={() => setSheet(true)}>Open Drawer</Button>
              <Tooltip
                content={
                  <>
                    <b>Flawless</b> · won every challenge in the round
                  </>
                }
              >
                <Button variant="ghost">Hover For Tooltip</Button>
              </Tooltip>
            </Row>
          </Block>

          {/* ───────── Data ───────── */}
          <Block id="data" title="Data" sub="Lit digits and meters for live state, edge-to-edge tables for lists">
            <Screen className="flex flex-col gap-4 px-6 py-5">
              <div className="flex items-end justify-between gap-4">
                <Timer value="04:32" />
                <span className="mono text-[11px] tracking-[.14em] text-ink-sub">TRY 1/3</span>
              </div>
              <SegmentMeter value={0.62} className="lit-crisp" />
            </Screen>
            <Well className="flex items-center gap-4 px-5 py-4" style={{ background: `linear-gradient(90deg, rgba(var(--ar),.12), transparent 35%, transparent 65%, rgba(var(--cr),.12)), linear-gradient(180deg, #0c0e0f 0%, #121416 100%)` }}>
              <span className="pixel text-[28px] leading-none" style={{ color: 'var(--a-hi)' }}>
                3,500
              </span>
              <span className="h-px flex-1 bg-white/10" aria-hidden="true" />
              <span className="flex items-baseline gap-2.5 text-[13px] font-semibold text-ink-strong">
                TG <span className="text-[17px] font-medium text-ink-muted">vs</span> Chat
              </span>
              <span className="h-px flex-1 bg-white/10" aria-hidden="true" />
              <span className="pixel text-[28px] leading-none" style={{ color: 'var(--c-hi)' }}>
                2,250
              </span>
            </Well>
          </Block>

          {/* ───────── Icons ───────── */}
          <Block id="icons" title="Icons" sub={`${icons.length} line icons on a 24px grid, drawn at 14 to 18px next to text`}>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {icons.map(([name, Icon]) => (
                <Well key={name} className="flex flex-col items-center gap-2 rounded-[12px] px-2 py-3 text-ink-soft">
                  <Icon size={18} />
                  <span className="mono truncate text-[10px] text-ink-muted">{name.replace('Icon', '')}</span>
                </Well>
              ))}
            </div>
          </Block>
        </div>
      </div>

      <Sheet open={sheet} onOpenChange={setSheet} title="Drawer">
        <p className="hint m-0">Side tasks that don't need the whole screen, like switching boards or overlay elements</p>
      </Sheet>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Delete this round?"
        description="Removes “Blindfolded Blitz” and its results from history and the overall score for good"
        confirmLabel="Delete round"
        cancelLabel="Keep it"
        onConfirm={() => toast.add({ title: 'Round deleted' })}
      />
    </div>
  );
}

/** One section of the page */
function Block({ id, title, sub, children }: { id: string; title: string; sub: string; children: ReactNode }) {
  return (
    <Panel as="section" id={id} className="flex scroll-mt-16 flex-col gap-6 px-4 py-6 sm:px-7 sm:py-7">
      <Section title={title} sub={sub}>
        {null}
      </Section>
      {children}
    </Panel>
  );
}

function RuleList({ title, items }: { title: string; items: string[] }) {
  return (
    <Well className="flex flex-col gap-3 p-5">
      <Label>{title}</Label>
      {items.map((t) => (
        <span key={t} className="flex items-start gap-2.5 text-[13px] leading-snug text-ink-soft">
          <Led tone="ok" className="mt-1.5 flex-none" />
          {t}
        </span>
      ))}
    </Well>
  );
}

/** A strip of colours: CSS vars (`--a`) or Tailwind background classes (`bg-ink-soft`) */
function Swatches({ label, vars }: { label: string; vars: string[] }) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <div className="flex overflow-hidden rounded-[12px] shadow-[0_0_0_1px_rgba(0,0,0,.7)]">
        {vars.map((v) => {
          const cls = v.startsWith('bg-');
          return (
            <Tooltip key={v} content={<span className="mono">{cls ? v.replace('bg-', '') : v}</span>}>
              <span tabIndex={0} className={cn('h-12 flex-1', cls && v)} style={cls ? undefined : { background: `var(${v})` }} aria-label={v} />
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}

function Specimen({ meta, children }: { meta: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-white/[.05] pb-4 last:border-0 last:pb-0">
      {children}
      <span className="mono text-[11px] text-ink-faint">{meta}</span>
    </div>
  );
}

function Row({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <div className={cn('flex flex-wrap items-center gap-3', className)}>{children}</div>
    </div>
  );
}
