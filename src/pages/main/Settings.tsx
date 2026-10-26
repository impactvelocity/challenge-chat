import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router';
import { Panel } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { Channel } from '@/model';
import { SETTINGS_TABS, SettingsBody, type SettingsTab } from '@/pages/app/ChannelSettings';

/** Section names in title case for the tab row. */
const LABEL: Record<SettingsTab, string> = {
  general: 'General',
  scoring: 'Scoring',
  voting: 'Voting',
  theme: 'Theme',
  mods: 'Mods',
  obs: 'OBS',
  ai: 'AI',
};

/** Channel settings inside the main (/) shell: a row of text tabs over one section at a time. */
export function Settings({ tab, channel, onSaved }: { tab: string | undefined; channel: Channel; onSaved?: () => Promise<void> }) {
  const current: SettingsTab = SETTINGS_TABS.some((t) => t.value === tab) ? (tab as SettingsTab) : 'general';
  // Keep ?stage so going back lands on the same session step.
  const { search } = useLocation();
  // On narrow screens the tab row scrolls; keep the current tab in view.
  const nav = useRef<HTMLElement>(null);
  useEffect(() => {
    nav.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [current]);

  return (
    <Panel as="section" aria-label="Settings" className="flex min-w-0 flex-col">
      <div className="px-4 pt-2 sm:px-7 sm:pt-3">
        {/* Text tabs: a lit rail under the current section, like the UI kit's underline tabs */}
        <nav ref={nav} aria-label="Settings sections" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:-mx-7 sm:px-7 [&::-webkit-scrollbar]:hidden">
          <div className="utabs w-max min-w-full gap-4">
            {SETTINGS_TABS.map((t) => (
              <Link
                key={t.value}
                to={{ pathname: `/settings/${t.value}`, search }}
                replace
                // Mods, OBS and AI sit at the far end, apart from the board's own setup
                className={cn('utab relative px-2 tracking-wider whitespace-nowrap no-underline', t.value === 'mods' && 'ml-auto')}
                data-active={t.value === current || undefined}
                aria-current={t.value === current ? 'page' : undefined}
              >
                {LABEL[t.value]}
                {t.value === current && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-px h-[3px] rounded-t-[2px] bg-[linear-gradient(90deg,var(--a-hi),var(--a))] shadow-[0_0_10px_rgba(var(--ar),.8)]"
                  />
                )}
              </Link>
            ))}
          </div>
        </nav>
      </div>
      <div className="settings-form flex min-w-0 flex-col gap-8 px-4 pt-7 pb-7 sm:px-7 sm:pb-8">
        <SettingsBody tab={current} channel={channel} onSaved={onSaved} />
      </div>
    </Panel>
  );
}
