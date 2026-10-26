import { useThemeSettings, type SettingsOf, type SettingsSchema } from '@/overlay/sdk';
import { CORE } from '../kit';

export const SETTINGS = {
  ...CORE,
  paper: {
    type: 'select',
    label: 'Paper',
    default: 'pop',
    group: 'Style',
    description: 'Pop is bright yellow and cyan; pulp is cream newsprint',
    options: [
      { value: 'pop', label: 'Pop' },
      { value: 'pulp', label: 'Pulp' },
    ],
  },
  tilt: { type: 'boolean', label: 'Wonky panels', default: true, group: 'Style', description: 'Panels sit a little off-straight' },
} as const satisfies SettingsSchema;

export const useComicSettings = () => useThemeSettings() as SettingsOf<typeof SETTINGS>;
