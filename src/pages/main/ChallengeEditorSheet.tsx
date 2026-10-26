import { useState } from 'react';
import { Button, SegmentedControl, Sheet, Stepper, TextArea, TextField } from '@/components/ui';
import { ChallengeDraftSchema, type Challenge, type ChallengeDraft } from '../../../shared/contracts';

type LimitMode = 'unlimited' | 'limited';

const TIME_LIMIT_OPTIONS = [
  { value: 'unlimited', label: 'No limit' },
  { value: 'limited', label: 'Set limit' },
] satisfies { value: LimitMode; label: string }[];

const ATTEMPT_LIMIT_OPTIONS = [
  { value: 'unlimited', label: 'Unlimited' },
  { value: 'limited', label: 'Set limit' },
] satisfies { value: LimitMode; label: string }[];

function OptionalLimit({
  label,
  value,
  onValueChange,
  defaultValue,
  min,
  max,
  step = 1,
  unit,
  options,
  description,
}: {
  label: string;
  value: number | null;
  onValueChange: (value: number | null) => void;
  defaultValue: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  options: { value: LimitMode; label: string }[];
  description: string;
}) {
  const mode: LimitMode = value == null ? 'unlimited' : 'limited';
  const [lastValue, setLastValue] = useState(value ?? defaultValue);

  return (
    <div className="flex flex-col gap-2">
      <span className="lbl">{label}</span>
      <SegmentedControl
        fill
        aria-label={`${label} mode`}
        options={options}
        value={mode}
        onValueChange={(next) => onValueChange(next === 'limited' ? lastValue : null)}
      />
      {value != null ? (
        <Stepper
          hideLabel
          label={label}
          unit={unit}
          value={value}
          min={min}
          max={max}
          step={step}
          onValueChange={(next) => {
            setLastValue(next);
            onValueChange(next);
          }}
        />
      ) : null}
      <p className="hint">{description}</p>
    </div>
  );
}

export function ChallengeEditorSheet({ challenge, onClose, onSave }: {
  challenge: Challenge;
  onClose: () => void;
  onSave: (draft: ChallengeDraft) => Promise<void>;
}) {
  const [title, setTitle] = useState(challenge.title);
  const [objective, setObjective] = useState(challenge.objective);
  const [seconds, setSeconds] = useState<number | null>(challenge.timeLimitSeconds);
  const [attempts, setAttempts] = useState<number | null>(challenge.maxAttempts);
  const [target, setTarget] = useState(challenge.targets[0]?.value ?? 1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const parsed = ChallengeDraftSchema.safeParse({
      ...challenge, title: title.trim(), objective: objective.trim(),
      timeLimitSeconds: seconds,
      maxAttempts: attempts,
      targets: challenge.targets.map((item, index) => index === 0 ? { ...item, value: target } : item),
    });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Check the challenge fields.'); return; }
    setBusy(true); setError(null);
    try { await onSave(parsed.data); onClose(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not save the challenge.'); }
    finally { setBusy(false); }
  };

  return <Sheet open busy={busy} onOpenChange={(open) => { if (!open && !busy) onClose(); }} title="Edit challenge" footer={
    <div className="flex justify-end gap-3">
      <Button variant="ghost" disabled={busy} onClick={onClose}>Cancel</Button>
      <Button variant="accent" loading={busy} loadingLabel="Saving…" disabled={busy || !title.trim() || !objective.trim()} onClick={() => void save()}>Save challenge</Button>
    </div>
  }>
    <fieldset disabled={busy} className="flex flex-col gap-5 border-0 p-0 pt-2">
      <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={64} disabled={busy} />
      <TextArea label="Challenge text" value={objective} onChange={(e) => setObjective(e.target.value)} maxLength={240} rows={3} disabled={busy} />
      <OptionalLimit
        label="Time limit"
        value={seconds}
        onValueChange={setSeconds}
        defaultValue={30}
        min={5}
        max={3600}
        step={5}
        unit="sec"
        options={TIME_LIMIT_OPTIONS}
        description="Choose No limit when the challenge should run without a countdown."
      />
      <OptionalLimit
        label="Maximum attempts"
        value={attempts}
        onValueChange={setAttempts}
        defaultValue={3}
        min={1}
        max={99}
        options={ATTEMPT_LIMIT_OPTIONS}
        description="Choose Unlimited when retries should not be capped."
      />
      {challenge.targets.length > 0 ? (
        <Stepper
          label={`Target count (${challenge.targets[0].label})`}
          value={target}
          min={1}
          max={999}
          onValueChange={setTarget}
        />
      ) : null}
      {error ? <p role="alert" className="text-[14px] text-accent-text">{error}</p> : null}
      <p className="hint">The viewer's original request and attribution are preserved. Challenges lock when voting begins.</p>
    </fieldset>
  </Sheet>;
}
