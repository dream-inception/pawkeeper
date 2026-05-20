const assert = require('node:assert/strict');
const test = require('node:test');

const {
  PET_STATES,
  createPetRuntimeController,
  estimatePetStateDuration,
} = require('../src/main/pet-runtime');

test('pet runtime exposes supported states and defaults to idle', () => {
  const runtime = createPetRuntimeController({ now: () => 1000 });
  const state = runtime.getState();

  assert.equal(state.state, 'idle');
  assert.equal(state.source, 'idle');
  assert.deepEqual(state.availableStates, PET_STATES);
});

test('pet runtime prioritizes MCP over timer and mouse states', () => {
  let currentTime = 1000;
  const runtime = createPetRuntimeController({ now: () => currentTime });

  runtime.setState('mouse', 'runningLeft', { durationMs: 5000 });
  runtime.setState('timer', 'running', {});
  runtime.setState('mcp', 'waving', { durationMs: 5000, message: 'Hello' });

  assert.equal(runtime.getState().state, 'waving');
  assert.equal(runtime.getState().source, 'mcp');
  assert.equal(runtime.getState().message, 'Hello');

  currentTime += 6000;
  assert.equal(runtime.getState().state, 'running');
  assert.equal(runtime.getState().source, 'timer');
});

test('pet runtime derives timer states from public timer state', () => {
  const runtime = createPetRuntimeController({ now: () => 1000 });

  runtime.updateTimerState({
    running: true,
    primaryCountdown: { source: 'pomodoro' },
    pomodoroPhase: 'focus',
  });
  assert.equal(runtime.getState().state, 'running');

  runtime.updateTimerState({
    running: true,
    activeReminder: { type: 'task', title: 'Ship it' },
  });
  assert.equal(runtime.getState().state, 'review');
  assert.equal(runtime.getState().message, 'Ship it');

  runtime.updateTimerState({ running: false });
  assert.equal(runtime.getState().state, 'idle');
});

test('pet runtime rejects unsupported states', () => {
  const runtime = createPetRuntimeController();
  assert.throws(() => runtime.setState('mcp', 'dance'), /Unsupported pet state/);
});

test('pet runtime accepts Codex hyphenated direction aliases', () => {
  const runtime = createPetRuntimeController({ now: () => 1000 });

  runtime.setState('mcp', 'running-right');
  assert.equal(runtime.getState().state, 'runningRight');

  runtime.setState('mcp', 'running-left');
  assert.equal(runtime.getState().state, 'runningLeft');
});

test('pet runtime carries play count and estimates duration', () => {
  let currentTime = 1000;
  const runtime = createPetRuntimeController({ now: () => currentTime });
  const state = runtime.setState('mcp', 'waving', { playCount: 3, message: 'Hi' });

  assert.equal(state.state, 'waving');
  assert.equal(state.playCount, 3);
  assert.equal(state.message, 'Hi');
  assert.equal(state.expiresAt, 1000 + estimatePetStateDuration('waving', 3));

  currentTime = state.expiresAt + 1;
  assert.equal(runtime.getState().state, 'idle');
});
