import { useThemeSettings, type SettingsOf, type SettingsSchema } from '@/overlay/sdk';
import { CORE } from '../kit';

export const SETTINGS = {
  ...CORE,
  tint: {
    type: 'select',
    label: 'HUD colour',
    default: 'team',
    group: 'Style',
    description: 'Labels, bars and brackets. Team follows the streamer colour',
    options: [
      { value: 'team', label: 'Team' },
      { value: 'amber', label: 'Amber' },
      { value: 'cyan', label: 'Cyan' },
    ],
  },
  grid: { type: 'boolean', label: 'Tactical grid', default: true, group: 'Style', description: 'A faint grid behind every panel' },
} as const satisfies SettingsSchema;

export const useEsportsSettings = () => useThemeSettings() as SettingsOf<typeof SETTINGS>;
