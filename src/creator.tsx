import { App as ReferenceApp } from "./App";

/**
 * Creator-owned application entrypoint.
 *
 * Replace this component to supply a completely custom control panel, overlay,
 * or route shell. Headless state/actions live in `src/framework`, while the
 * reference implementation remains available as a working fallback.
 */
export function CreatorApp() {
  return <ReferenceApp />;
}
