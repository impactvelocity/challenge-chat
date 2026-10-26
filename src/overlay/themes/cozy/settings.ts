import { useThemeSettings, type SettingsOf, type SettingsSchema } from '@/overlay/sdk';
import { CORE } from '../kit';

export const SETTINGS = {
  ...CORE,
  paper: {
    type: 'select',
    label: 'Paper',
    default: 'cream',
    group: 'Style',
    description: 'Cream for bright, sunny games; cocoa for evenings and darker scenes',
    options: [
      { value: 'cream', label: 'Cream' },
      { value: 'cocoa', label: 'Cocoa' },
    ],
  },
  notes: { type: 'boolean', label: 'Handwritten notes', default: true, group: 'Style', description: 'Little scribbles and hearts on a few cards' },
} as const satisfies SettingsSchema;

export const useCozySettings = () => useThemeSettings() as SettingsOf<typeof SETTINGS>;
