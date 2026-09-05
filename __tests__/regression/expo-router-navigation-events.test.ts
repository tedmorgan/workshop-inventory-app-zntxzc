/**
 * Regression test for the Expo SDK 57 "View Inventory" navigation crash.
 *
 * Root cause: expo-router's internal navigation telemetry emitter
 * (`navigationEvents.emit`) invoked subscriber callbacks with no error
 * isolation. During the focus -> dispatch cascade on tab navigation an
 * internal subscriber threw re-entrantly, the error propagated up through
 * react-navigation's event emitter and tore down the whole navigator
 * (ContextNavigator / ExpoRoot), crashing the app on "View Inventory".
 *
 * Fix (patches/expo-router+57.0.19.patch): telemetry subscribers are now
 * isolated in a try/catch so a throwing subscriber can never crash
 * navigation. This test loads the ACTUAL patched module from node_modules
 * and fails if the patch is ever dropped/reverted.
 *
 * Created: 2026-09-04
 */

// Load the real (patched) expo-router telemetry module, not a mock.
// The path is computed at runtime so ts-jest does not pull the plain-JS
// node_modules file into TypeScript compilation.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const navigationEvents = require(
  path.join(
    process.cwd(),
    'node_modules/expo-router/build/navigationEvents/index.js'
  )
);

describe('expo-router navigation.js module resolution (SDK 57 regression)', () => {
  it('imports emit via explicit "./index", never a bare "." (Metro resolves bare "." to the package main, where emit is undefined)', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('fs');
    const navSrc = fs.readFileSync(
      path.join(
        process.cwd(),
        'node_modules/expo-router/build/navigationEvents/navigation.js'
      ),
      'utf8'
    );
    // Must NOT use the bare "." specifier that Metro mis-resolves.
    expect(navSrc).not.toMatch(/require\(["']\.["']\)/);
    // Must use the explicit local index specifier.
    expect(navSrc).toMatch(/require\(["']\.\/index["']\)/);
  });
});

describe('expo-router navigation telemetry isolation (SDK 57 regression)', () => {
  it('does not let a throwing "actionDispatched" subscriber crash emit()', () => {
    const unsubscribe = navigationEvents.unstable_navigationEvents.addListener(
      'actionDispatched',
      () => {
        throw new Error('simulated re-entrant subscriber crash');
      }
    );

    // Silence the expected console.warn from the isolation guard.
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      // Before the fix this threw and unwound the navigator. It must not now.
      expect(() =>
        navigationEvents.emit('actionDispatched', {
          actionType: 'NAVIGATE',
          payload: {},
          state: {},
        })
      ).not.toThrow();
    } finally {
      warnSpy.mockRestore();
      unsubscribe();
    }
  });

  it('still delivers events to healthy subscribers even if another throws', () => {
    const received: unknown[] = [];
    const unsubBad = navigationEvents.unstable_navigationEvents.addListener(
      'actionDispatched',
      () => {
        throw new Error('bad subscriber');
      }
    );
    const unsubGood = navigationEvents.unstable_navigationEvents.addListener(
      'actionDispatched',
      (event: unknown) => {
        received.push(event);
      }
    );
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      navigationEvents.emit('actionDispatched', { actionType: 'PUSH' });
      // The healthy subscriber must still have received the event.
      expect(received).toHaveLength(1);
    } finally {
      warnSpy.mockRestore();
      unsubBad();
      unsubGood();
    }
  });
});
