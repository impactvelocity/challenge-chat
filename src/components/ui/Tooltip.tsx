import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip';
import type { ReactElement, ReactNode } from 'react';

/** Small hover/focus hint. `children` must be a single element that can take a ref; it becomes the trigger. `side` defaults to top. */
export function Tooltip({ content, children, side }: { content: ReactNode; children: ReactElement; side?: 'top' | 'right' | 'bottom' | 'left' }) {
  return (
    <BaseTooltip.Root>
      <BaseTooltip.Trigger render={children} delay={0} closeDelay={0} />
      <BaseTooltip.Portal>
        <BaseTooltip.Positioner side={side} sideOffset={8} className="z-50">
          <BaseTooltip.Popup className="tip">{content}</BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  );
}
