import { useThemeSettings, type SettingsOf, type SettingsSchema } from '@/overlay/sdk';
import { CORE } from '../kit';

export const SETTINGS = {
  ...CORE,
  surface: {
    type: 'select',
    label: 'Surface',
    default: 'parchment',
    group: 'Style',
    description: 'Aged parchment, or deep jewel tones with gold filigree',
    options: [
      { value: 'parchment', label: 'Parchment' },
      { value: 'jewel', label: 'Jewel' },
    ],
  },
  sparkles: { type: 'boolean', label: 'Magic sparkles', default: true, group: 'Style', description: 'Cards unfurl with a golden glint and a few twinkles' },
} as const satisfies SettingsSchema;

export const useFantasySettings = () => useThemeSettings() as SettingsOf<typeof SETTINGS>;
