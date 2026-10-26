import { registerTheme } from '@/overlay/sdk';
import { arcade } from './arcade';
import { arena } from './arena';
import { broadcast } from './broadcast';
import { comic } from './comic';
import { cozy } from './cozy';
import { esports } from './esports';
import { neon } from './neon';
import { relic } from './relic';

/**
 * Built-in themes, registered on import. A custom theme registers the same way:
 *
 *   registerTheme(extendTheme(broadcast, { id: 'my-show', name: 'My Show', elements: { scoreboard: { …, Component: MyScoreboard } } }));
 *
 * Broadcast is the base; the rest share its scenes and elements through `kit/` and restyle them.
 */
export const BUILT_IN = [broadcast, arena, arcade, neon, esports, cozy, relic, comic];

for (const theme of BUILT_IN) registerTheme(theme);

export { arcade, arena, broadcast, comic, cozy, esports, neon, relic };
