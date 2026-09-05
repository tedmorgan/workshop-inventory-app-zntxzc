/**
 * Regression guard for the image gallery zoom crash.
 *
 * Bug: the pinch / double-tap `onEnd` handlers are Reanimated worklets that run
 * on the UI thread. Calling a plain JS helper (e.g. `resetZoom()`) from inside
 * a worklet crashes the app ("Tried to synchronously call a non-worklet
 * function on the UI thread") — which happened when zooming a single image out.
 *
 * These static checks ensure the crash-prone pattern isn't reintroduced:
 *  - no JS `resetZoom` helper is called from the gesture worklets,
 *  - React state changes from worklets go through `runOnJS`.
 *
 * Created: 2026-09-05
 */

import * as fs from 'fs';
import * as path from 'path';

const source = fs.readFileSync(
  path.join(__dirname, '..', '..', 'components', 'ImageGalleryModal.tsx'),
  'utf8'
);

describe('ImageGalleryModal worklet safety', () => {
  it('does not call a JS resetZoom() helper from gesture worklets', () => {
    // The helper was the source of the crash; resets must be inlined in the worklet.
    expect(source).not.toMatch(/resetZoom\s*\(/);
  });

  it('updates the "zoomed" React state via runOnJS (never directly in a worklet)', () => {
    expect(source).toMatch(/runOnJS\(setZoomed\)/);
    // setZoomed must not be invoked directly (which would run on the UI thread).
    expect(source).not.toMatch(/(?<!runOnJS\()\bsetZoomed\(/);
  });

  it('closes via runOnJS from the single-tap worklet', () => {
    expect(source).toMatch(/runOnJS\(onRequestClose\)/);
  });
});
