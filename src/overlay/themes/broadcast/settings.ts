import { resolveSettings, useThemeSettings, type SettingsOf, type SettingsSchema } from '@/overlay/sdk';

/** Everything a streamer can tune about Broadcast. The control room builds its form from this. */
export const SETTINGS = {
  streamerColor: { type: 'color', label: 'Streamer colour', default: null, group: 'Colour', description: 'Unset follows the board' },
  chatColor: { type: 'color', label: 'Chat colour', default: null, group: 'Colour', description: 'Unset follows the board' },

  density: {
    type: 'select',
    label: 'Density',
    default: 'cinematic',
    group: 'Look',
    options: [
      { value: 'compact', label: 'Compact' },
      { value: 'cinematic', label: 'Cinematic' },
    ],
  },
  motion: {
    type: 'select',
    label: 'Motion',
    default: 'slam',
    group: 'Look',
    options: [
      { value: 'snap', label: 'Snap' },
      { value: 'slide', label: 'Slide' },
      { value: 'slam', label: 'Slam' },
    ],
  },
  scale: { type: 'number', label: 'Size', default: 100, min: 80, max: 125, step: 5, unit: '%', group: 'Look' },
  radius: { type: 'number', label: 'Corners', default: 6, min: 0, max: 24, unit: 'px', group: 'Look' },
  panel: { type: 'number', label: 'Panel opacity', default: 95, min: 60, max: 100, step: 5, unit: '%', group: 'Look' },
  side: {
    type: 'select',
    label: 'Stack side',
    default: 'right',
    group: 'Look',
    description: 'Scoreboard, goal and leaderboard stack here; challenge cards take the other side',
    options: [
      { value: 'left', label: 'Left' },
      { value: 'right', label: 'Right' },
    ],
  },

  scoreShows: {
    type: 'select',
    label: 'Score in',
    default: 'points',
    group: 'Scoreboard',
    options: [
      { value: 'points', label: 'Points' },
      { value: 'wins', label: 'Challenges' },
    ],
  },
  track: { type: 'boolean', label: 'Challenge track', default: true, group: 'Scoreboard', description: 'A pip per challenge under the score' },
  streaks: { type: 'boolean', label: 'Streak badge', default: true, group: 'Scoreboard', description: 'Shows a run of two or more wins' },

  leaders: { type: 'number', label: 'Leaderboard rows', default: 5, min: 3, max: 8, group: 'Elements' },
  bannerSecs: { type: 'number', label: 'Winner banner', default: 8, min: 3, max: 20, unit: 's', group: 'Elements', description: 'Then it folds into an up-next card' },
  alertSecs: { type: 'number', label: 'Alert length', default: 5, min: 2, max: 12, unit: 's', group: 'Elements', description: 'How long each Twitch alert stays up' },
  sponsorLabel: { type: 'text', label: 'Sponsor label', default: 'Presented by', maxLength: 24, group: 'Elements' },
} as const satisfies SettingsSchema;

export type BroadcastSettings = SettingsOf<typeof SETTINGS>;

const DEFAULTS = resolveSettings(SETTINGS);

/**
 * Broadcast's settings, typed. (Its components can't import the theme object: that would be circular.)
 * Other themes reuse these components with a smaller schema, so anything they don't define keeps Broadcast's default.
 */
export const useBroadcastSettings = () => ({ ...DEFAULTS, ...useThemeSettings() }) as BroadcastSettings;
