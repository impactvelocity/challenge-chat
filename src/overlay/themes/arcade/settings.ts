import { useThemeSettings, type SettingsOf, type SettingsSchema } from '@/overlay/sdk';
import { CORE } from '../kit';

export const SETTINGS = {
  ...CORE,
  pixel: { type: 'boolean', label: 'Pixel numbers', default: true, group: 'Style', description: 'Scores and clocks in a pixel font' },
  tilt: { type: 'boolean', label: 'Sticker tilt', default: true, group: 'Style', description: 'Panels sit slightly askew, like stickers slapped on' },
} as const satisfies SettingsSchema;

export const useArcadeSettings = () => useThemeSettings() as SettingsOf<typeof SETTINGS>;
