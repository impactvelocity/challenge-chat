import { useCallback, useState } from 'react';
import { RefreshIcon, SparkleIcon } from '@/components/icons';
import { Button, Sheet, TextField } from '@/components/ui';

export type TitlePhase = 'loading' | 'streaming' | 'done';

/**
 * Local title affordance until sessions gain an authoritative title field.
 * `set()` keeps the streamer's draft in this control-room mount only.
 */
export function useStreamedTitle() {
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<TitlePhase>('done');
  const set = useCallback((t: string) => {
    setText(t);
    setPhase('done');
  }, []);

  return { text, phase, set };
}

/** The title as it appears in the window: a skeleton while loading, a caret while streaming. Fixed height so nothing below moves. */
export function StreamedTitle({ text, phase }: { text: string; phase: TitlePhase }) {
  return (
    <div className="flex min-h-[68px] items-start" aria-live="polite" aria-busy={phase !== 'done'}>
      {phase === 'loading' ? (
        <span className="flex flex-col gap-2.5 pt-1.5">
          <span className="mono flex items-center gap-2 text-[12px] tracking-[.08em] text-ink-sub">
            <SparkleIcon size={13} className="animate-pulse text-accent-text" />
            Naming this round…
          </span>
          <span className="block h-[22px] w-[min(340px,70vw)] animate-pulse rounded-[6px] bg-white/[.07]" />
        </span>
      ) : (
        <p className="m-0 text-[28px] leading-tight font-bold tracking-[-.015em] text-white">
          {text}
          {phase === 'streaming' && (
            <span aria-hidden="true" className="ml-1 inline-block h-[.9em] w-[.5em] translate-y-[.1em] animate-pulse rounded-[2px] bg-accent" />
          )}
        </p>
      )}
    </div>
  );
}

type SheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReturnType<typeof useStreamedTitle>;
};

/** Rewrite the session title by hand, or ask for another suggestion. */
export function SessionTitleSheet({ open, onOpenChange, title }: SheetProps) {
  const [draft, setDraft] = useState(title.text);
  const [wasOpen, setWasOpen] = useState(open);
  // Start from the current title each time the drawer opens.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setDraft(title.text);
  }
  const busy = title.phase !== 'done';
  const shown = busy ? title.text : draft;

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={<span className="text-[20px] leading-tight font-bold">Round title</span>}
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="accent"
            disabled={busy || !draft.trim()}
            onClick={() => {
              title.set(draft.trim());
              onOpenChange(false);
            }}
          >
            Save title
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 pt-2">
        <div className="[&_label.lbl]:mb-1.5">
          <TextField
            label="Title"
            value={shown}
            placeholder={busy ? 'Thinking…' : 'Name this round'}
            disabled={busy}
            maxLength={60}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && draft.trim()) {
                title.set(draft.trim());
                onOpenChange(false);
              }
            }}
          />
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          disabled
          title="AI title generation is not connected to the server yet"
          onClick={() => undefined}
        >
          <RefreshIcon size={14} />
          Suggestions unavailable
        </Button>
        <span className="hint">Manual titles are local to this control room until session title storage is added.</span>
      </div>
    </Sheet>
  );
}
