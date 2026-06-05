const PET_STATES = Object.freeze([
  'idle',
  'runningRight',
  'runningLeft',
  'waving',
  'jumping',
  'failed',
  'waiting',
  'running',
  'review',
]);

const PET_STATE_SET = new Set(PET_STATES);
const PET_STATE_ALIASES = Object.freeze({
  'running-right': 'runningRight',
  'running-left': 'runningLeft',
});
const PET_SOURCE_PRIORITY = Object.freeze({
  idle: 0,
  mouse: 10,
  timer: 20,
  user: 30,
  mcp: 40,
});
const PET_STATE_FRAME_COUNTS = Object.freeze({
  idle: 6,
  runningRight: 8,
  runningLeft: 8,
  waving: 4,
  jumping: 5,
  failed: 8,
  waiting: 6,
  running: 6,
  review: 6,
});
const PET_FRAME_DURATION_MS = 1000 / 6;

function createPetRuntimeController({ now = () => Date.now() } = {}) {
  const inputs = new Map();
  let activeState = createIdleState(now());

  function setState(source, state, options = {}) {
    const normalizedState = normalizePetState(state);
    const safeSource = normalizeSource(source);
    const playCount = normalizePlayCount(options.playCount);
    const durationMs = normalizeDuration(
      options.durationMs ?? (playCount > 0 ? estimatePetStateDuration(normalizedState, playCount) : null)
    );
    const updatedAt = now();
    const expiresAt = durationMs > 0 ? updatedAt + durationMs : null;
    const priority = Number.isFinite(options.priority)
      ? options.priority
      : (PET_SOURCE_PRIORITY[safeSource] ?? PET_SOURCE_PRIORITY.user);

    inputs.set(safeSource, {
      state: normalizedState,
      source: safeSource,
      priority,
      message: typeof options.message === 'string' ? options.message.slice(0, 120) : '',
      playCount,
      updatedAt,
      expiresAt,
    });
    return recompute();
  }

  function clearState(source = null) {
    if (source) {
      inputs.delete(normalizeSource(source));
    } else {
      inputs.clear();
    }
    return recompute();
  }

  function updateTimerState(timerState) {
    if (!timerState?.running) {
      inputs.delete('timer');
      return recompute();
    }

    if (timerState.activeReminder?.type) {
      return setState('timer', timerState.activeReminder.type === 'task' ? 'review' : 'jumping', {
        message: timerState.activeReminder.title || '',
      });
    }

    if (timerState.primaryCountdown?.source === 'pomodoro' && timerState.pomodoroPhase !== 'break') {
      return setState('timer', 'running', { message: 'Focus' });
    }

    inputs.delete('timer');
    return recompute();
  }

  function getState() {
    cleanupExpired();
    activeState = computeActiveState();
    return { ...activeState, availableStates: PET_STATES };
  }

  function recompute() {
    cleanupExpired();
    activeState = { ...computeActiveState(), availableStates: PET_STATES };
    return getState();
  }

  function computeActiveState() {
    return [...inputs.values()]
      .sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        return b.updatedAt - a.updatedAt;
      })[0] || createIdleState(now());
  }

  function cleanupExpired() {
    const currentTime = now();
    for (const [source, input] of inputs.entries()) {
      if (input.expiresAt != null && input.expiresAt <= currentTime) {
        inputs.delete(source);
      }
    }
  }

  return {
    clearState,
    getState,
    setState,
    updateTimerState,
  };
}

function createIdleState(timestamp) {
  return {
    state: 'idle',
    source: 'idle',
    priority: PET_SOURCE_PRIORITY.idle,
    message: '',
    playCount: 0,
    updatedAt: timestamp,
    expiresAt: null,
    availableStates: PET_STATES,
  };
}

function assertPetState(state) {
  normalizePetState(state);
}

function normalizePetState(state) {
  const normalizedState = PET_STATE_ALIASES[state] || state;
  if (!PET_STATE_SET.has(normalizedState)) {
    throw new Error(`Unsupported pet state "${state}". Supported states: ${PET_STATES.join(', ')}.`);
  }
  return normalizedState;
}

function normalizeSource(source) {
  return PET_SOURCE_PRIORITY.hasOwnProperty(source) ? source : 'user';
}

function normalizeDuration(durationMs) {
  if (durationMs == null) return 0;
  const parsed = Number.parseInt(durationMs, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.min(parsed, 10 * 60 * 1000);
}

function normalizePlayCount(playCount) {
  if (playCount == null) return 0;
  const parsed = Number.parseInt(playCount, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.min(parsed, 100);
}

function estimatePetStateDuration(state, playCount) {
  const frameCount = PET_STATE_FRAME_COUNTS[state] || PET_STATE_FRAME_COUNTS.idle;
  const oneLoop = frameCount * PET_FRAME_DURATION_MS;
  return Math.ceil(oneLoop * playCount) + 80;
}

module.exports = {
  PET_SOURCE_PRIORITY,
  PET_FRAME_DURATION_MS,
  PET_STATE_FRAME_COUNTS,
  PET_STATES,
  assertPetState,
  createPetRuntimeController,
  estimatePetStateDuration,
  normalizePetState,
  normalizePlayCount,
};
