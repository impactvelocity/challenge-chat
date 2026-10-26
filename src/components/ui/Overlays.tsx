import { AlertDialog } from '@base-ui/react/alert-dialog';
import { Dialog } from '@base-ui/react/dialog';
import { Toast } from '@base-ui/react/toast';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Button } from './Button';

type Container = HTMLElement | null;

/**
 * Overlays render into `document.body` by default. Pass `container` (an element, so pass it
 * from state rather than `ref.current`) to confine one to a positioned element, as the
 * Components page does for its stage demo.
 */
const pos = (container?: Container) => (container !== undefined ? 'absolute' : 'fixed');

type SheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Extra buttons shown in the header, before the close button. */
  actions?: ReactNode;
  /** Extra buttons shown in the header, after the close button. */
  trailing?: ReactNode;
  /** 640px instead of 440px. */
  wide?: boolean;
  container?: Container;
};

/** Right-hand slide-in drawer (Base UI Dialog). */
export function Sheet({ open, onOpenChange, title, children, footer, actions, trailing, wide, container }: SheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange} modal={container !== undefined ? 'trap-focus' : true}>
      <Dialog.Portal container={container}>
        <Dialog.Backdrop className={cn('scrim z-40', pos(container))} />
        <Dialog.Popup className={cn('drawer z-50', pos(container), wide && 'w-[min(640px,100%)]')}>
          <div className="flex items-center justify-between gap-3">
            <Dialog.Title className="m-0 min-w-0 text-base font-bold text-ink-strong">{title}</Dialog.Title>
            <div className="flex flex-none gap-2">
              {actions}
              {/* Words, not an X, so it can't be mistaken for delete */}
              <Dialog.Close render={<Button size="xs" variant="solid" />}>Close</Dialog.Close>
              {trailing}
            </div>
          </div>
          <div className="flex flex-col">{children}</div>
          {footer && <div className="mt-auto flex flex-col gap-2.5">{footer}</div>}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  container?: Container;
};

/** Destructive confirmation (Base UI AlertDialog). */
export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, cancelLabel = 'Cancel', onConfirm, container }: ConfirmDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal container={container}>
        {/* Above drawers (z-40/50), so a confirm opened from a drawer dims it too. Base UI skips the
            backdrop of a dialog nested in another one unless forced. */}
        <AlertDialog.Backdrop forceRender className={cn('scrim z-[60]', pos(container))} />
        <AlertDialog.Popup className={cn('modal z-[70]', pos(container))}>
          <AlertDialog.Title className="m-0 text-lg leading-tight font-bold text-ink-strong">{title}</AlertDialog.Title>
          <AlertDialog.Description className="m-0 text-sm leading-normal text-ink-soft">{description}</AlertDialog.Description>
          <div className="mt-1 grid grid-cols-2 gap-2.5">
            <AlertDialog.Close render={<Button variant="ghost" />}>{cancelLabel}</AlertDialog.Close>
            <AlertDialog.Close
              render={<Button variant="accent" />}
              onClick={onConfirm}
            >
              {confirmLabel}
            </AlertDialog.Close>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

type ChoiceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description: ReactNode;
  /** Each closes the dialog when chosen. The last is the main one. */
  actions: { label: ReactNode; onSelect: () => void; variant?: 'default' | 'accent' | 'ghost' }[];
  cancelLabel?: string;
  container?: Container;
};

/** A question with more than one answer: Cancel plus two or more actions (Base UI AlertDialog). */
export function ChoiceDialog({ open, onOpenChange, title, description, actions, cancelLabel = 'Cancel', container }: ChoiceDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal container={container}>
        <AlertDialog.Backdrop forceRender className={cn('scrim z-[60]', pos(container))} />
        <AlertDialog.Popup className={cn('modal z-[70]', pos(container))}>
          <AlertDialog.Title className="m-0 text-lg leading-tight font-bold text-ink-strong">{title}</AlertDialog.Title>
          <AlertDialog.Description className="m-0 text-sm leading-normal text-ink-soft">{description}</AlertDialog.Description>
          <div className="mt-1 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
            <AlertDialog.Close render={<Button variant="ghost" className="sm:mr-auto" />}>{cancelLabel}</AlertDialog.Close>
            {actions.map((a, i) => (
              <AlertDialog.Close key={i} render={<Button variant={a.variant ?? 'default'} />} onClick={a.onSelect}>
                {a.label}
              </AlertDialog.Close>
            ))}
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

/** Toast stack. Wrap a subtree in `<Toast.Provider>` and render this once inside it. */
export function Toasts({ container, className }: { container?: Container; className?: string }) {
  const { toasts } = Toast.useToastManager();
  return (
    <Toast.Portal container={container}>
      <Toast.Viewport
        className={cn(
          'z-50 flex w-[min(380px,calc(100%-44px))] flex-col-reverse gap-2.5 outline-none',
          pos(container),
          container !== undefined ? 'bottom-[22px] left-[22px]' : 'bottom-6 left-6',
          className,
        )}
      >
        {toasts.map((t) => (
          <Toast.Root key={t.id} toast={t} className="toast">
            <span className="flex-1">
              <Toast.Title render={<b />} className="font-semibold" /> <Toast.Description render={<span />} />
            </span>
            <Toast.Action className="toast-action" />
            <Toast.Close className="flex-none cursor-pointer border-0 bg-transparent px-1 py-0.5 text-[12px] font-semibold text-ink-muted hover:text-ink">Close</Toast.Close>
          </Toast.Root>
        ))}
      </Toast.Viewport>
    </Toast.Portal>
  );
}

export const ToastProvider = Toast.Provider;
export const useToasts = Toast.useToastManager;
