import { cloneElement, createElement, type ReactElement, type ReactNode } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from './Overlays';

// Exercise the async lifecycle independently of portal positioning and browser focus.
vi.mock('@base-ui/react/alert-dialog', () => ({ AlertDialog: {
  Root: ({ open, children }: { open: boolean; children: ReactNode }) => open ? children : null,
  Portal: ({ children }: { children: ReactNode }) => children,
  Backdrop: () => null,
  Popup: ({ children }: { children: ReactNode }) => createElement('div', null, children),
  Title: ({ children }: { children: ReactNode }) => createElement('h2', null, children),
  Description: ({ children }: { children: ReactNode }) => createElement('p', null, children),
  Close: ({ render, children, disabled }: { render: ReactElement; children: ReactNode; disabled: boolean }) => cloneElement(render, { disabled, children } as object),
} }));
vi.mock('./Button', () => ({ Button: (props: Record<string, unknown>) => createElement('button', props) }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let renderer: ReactTestRenderer;
afterEach(() => { act(() => renderer?.unmount()); });
const confirm = () => renderer.root.findAllByType('button').find((button) => button.props.children === 'Confirm')!;
const mount = async (onConfirm: () => unknown, onOpenChange = vi.fn()) => {
  await act(async () => { renderer = create(createElement(ConfirmDialog, { open: true, title: 'Confirm action', description: 'Test operation', confirmLabel: 'Confirm', onConfirm, onOpenChange })); });
  return onOpenChange;
};

describe('async confirmation controls', () => {
  it('stays open, displays loading and blocks duplicate clicks until success', async () => {
    let finish!: () => void;
    const task = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    const close = await mount(task);
    await act(async () => { confirm().props.onClick(); confirm().props.onClick(); });
    expect(task).toHaveBeenCalledTimes(1);
    expect(confirm().props.loading).toBe(true);
    expect(close).not.toHaveBeenCalled();
    await act(async () => { finish(); });
    expect(close).toHaveBeenCalledExactlyOnceWith(false);
  });

  it('shows a failed request in the dialog and allows retry', async () => {
    const task = vi.fn().mockRejectedValueOnce(new Error('Could not reach server')).mockResolvedValueOnce(true);
    const close = await mount(task);
    await act(async () => { confirm().props.onClick(); });
    expect(close).not.toHaveBeenCalled();
    expect(renderer.root.findByProps({ role: 'alert' }).props.children).toBe('Could not reach server');
    expect(confirm().props.loading).toBe(false);
    await act(async () => { confirm().props.onClick(); });
    expect(close).toHaveBeenCalledExactlyOnceWith(false);
  });

  it('does not close when a controller reports failure without throwing', async () => {
    const close = await mount(async () => false);
    await act(async () => { confirm().props.onClick(); });
    expect(close).not.toHaveBeenCalled();
    expect(renderer.root.findByProps({ role: 'alert' }).props.children).toContain('Please try again');
  });
});
