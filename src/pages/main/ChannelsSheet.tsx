import { useEffect, useState, type CSSProperties } from 'react';
import { ArrowLeftIcon, PlusIcon } from '@/components/icons';
import { Button, Sheet, TextField, useToasts } from '@/components/ui';
import { slugify, type Channel } from '@/model';
import { cn } from '@/lib/cn';
import { fmt } from '@/scoreboard/parts';
import { ACCENT_PRESETS, lighten } from '@/theme/accent';
import { SplitCells } from './Boards';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channels: Channel[];
  currentId: string;
  defaultTwitchChannel: string;
  onPick: (c: Channel) => void;
  onCreate: (name: string, slug: string, twitchChannel: string, colorPreset: number) => Promise<void>;
};

/** Channel switcher, with an "Add channel" form as a second view in the same drawer. */
export function ChannelsSheet({ open, onOpenChange, channels, currentId, defaultTwitchChannel, onPick, onCreate }: Props) {
  const toast = useToasts();
  const [view, setView] = useState<'list' | 'add'>('list');

  // Always come back to the list.
  useEffect(() => {
    if (!open) setView('list');
  }, [open]);

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      wide
      title={
        view === 'list' ? (
          <span className="text-[20px] leading-tight font-bold">Boards</span>
        ) : (
          <span className="flex items-center gap-3">
            <Button size="xs" variant="solid" icon onClick={() => setView('list')} aria-label="Back to boards">
              <ArrowLeftIcon size={14} />
            </Button>
            <span className="text-[20px] leading-tight font-bold">New Board</span>
          </span>
        )
      }
    >
      {view === 'list' ? (
        <div className="flex flex-col gap-2 pt-1">
          {channels.map((c) => {
            const on = c.id === currentId;
            const total = c.score.streamer + c.score.chat;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => (on ? onOpenChange(false) : onPick(c))}
                aria-current={on || undefined}
                className={cn(
                  'relative flex min-h-[68px] w-full cursor-pointer items-center gap-4 rounded-[16px] border-0 py-2 pr-4 pl-5 text-left transition-colors',
                  // Current channel is the raised, lit key; the rest sit flat.
                  on ? 'qrow' : 'bg-[#141618] hover:bg-[#1b1e21]',
                )}
              >
                {on && <span aria-hidden="true" className="absolute top-3 bottom-3 left-3 w-[3px] rounded-full bg-accent shadow-[0_0_8px_rgba(var(--ar),.8)]" />}
                <span className="min-w-0 flex-1 truncate pl-2 text-[19px] font-semibold text-ink-strong" title={c.displayName}>
                  {c.displayName}
                </span>
                {/* Points window: the same lit readout as the scoreboard, with a mini split between the two scores */}
                <span className="flex w-[300px] flex-none items-center gap-3 rounded-[12px] bg-[#0b0c0d] px-4 py-3 shadow-[inset_0_2px_6px_rgba(0,0,0,.8),0_1px_0_rgba(255,255,255,.06)] max-sm:w-[190px]">
                  <span data-side="streamer" className="pixel sb-lit sb-lit-crisp w-[70px] flex-none text-[22px] leading-none max-sm:w-auto">
                    {fmt(c.score.streamer)}
                  </span>
                  <SplitCells share={total ? c.score.streamer / total : null} count={14} height={8} className="min-w-0 flex-1 gap-[2px] [&_.cell]:rounded-[2px]" />
                  <span data-side="chat" className="pixel sb-lit sb-lit-crisp w-[70px] flex-none text-right text-[22px] leading-none max-sm:w-auto">
                    {fmt(c.score.chat)}
                  </span>
                </span>
              </button>
            );
          })}
          <Button variant="ghost" className="mt-1 self-start" onClick={() => setView('add')}>
            <PlusIcon size={15} />
            New board
          </Button>
        </div>
      ) : (
        <AddChannel
          existing={channels}
          defaultTwitchChannel={defaultTwitchChannel}
          onCancel={() => setView('list')}
          onCreate={async (name, slug, twitchChannel, colorPreset) => {
            await onCreate(name, slug, twitchChannel, colorPreset);
            setView('list');
            toast.add({ title: 'Board created', description: name });
          }}
        />
      )}
    </Sheet>
  );
}

function cleanTwitchChannel(value: string) {
  return value.replace(/^\s*(https?:\/\/)?(www\.)?twitch\.tv\//i, '').replace(/[^a-zA-Z0-9_]/g, '');
}

function AddChannel({
  existing,
  defaultTwitchChannel,
  onCancel,
  onCreate,
}: {
  existing: Channel[];
  defaultTwitchChannel: string;
  onCancel: () => void;
  onCreate: (name: string, slug: string, twitchChannel: string, colorPreset: number) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [twitchChannel, setTwitchChannel] = useState(() => cleanTwitchChannel(defaultTwitchChannel));
  const [color, setColor] = useState(0);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    setTried(true);
    if (!name.trim() || !twitchChannel) return;
    // Slug comes from the name; add a number if another channel already has it.
    const base = slugify(name) || 'channel';
    let slug = base;
    for (let n = 2; existing.some((c) => c.slug === slug); n++) slug = `${base}-${n}`;
    setBusy(true);
    setError(null);
    try {
      await onCreate(name.trim(), slug, twitchChannel, color);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create this board');
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-7 pt-2">
      <div className="[&_label.lbl]:mb-1.5">
        <TextField
          label="Board name"
          placeholder="Friday Co-op Night"
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void create()}
          error={tried && !name.trim() ? 'Give the board a name' : undefined}
        />
      </div>

      <TextField
        label="Twitch channel"
        prefix={<span className="mono text-[13px] text-ink-faint">twitch.tv/</span>}
        placeholder="your_channel"
        value={twitchChannel}
        maxLength={25}
        spellCheck={false}
        onChange={(event) => setTwitchChannel(cleanTwitchChannel(event.target.value))}
        error={tried && !twitchChannel ? 'Add the channel chat plays from' : undefined}
      />

      <div className="flex flex-col gap-3.5">
        <span className="lbl">Colour</span>
        <div className="flex flex-wrap items-center gap-2.5" role="radiogroup" aria-label="Board colour">
          {ACCENT_PRESETS.map((p, i) => (
            <button
              key={p.name}
              type="button"
              role="radio"
              aria-checked={color === i}
              aria-label={p.name}
              className="sw"
              data-on={color === i || undefined}
              style={{ '--sw-size': '26px', background: `linear-gradient(180deg, ${lighten(p.hex, 0.28)}, ${p.hex})` } as CSSProperties}
              onClick={() => setColor(i)}
            />
          ))}
        </div>
      </div>

      {error && <p className="m-0 text-sm text-red-300" role="alert">{error}</p>}

      <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button variant="accent" onClick={() => void create()} disabled={busy}>
          <PlusIcon size={15} />
          {busy ? 'Creating…' : 'Create board'}
        </Button>
      </div>
    </div>
  );
}
