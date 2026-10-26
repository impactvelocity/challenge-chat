import { useThemeSettings, type SettingsOf, type SettingsSchema } from '@/overlay/sdk';
import { CORE } from '../kit';

export const SETTINGS = {
  ...CORE,
  grit: { type: 'number', label: 'Distress', default: 60, min: 0, max: 100, step: 5, unit: '%', group: 'Style', description: 'Grain and scratches across every panel' },
  flicker: { type: 'boolean', label: 'Flicker', default: true, group: 'Style', description: 'Headlines gutter like a candle now and then' },
} as const satisfies SettingsSchema;

export const useRelicSettings = () => useThemeSettings() as SettingsOf<typeof SETTINGS>;
