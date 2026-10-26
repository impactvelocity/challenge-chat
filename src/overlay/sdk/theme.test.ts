import { describe, expect, it } from 'vitest';
import { defaultElements, defineTheme } from './theme';

const Empty = () => null;

describe('overlay element defaults', () => {
  it('starts every element off on a new board', () => {
    const theme = defineTheme({
      id: 'test',
      name: 'Test',
      settings: {},
      Layout: Empty,
      scenes: {},
      elements: {
        scoreboard: { label: 'Scoreboard', region: 'stack', Component: Empty },
        alerts: { label: 'Alerts', region: 'top', Component: Empty },
      },
    });

    expect(defaultElements(theme)).toEqual({ scoreboard: false, alerts: false });
  });
});
