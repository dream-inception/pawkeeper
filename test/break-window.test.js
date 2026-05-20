const assert = require('node:assert/strict');
const test = require('node:test');

const {
  canUseBreakMousePassthrough,
  getBreakWindowBoundsForDisplay,
  isBreakSkipShortcut,
} = require('../src/main/break-window');

test('detects break skip shortcuts across macOS and Windows conventions', () => {
  assert.equal(isBreakSkipShortcut({ key: 'Escape' }), true);
  assert.equal(isBreakSkipShortcut({ key: 'w', meta: true }), true);
  assert.equal(isBreakSkipShortcut({ key: 'w', control: true }), true);
  assert.equal(isBreakSkipShortcut({ key: 'q', meta: true }), true);
  assert.equal(isBreakSkipShortcut({ key: 'q', control: true }), true);
  assert.equal(isBreakSkipShortcut({ key: 'F4', alt: true }), true);
  assert.equal(isBreakSkipShortcut({ key: 'w' }), false);
});

test('uses work area bounds on macOS and Windows break windows', () => {
  const display = {
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    workArea: { x: 0, y: 0, width: 1920, height: 1040 },
  };

  assert.deepEqual(getBreakWindowBoundsForDisplay(display, 'darwin'), display.workArea);
  assert.deepEqual(getBreakWindowBoundsForDisplay(display, 'win32'), display.workArea);
  assert.deepEqual(getBreakWindowBoundsForDisplay(display, 'linux'), display.bounds);
});

test('only enables overlay mouse passthrough where forwarded mouse events work', () => {
  assert.equal(canUseBreakMousePassthrough({
    presentation: 'overlay',
    testMode: false,
    platform: 'darwin',
    automationTestMode: false,
  }), true);
  assert.equal(canUseBreakMousePassthrough({
    presentation: 'overlay',
    testMode: false,
    platform: 'win32',
    automationTestMode: false,
  }), false);
  assert.equal(canUseBreakMousePassthrough({
    presentation: 'fullscreen',
    testMode: false,
    platform: 'darwin',
    automationTestMode: false,
  }), false);
});
