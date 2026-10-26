import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Button } from './Button';

describe('button loading state', () => {
  it('disables activation, announces pending work and keeps original content for a stable footprint', () => {
    const html = renderToStaticMarkup(createElement(Button, { loading: true, loadingLabel: 'Closing…', children: 'Close voting' }));
    expect(html).toContain('disabled=""');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('role="status"');
    expect(html).toContain('Closing…');
    expect(html).toContain('Close voting');
    expect(html).toContain('btn-loading-placeholder');
  });
  it('supports icon-only controls without removing their accessible name', () => {
    const html = renderToStaticMarkup(createElement(Button, { icon: true, loading: true, 'aria-label': 'Pause challenge' }));
    expect(html).toContain('aria-label="Pause challenge"');
    expect(html).toContain('Working…');
  });
  it('keeps normal buttons enabled and preserves explicit disabled states', () => {
    expect(renderToStaticMarkup(createElement(Button, { children: 'Close voting' }))).not.toContain('disabled=""');
    expect(renderToStaticMarkup(createElement(Button, { disabled: true, children: 'Close voting' }))).toContain('disabled=""');
  });
});
