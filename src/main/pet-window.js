const { createPetRuntimeController } = require('./pet-runtime');

function createPetWindowController({
  BrowserWindow,
  getAssetPath,
  getSettings,
  getSourcePath,
  screen,
  toFileUrl,
  updateSettings,
}) {
  let petWindow = null;
  let petMoveSaveTimer = null;
  let loadedPetKey = '';
  let cursorPollTimer = null;
  let petStateExpiryTimer = null;
  let dragPollTimer = null;
  let dragSession = null;
  let controlledMoveUntil = 0;
  let lastMouseActionAt = 0;
  const runtime = createPetRuntimeController();

  function updatePetWindow(settings) {
    if (!settings.pet.enabled) {
      if (petWindow && !petWindow.isDestroyed()) {
        petWindow.close();
      }
      stopCursorPolling();
      return;
    }

    if (petWindow && !petWindow.isDestroyed()) {
      petWindow.setAlwaysOnTop(settings.pet.alwaysOnTop, 'floating');
      petWindow.setSize(settings.pet.size, settings.pet.size);
      const nextPetKey = getPetContentKey(settings);
      if (nextPetKey !== loadedPetKey) {
        loadPetContent(settings);
      }
      syncCursorPolling(settings);
      broadcastPetState();
      return;
    }

    createPetWindow(settings);
    syncCursorPolling(settings);
  }

  function createPetWindow(settings) {
    const bounds = getPetWindowBounds(settings.pet);
    petWindow = new BrowserWindow({
      ...bounds,
      width: settings.pet.size,
      height: settings.pet.size,
      frame: false,
      resizable: false,
      transparent: true,
      hasShadow: false,
      skipTaskbar: true,
      alwaysOnTop: settings.pet.alwaysOnTop,
      backgroundColor: '#00000000',
      webPreferences: {
        preload: getSourcePath('preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    petWindow.setAlwaysOnTop(settings.pet.alwaysOnTop, 'floating');
    loadPetContent(settings);

    petWindow.on('move', schedulePetPositionSave);
    petWindow.on('closed', () => {
      petWindow = null;
      stopCursorPolling();
      stopDragPolling();
      clearTimeout(petStateExpiryTimer);
    });
  }

  function loadPetContent(settings) {
    const activeCodexPet = getActiveCodexPet(settings);
    loadedPetKey = getPetContentKey(settings);
    petWindow.loadFile(getSourcePath('pet', 'index.html'), {
      query: {
        language: settings.language,
        icon: toFileUrl(getAssetPath('break-neko-icon128.png')),
        mode: activeCodexPet ? 'codex' : 'default',
        displayName: activeCodexPet?.displayName || '',
        spritesheet: activeCodexPet ? toFileUrl(activeCodexPet.spritesheetPath) : '',
        reducedMotion: settings.pet.reducedMotion ? '1' : '0',
      },
    });
    petWindow.webContents.once('did-finish-load', () => {
      broadcastPetState();
    });
  }

  function getActiveCodexPet(settings) {
    const activeId = settings.codexPets?.activeId;
    return settings.codexPets?.items?.find((item) => item.id === activeId) || null;
  }

  function getPetContentKey(settings) {
    const activeCodexPet = getActiveCodexPet(settings);
    return activeCodexPet
      ? `codex:${activeCodexPet.id}:${activeCodexPet.spritesheetPath}`
      : 'default';
  }

  function getPetWindowBounds(petSettings) {
    if (petSettings.position) {
      return {
        x: petSettings.position.x,
        y: petSettings.position.y,
      };
    }

    const { workArea } = screen.getPrimaryDisplay();
    return {
      x: workArea.x + workArea.width - petSettings.size - 24,
      y: workArea.y + workArea.height - petSettings.size - 24,
    };
  }

  function schedulePetPositionSave() {
    if (!petWindow || petWindow.isDestroyed()) return;
    if (Date.now() < controlledMoveUntil) return;
    clearTimeout(petMoveSaveTimer);
    petMoveSaveTimer = setTimeout(() => {
      if (!petWindow || petWindow.isDestroyed()) return;

      const [x, y] = petWindow.getPosition();
      const settings = getSettings();
      updateSettings({
        ...settings,
        pet: {
          ...settings.pet,
          position: { x, y },
        },
      });
    }, 300);
  }

  function movePetBy(deltaX, deltaY) {
    if (!petWindow || petWindow.isDestroyed()) return false;
    const [x, y] = petWindow.getPosition();
    const settings = getSettings();
    const nextPosition = clampPetPosition({
      x: x + Math.round(deltaX || 0),
      y: y + Math.round(deltaY || 0),
      size: settings.pet.size,
    });
    controlledMoveUntil = Date.now() + 500;
    petWindow.setPosition(nextPosition.x, nextPosition.y, false);
    setPetState('user', Math.sign(deltaX) < 0 ? 'runningLeft' : 'runningRight', {
      durationMs: 500,
    });
    return true;
  }

  function beginPetDrag() {
    if (!petWindow || petWindow.isDestroyed()) return false;
    const cursor = screen.getCursorScreenPoint();
    const [x, y] = petWindow.getPosition();
    const [width, height] = petWindow.getSize();
    dragSession = {
      startCursor: cursor,
      startPosition: { x, y },
      size: Math.max(width, height),
      dragged: false,
      lastStateAt: 0,
    };
    stopCursorPolling();
    if (!dragPollTimer) {
      dragPollTimer = setInterval(pollDragMove, 16);
    }
    return true;
  }

  function finishPetDrag() {
    if (!petWindow || petWindow.isDestroyed()) return false;
    const wasDragged = dragSession?.dragged === true;
    stopDragPolling();
    const [x, y] = petWindow.getPosition();
    const settings = getSettings();
    if (wasDragged) {
      updateSettings({
        ...settings,
        pet: {
          ...settings.pet,
          position: { x, y },
        },
      });
      setPetState('user', 'waving', { durationMs: 900 });
    }
    syncCursorPolling(getSettings());
    return { dragged: wasDragged };
  }

  function pollDragMove() {
    if (!petWindow || petWindow.isDestroyed() || !dragSession) return;
    const cursor = screen.getCursorScreenPoint();
    const deltaX = cursor.x - dragSession.startCursor.x;
    const deltaY = cursor.y - dragSession.startCursor.y;
    const distance = Math.hypot(deltaX, deltaY);
    if (!dragSession.dragged && distance < 10) return;

    dragSession.dragged = true;
    const nextPosition = clampPetPosition({
      x: dragSession.startPosition.x + deltaX,
      y: dragSession.startPosition.y + deltaY,
      size: dragSession.size,
    });
    controlledMoveUntil = Date.now() + 500;
    petWindow.setPosition(nextPosition.x, nextPosition.y, false);

    const now = Date.now();
    if (now - dragSession.lastStateAt > 220) {
      dragSession.lastStateAt = now;
      setPetState('user', deltaX < 0 ? 'runningLeft' : 'runningRight', {
        durationMs: 420,
      });
    }
  }

  function stopDragPolling() {
    if (dragPollTimer) {
      clearInterval(dragPollTimer);
      dragPollTimer = null;
    }
    dragSession = null;
  }

  function updateApplicationPetState(timerState) {
    const nextState = runtime.updateTimerState(timerState);
    broadcastPetState(nextState);
  }

  function setPetState(source, state, options = {}) {
    const nextState = runtime.setState(source, state, options);
    broadcastPetState(nextState);
    return nextState;
  }

  function clearPetState(source = null) {
    const nextState = runtime.clearState(source);
    broadcastPetState(nextState);
    return nextState;
  }

  function getPetRuntimeState() {
    return {
      ...runtime.getState(),
      petEnabled: getSettings().pet.enabled,
      activePet: getActiveCodexPet(getSettings()),
    };
  }

  function broadcastPetState(state = runtime.getState()) {
    schedulePetStateExpiry(state);
    if (!petWindow || petWindow.isDestroyed()) return;
    petWindow.webContents.send('pet:control', state);
  }

  function schedulePetStateExpiry(state) {
    clearTimeout(petStateExpiryTimer);
    if (!state?.expiresAt) return;
    const delay = Math.max(0, state.expiresAt - Date.now() + 20);
    petStateExpiryTimer = setTimeout(() => {
      broadcastPetState(runtime.getState());
    }, delay);
  }

  function isPetWebContents(webContents) {
    return Boolean(petWindow && !petWindow.isDestroyed() && petWindow.webContents === webContents);
  }

  function syncCursorPolling(settings = getSettings()) {
    const shouldPoll = Boolean(
      settings.pet.enabled &&
      settings.pet.interactionEnabled &&
      !settings.pet.reducedMotion &&
      !isInteractionPaused(settings.pet)
    );
    if (!shouldPoll) {
      stopCursorPolling();
      clearPetState('mouse');
      return;
    }
    if (!cursorPollTimer) {
      cursorPollTimer = setInterval(pollCursorInteraction, 160);
    }
  }

  function stopCursorPolling() {
    if (cursorPollTimer) {
      clearInterval(cursorPollTimer);
      cursorPollTimer = null;
    }
  }

  function pollCursorInteraction() {
    if (!petWindow || petWindow.isDestroyed()) return;
    const settings = getSettings();
    if (!settings.pet.interactionEnabled || isInteractionPaused(settings.pet)) {
      clearPetState('mouse');
      return;
    }

    const cursor = screen.getCursorScreenPoint();
    const [x, y] = petWindow.getPosition();
    const [width, height] = petWindow.getSize();
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const deltaX = cursor.x - centerX;
    const deltaY = cursor.y - centerY;
    const distance = Math.hypot(deltaX, deltaY);
    const nearDistance = width * (1.1 + settings.pet.mouseReactivity / 180);
    const isNear = distance < nearDistance;
    const isCursorInsidePet = cursor.x >= x && cursor.x <= x + width && cursor.y >= y && cursor.y <= y + height;
    const direction = deltaX < 0 ? 'left' : 'right';
    const now = Date.now();
    const shouldAvoid = settings.pet.avoidCursor || settings.pet.interactionMode === 'playful';
    const shouldFollow = settings.pet.followCursor || settings.pet.interactionMode === 'follow';

    petWindow.webContents.send('pet:cursor', {
      x: cursor.x,
      y: cursor.y,
      deltaX,
      deltaY,
      distance,
      isNear,
      direction,
    });

    if (isCursorInsidePet) {
      clearPetState('mouse');
      return;
    }

    if (shouldAvoid && isNear && distance > 0 && now - lastMouseActionAt > 1400) {
      lastMouseActionAt = now;
      const step = Math.min(width * 0.9, 28 + Math.round(settings.pet.mouseReactivity / 2));
      movePetProgrammatically({
        x: x - (deltaX / distance) * step,
        y: y - (deltaY / distance) * step,
        size: width,
      });
      setPetState('mouse', direction === 'left' ? 'runningRight' : 'runningLeft', {
        durationMs: 850,
      });
      return;
    }

    if (shouldFollow && distance > width * 0.9 && distance < width * 9) {
      const step = Math.min(34, Math.max(8, distance * 0.14 + settings.pet.mouseReactivity / 12));
      movePetProgrammatically({
        x: x + (deltaX / distance) * step,
        y: y + (deltaY / distance) * step,
        size: width,
      });
      setPetState('mouse', direction === 'left' ? 'runningLeft' : 'runningRight', {
        durationMs: 620,
      });
      return;
    }

    if (settings.pet.lookAtCursor && isNear) {
      // Looking is rendered as a subtle lean in the pet window. Do not switch
      // animation rows here; left/right row thrashing reads as flicker.
      clearPetState('mouse');
      return;
    }

    clearPetState('mouse');
  }

  function movePetProgrammatically({ x, y, size }) {
    if (!petWindow || petWindow.isDestroyed()) return;
    const nextPosition = clampPetPosition({ x, y, size });
    controlledMoveUntil = Date.now() + 500;
    petWindow.setPosition(nextPosition.x, nextPosition.y, false);
  }

  function clampPetPosition({ x, y, size }) {
    const display = screen.getDisplayNearestPoint({ x: Math.round(x), y: Math.round(y) });
    const { workArea } = display;
    return {
      x: Math.round(Math.min(Math.max(x, workArea.x), workArea.x + workArea.width - size)),
      y: Math.round(Math.min(Math.max(y, workArea.y), workArea.y + workArea.height - size)),
    };
  }

  function isInteractionPaused(petSettings) {
    return Boolean(
      petSettings.interactionPausedUntil &&
      Date.parse(petSettings.interactionPausedUntil) > Date.now()
    );
  }

  return {
    clearPetState,
    beginPetDrag,
    finishPetDrag,
    getPetRuntimeState,
    isPetWebContents,
    movePetBy,
    setPetState,
    updateApplicationPetState,
    updatePetWindow,
  };
}

module.exports = {
  createPetWindowController,
};
