import { Field } from '@base-ui/react/field';
import { Input } from '@base-ui/react/input';
import type { ComponentProps, ReactNode } from 'react';

type FieldShellProps = {
  label: string;
  description?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
};

function FieldShell({ label, description, error, children }: FieldShellProps) {
  return (
    <Field.Root invalid={!!error} className="flex flex-col gap-2">
      <Field.Label className="lbl">{label}</Field.Label>
      {children}
      {error ? (
        <Field.Error match className="hint text-accent-text">
          {error}
        </Field.Error>
      ) : (
        description && <Field.Description className="hint">{description}</Field.Description>
      )}
    </Field.Root>
  );
}

type TextFieldProps = Omit<ComponentProps<typeof Input>, 'prefix'> & {
  label: string;
  description?: ReactNode;
  error?: ReactNode;
  prefix?: ReactNode;
  suffix?: ReactNode;
};

/** Recessed text input that glows with the accent on focus. */
export function TextField({ label, description, error, prefix, suffix, ...props }: TextFieldProps) {
  return (
    <FieldShell label={label} description={description} error={error}>
      <div className="input well" data-invalid={error ? true : undefined}>
        {prefix}
        <Input {...props} />
        {suffix && <span className="input-suffix">{suffix}</span>}
      </div>
    </FieldShell>
  );
}

type TextAreaProps = ComponentProps<'textarea'> & { label: string; description?: ReactNode; error?: ReactNode };

export function TextArea({ label, description, error, ...props }: TextAreaProps) {
  return (
    <FieldShell label={label} description={description} error={error}>
      <div className="input well" data-multiline="">
        <Field.Control render={<textarea {...props} />} />
      </div>
    </FieldShell>
  );
}
