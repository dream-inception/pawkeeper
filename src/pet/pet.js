const api = window.breakNeko;
const petIcon = document.getElementById('petIcon');
const petCanvas = document.getElementById('petCanvas');
const petBubble = document.getElementById('petBubble');
const params = new URLSearchParams(window.location.search);
const language = params.get('language') === 'zh' ? 'zh' : 'en';
const defaultIcon = params.get('icon') || petIcon.getAttribute('src');
const reducedMotion = params.get('reducedMotion') === '1';
const playbackScale = 1.8;
let codexPlayer = null;
let lastTimerState = null;
let dragState = null;
let bubbleOverride = null;

const copy = {
  en: {
    focus: 'Focus',
    break: 'Break time',
    hydration: 'Water',
    sedentary: 'Stretch',
    task: 'Task',
    manual: 'Break',
  },
  zh: {
    focus: '专注中',
    break: '休息中',
    hydration: '喝水',
    sedentary: '活动',
    task: '待办',
    manual: '休息',
  },
};

petIcon.src = defaultIcon;
petIcon.alt = params.get('displayName') || 'Cat';
petCanvas.setAttribute('aria-label', params.get('displayName') || 'Cat');

function t(key) {
  return copy[language]?.[key] || copy.en[key];
}

function setBubble(text) {
  if (!text) {
    petBubble.hidden = true;
    return;
  }
  petBubble.textContent = text;
  petBubble.hidden = false;
}

function setBubbleOverride(text, expiresAt = null) {
  if (!text) {
    bubbleOverride = null;
    return;
  }
  bubbleOverride = {
    text,
    expiresAt: Number.isFinite(expiresAt) ? expiresAt : null,
  };
  setBubble(text);
}

function getBubbleOverrideText() {
  if (!bubbleOverride) return '';
  if (bubbleOverride.expiresAt != null && bubbleOverride.expiresAt <= Date.now()) {
    bubbleOverride = null;
    return '';
  }
  return bubbleOverride.text;
}

function refreshBubble(state) {
  const overrideText = getBubbleOverrideText();
  if (overrideText) {
    setBubble(overrideText);
    return;
  }
  if (!state?.running) {
    setBubble('');
    return;
  }
  if (state.activeReminder?.type) {
    setBubble(t(state.activeReminder.type));
    return;
  }
  if (state.primaryCountdown?.source === 'pomodoro') {
    setBubble(state.pomodoroPhase === 'break' ? t('break') : t('focus'));
    return;
  }
  setBubble('');
}

function refreshPetAnimation(state) {
  lastTimerState = state;
}

function refreshPetState(state) {
  refreshBubble(state);
  refreshPetAnimation(state);
}

function triggerBreak() {
  resetPetTransform();
  codexPlayer?.playTemporary('waving', 900);
  api.triggerBreakNow().catch(() => {});
}

petIcon.addEventListener('dblclick', triggerBreak);
petCanvas.addEventListener('dblclick', triggerBreak);

function attachPointerInteractions(element) {
  element.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    dragState = {
      pointerId: event.pointerId,
      startX: event.screenX,
      startY: event.screenY,
      startedAt: performance.now(),
      dragging: false,
    };
    api.beginPetDrag?.().catch(() => {});
    element.setPointerCapture?.(event.pointerId);
  });

  element.addEventListener('pointermove', (event) => {
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    const totalDeltaX = event.screenX - dragState.startX;
    const totalDeltaY = event.screenY - dragState.startY;
    if (
      !dragState.dragging &&
      (Math.hypot(totalDeltaX, totalDeltaY) < 12 || performance.now() - dragState.startedAt < 90)
    ) {
      return;
    }
    dragState.dragging = true;
    resetPetTransform();
  });

  element.addEventListener('pointerup', async (event) => {
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    dragState = null;
    element.releasePointerCapture?.(event.pointerId);
    const result = await api.finishPetDrag?.().catch(() => null);
    if (result?.dragged) {
      return;
    }
    resetPetTransform();
    codexPlayer?.playTemporary('waving', 1200);
  });

  element.addEventListener('pointercancel', () => {
    dragState = null;
    api.finishPetDrag?.().catch(() => {});
  });
}

function createCodexPlayer({ canvas, fallbackImage, spritesheet }) {
  const context = canvas.getContext('2d');
  const image = new Image();
  const columns = 8;
  const rowCount = 9;
  let cellWidth = 192;
  let cellHeight = 208;
  const rows = {
    idle: 0,
    runningRight: 1,
    runningLeft: 2,
    waving: 3,
    jumping: 4,
    failed: 5,
    waiting: 6,
    running: 7,
    review: 8,
  };
  const defaultFramePlans = {
    idle: { count: 6, durations: [280, 110, 110, 140, 140, 320] },
    runningRight: { count: 8, durations: [120, 120, 120, 120, 120, 120, 120, 220] },
    runningLeft: { count: 8, durations: [120, 120, 120, 120, 120, 120, 120, 220] },
    waving: { count: 4, durations: [140, 140, 140, 280] },
    jumping: { count: 5, durations: [140, 140, 140, 140, 280] },
    failed: { count: 8, durations: [140, 140, 140, 140, 140, 140, 140, 240] },
    waiting: { count: 6, durations: [150, 150, 150, 150, 150, 260] },
    running: { count: 6, durations: [120, 120, 120, 120, 120, 220] },
    review: { count: 6, durations: [150, 150, 150, 150, 150, 280] },
  };
  let framePlans = defaultFramePlans;
  let currentState = reducedMotion ? 'idle' : 'idle';
  let temporaryUntil = 0;
  let loopPlayback = null;
  let frameIndex = 0;
  let lastFrameAt = 0;
  let animationFrameId = 0;
  let isReady = false;

  function drawFrame(timestamp = performance.now()) {
    if (!isReady) return;

    const plan = framePlans[currentState] || framePlans.idle;
    const duration = plan.durations[frameIndex] || 150;
    if (!lastFrameAt) {
      lastFrameAt = timestamp;
    } else if (timestamp - lastFrameAt >= duration) {
      const nextFrameIndex = (frameIndex + 1) % plan.count;
      if (loopPlayback && nextFrameIndex === 0) {
        loopPlayback.remaining -= 1;
        if (loopPlayback.remaining <= 0) {
          loopPlayback = null;
          temporaryUntil = 0;
          currentState = 'idle';
          frameIndex = 0;
          lastFrameAt = timestamp;
          animationFrameId = requestAnimationFrame(drawFrame);
          return;
        }
      }
      frameIndex = nextFrameIndex;
      lastFrameAt = timestamp;
    }

    const row = rows[currentState] ?? rows.idle;
    context.clearRect(0, 0, cellWidth, cellHeight);
    context.drawImage(
      image,
      frameIndex * cellWidth,
      row * cellHeight,
      cellWidth,
      cellHeight,
      0,
      0,
      cellWidth,
      cellHeight
    );
    animationFrameId = requestAnimationFrame(drawFrame);
  }

  image.onload = () => {
    cellWidth = Math.floor(image.naturalWidth / columns);
    cellHeight = Math.floor(image.naturalHeight / rowCount);
    canvas.width = cellWidth;
    canvas.height = cellHeight;
    framePlans = detectFramePlans(image, rows, defaultFramePlans, {
      columns,
      cellWidth,
      cellHeight,
    });
    isReady = true;
    fallbackImage.hidden = true;
    canvas.hidden = false;
    drawFrame();
  };
  image.onerror = () => {
    cancelAnimationFrame(animationFrameId);
    canvas.hidden = true;
    fallbackImage.hidden = false;
  };
  image.src = spritesheet;

  return {
    play(state) {
      if (!rows.hasOwnProperty(state)) return;
      if (reducedMotion && state !== 'failed') state = 'idle';
      if (temporaryUntil > performance.now()) return;
      if (currentState !== state) {
        if (state !== 'idle') resetPetTransform();
        loopPlayback = null;
        currentState = state;
        frameIndex = 0;
        lastFrameAt = 0;
      }
    },
    playTemporary(state, durationMs) {
      if (!rows.hasOwnProperty(state)) return;
      if (reducedMotion && state !== 'failed') return;
      resetPetTransform();
      loopPlayback = null;
      currentState = state;
      temporaryUntil = performance.now() + durationMs;
      frameIndex = 0;
      lastFrameAt = 0;
      setTimeout(() => {
        if (temporaryUntil <= performance.now()) {
          currentState = 'idle';
          if (lastTimerState) refreshPetAnimation(lastTimerState);
        }
      }, durationMs);
    },
    playCount(state, count) {
      if (!rows.hasOwnProperty(state)) return;
      if (reducedMotion && state !== 'failed') state = 'idle';
      resetPetTransform();
      currentState = state;
      frameIndex = 0;
      lastFrameAt = 0;
      loopPlayback = { remaining: Math.max(1, Math.min(100, Number.parseInt(count, 10) || 1)) };
      const plan = framePlans[state] || framePlans.idle;
      temporaryUntil = performance.now() + plan.durations.reduce((sum, duration) => sum + duration, 0) * loopPlayback.remaining + 100;
    },
    getVisualState() {
      return {
        state: currentState,
        temporaryUntil,
      };
    },
  };
}

function detectFramePlans(image, rows, defaultFramePlans, geometry) {
  const scratch = document.createElement('canvas');
  scratch.width = geometry.cellWidth;
  scratch.height = geometry.cellHeight;
  const scratchContext = scratch.getContext('2d', { willReadFrequently: true });
  if (!scratchContext) return defaultFramePlans;

  return Object.fromEntries(Object.entries(defaultFramePlans).map(([state, plan]) => {
    const row = rows[state];
    let count = 0;
    for (let column = 0; column < geometry.columns; column += 1) {
      scratchContext.clearRect(0, 0, geometry.cellWidth, geometry.cellHeight);
      scratchContext.drawImage(
        image,
        column * geometry.cellWidth,
        row * geometry.cellHeight,
        geometry.cellWidth,
        geometry.cellHeight,
        0,
        0,
        geometry.cellWidth,
        geometry.cellHeight
      );
      if (!hasVisiblePixels(scratchContext, geometry.cellWidth, geometry.cellHeight)) break;
      count += 1;
    }

    const safeCount = Math.max(1, count || plan.count);
    return [state, {
      count: safeCount,
      durations: scaleDurations(getDurationsForCount(plan.durations, safeCount), playbackScale),
    }];
  }));
}

function hasVisiblePixels(context, width, height) {
  const { data } = context.getImageData(0, 0, width, height);
  for (let index = 3; index < data.length; index += 16) {
    if (data[index] > 8) return true;
  }
  return false;
}

function getDurationsForCount(baseDurations, count) {
  const durations = baseDurations.slice(0, count);
  while (durations.length < count) {
    durations.push(baseDurations[baseDurations.length - 1] || 150);
  }
  return durations;
}

function scaleDurations(durations, scale) {
  return durations.map((duration) => Math.round(duration * scale));
}

if (params.get('mode') === 'codex' && params.get('spritesheet')) {
  codexPlayer = createCodexPlayer({
    canvas: petCanvas,
    fallbackImage: petIcon,
    spritesheet: params.get('spritesheet'),
  });
}

api.onPetControl?.((controlState) => {
  if (controlState?.state) {
    if (controlState.playCount > 0) {
      codexPlayer?.playCount(controlState.state, controlState.playCount);
    } else {
      codexPlayer?.play(controlState.state);
    }
    if (controlState.source !== 'mouse' && controlState.message) {
      setBubbleOverride(controlState.message, controlState.expiresAt);
    } else {
      if (controlState.source !== 'mouse') {
        setBubbleOverride('');
      }
      refreshBubble(lastTimerState);
    }
  }
});

api.onPetCursor?.((cursor) => {
  if (!codexPlayer || dragState?.dragging) return;
  const visualState = codexPlayer.getVisualState();
  if (visualState.state !== 'idle' || visualState.temporaryUntil > performance.now()) {
    resetPetTransform();
    return;
  }
  if (!cursor.isNear) {
    resetPetTransform();
    return;
  }
  const lean = Math.max(-10, Math.min(10, (cursor.deltaX || 0) / 18));
  const lift = cursor.isNear ? -3 : 0;
  petCanvas.style.transform = `translate(${lean}px, ${lift}px)`;
});

function resetPetTransform() {
  petCanvas.style.transform = '';
}

attachPointerInteractions(petIcon);
attachPointerInteractions(petCanvas);
api.getTimerState().then(refreshPetState).catch(() => {});
api.onTimerState?.(refreshPetState);
