import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePendingAction } from './use-pending-action';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let renderer: ReactTestRenderer;
let action: ReturnType<typeof usePendingAction>;
function Probe() { action = usePendingAction(); return null; }
const mount = async () => { await act(async () => { renderer = create(createElement(Probe)); }); };
afterEach(() => { act(() => renderer?.unmount()); });

describe('pending creator actions', () => {
  it('locks synchronously against double clicks and conflicting controls until all work finishes', async () => {
    await mount();
    let finish!: () => void;
    const request = new Promise<void>((resolve) => { finish = resolve; });
    const task = vi.fn(() => request);
    const conflicting = vi.fn(async () => {});
    let first!: Promise<boolean>;
    await act(async () => {
      first = action.run(task, 'close-vote');
      expect(await action.run(task, 'close-vote')).toBe(false);
      expect(await action.run(conflicting, 'start-round')).toBe(false);
    });
    expect(task).toHaveBeenCalledTimes(1);
    expect(conflicting).not.toHaveBeenCalled();
    expect(action.pendingAction).toBe('close-vote');
    expect(action.busy).toBe(true);
    await act(async () => { finish(); expect(await first).toBe(true); });
    expect(action.busy).toBe(false);
    expect(action.notice).toBeNull();
  });

  it('surfaces errors, unlocks, and allows a successful retry', async () => {
    await mount();
    await act(async () => { expect(await action.run(async () => { throw new Error('Network unavailable'); }, 'save')).toBe(false); });
    expect(action.notice).toBe('Network unavailable');
    expect(action.pendingAction).toBeNull();
    await act(async () => { expect(await action.run(async () => {}, 'save')).toBe(true); });
    expect(action.notice).toBeNull();
    expect(action.busy).toBe(false);
  });
});
