import { Button as BaseButton } from '@base-ui/react/button';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

type ButtonProps = ComponentProps<typeof BaseButton> & {
  variant?: 'default' | 'accent' | 'ghost' | 'solid' | 'quiet';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /** Square icon-only button. Pair with `aria-label`. */
  icon?: boolean;
};

export function Button({ variant = 'default', size = 'md', icon, className, ...props }: ButtonProps) {
  return (
    <BaseButton
      className={cn('btn', className)}
      data-variant={variant === 'default' ? undefined : variant}
      data-size={size === 'md' ? undefined : size}
      data-icon={icon || undefined}
      {...props}
    />
  );
}
