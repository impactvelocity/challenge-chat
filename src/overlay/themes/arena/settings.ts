import { useThemeSettings, type SettingsOf, type SettingsSchema } from '@/overlay/sdk';
import { CORE } from '../kit';

export const SETTINGS = {
  ...CORE,
  finish: {
    type: 'select',
    label: 'Finish',
    default: 'gloss',
    group: 'Style',
    description: 'Gloss puts a studio sheen on every slab',
    options: [
      { value: 'gloss', label: 'Gloss' },
      { value: 'matte', label: 'Matte' },
    ],
  },
  scoreShows: {
    type: 'select',
    label: 'Score in',
    default: 'points',
    group: 'Style',
    options: [
      { value: 'points', label: 'Points' },
      { value: 'wins', label: 'Challenges' },
    ],
  },
} as const satisfies SettingsSchema;

export const useArenaSettings = () => useThemeSettings() as SettingsOf<typeof SETTINGS>;
