import { Button as BaseButton } from '@base-ui/react/button';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type ButtonProps = ComponentProps<typeof BaseButton> & {
  variant?: 'default' | 'accent' | 'danger' | 'ghost' | 'solid' | 'quiet';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /** Square icon-only button. Pair with `aria-label`. */
  icon?: boolean;
  /** Pending action: preserve the button footprint and block repeat activation. */
  loading?: boolean;
  loadingLabel?: ReactNode;
};

export function Button({ variant = 'default', size = 'md', icon, className, loading = false, loadingLabel, children, disabled, ...props }: ButtonProps) {
  return (
    <BaseButton
      className={cn('btn', className)}
      data-variant={variant === 'default' ? undefined : variant}
      data-size={size === 'md' ? undefined : size}
      data-icon={icon || undefined}
      {...props}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      data-loading={loading || undefined}
    >
      {loading ? <>
        <span className="btn-loading-placeholder" aria-hidden="true">{children}</span>
        <span className="btn-loading-content" role="status">
          <svg viewBox="0 0 24 24" width="16" height="16" className="motion-safe:animate-spin" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.5" opacity=".25" /><path d="M12 3a9 9 0 0 1 9 9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /></svg>
          {loadingLabel ?? <span className="sr-only">Working…</span>}
        </span>
      </> : children}
    </BaseButton>
  );
}
