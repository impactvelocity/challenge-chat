import { useThemeSettings, type SettingsOf, type SettingsSchema } from '@/overlay/sdk';
import { CORE } from '../kit';

export const SETTINGS = {
  ...CORE,
  glow: { type: 'number', label: 'Glow', default: 70, min: 0, max: 100, step: 5, unit: '%', group: 'Style', description: 'How far the frames bleed light' },
  scanlines: { type: 'boolean', label: 'Scan lines', default: true, group: 'Style', description: 'A fine CRT raster over every panel' },
} as const satisfies SettingsSchema;

export const useNeonSettings = () => useThemeSettings() as SettingsOf<typeof SETTINGS>;
