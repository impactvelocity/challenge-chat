import { Popover } from '@base-ui/react/popover';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { Color, ColorPicker } from 'react-beautiful-color';
import { PipetteIcon } from '@/components/icons';

type ColorPopoverProps = {
  value: string;
  onChange: (hex: string) => void;
  'aria-label': string;
  /** The trigger: a button-like element (swatch, colour field) that opens the picker. */
  children: ReactElement;
};

const HEX = /^#?([0-9a-f]{6})$/i;

/** A colour picker in a raised popup, opened from any swatch: saturation area, hue, eyedropper and a hex field. */
export function ColorPopover({ value, onChange, children, ...rest }: ColorPopoverProps) {
  // Kept locally so dragging through greys doesn't lose the hue, which a hex value can't carry.
  const [color, setColor] = useState(() => new Color(value));
  const [hex, setHex] = useState(value.toUpperCase());
  const onChangeRef = useRef(onChange);
  const changeTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => () => window.clearTimeout(changeTimer.current), []);

  useEffect(() => {
    if (color.getHex().toLowerCase() !== value.toLowerCase()) setColor(new Color(value));
    setHex(value.toUpperCase());
    // Only an outside change of `value` should resync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const pick = (c: Color) => {
    setColor(c);
    setHex(c.getHex().toUpperCase());
    window.clearTimeout(changeTimer.current);
    changeTimer.current = window.setTimeout(() => onChangeRef.current(c.getHex()), 80);
  };

  return (
    <Popover.Root>
      <Popover.Trigger render={children} aria-label={rest['aria-label']} />
      <Popover.Portal>
        <Popover.Positioner sideOffset={8} className="z-50 outline-none">
          <Popover.Popup className="ddmenu cpick flex w-[264px] flex-col gap-3 p-3">
            <ColorPicker color={color} onChange={pick} className="h-auto w-full gap-3 rounded-none bg-transparent shadow-none">
              <ColorPicker.Saturation className="h-[150px] flex-none overflow-hidden rounded-[10px] shadow-[inset_0_0_0_1px_rgba(0,0,0,.6)]" />
              <div className="flex items-center gap-2.5">
                <ColorPicker.EyeDropper className="h-8 w-8 rounded-[9px] text-ink-sub hover:bg-white/[.06] hover:text-ink-strong" title="Pick from screen">
                  <PipetteIcon size={16} />
                </ColorPicker.EyeDropper>
                <ColorPicker.Hue className="h-3 flex-1" />
              </div>
            </ColorPicker>
            <label className="input well min-h-[42px] gap-2 px-3">
              <span className="mono text-[13px] text-ink-faint">#</span>
              <input
                className="font-mono text-[13px]"
                value={hex.replace('#', '')}
                maxLength={7}
                spellCheck={false}
                aria-label="Hex colour"
                onChange={(e) => {
                  const next = e.target.value.trim();
                  setHex(next);
                  const m = next.match(HEX);
                  // Pass the typed hex through as-is; the picker's own round trip can shift it by a digit.
                  if (m) {
                    setColor(new Color(`#${m[1]}`));
                    onChange(`#${m[1].toLowerCase()}`);
                  }
                }}
                onBlur={() => setHex(value.toUpperCase())}
              />
            </label>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
