const path = require('node:path');
const fs = require('node:fs');

function createBreakWindowController({
  app,
  BrowserWindow,
  screen,
  getAssetPath,
  getSettings,
  getSourcePath,
  getTimerService,
  getUnpackedAssetPath,
  onSkipBreak,
  tMain,
  toFileUrl,
  env = process.env,
}) {
  let breakWindow = null;
  let resumeTimerAfterBreak = false;
  let breakMousePassthroughAllowed = false;
  let isClosingBreakWindow = false;
  let skipRequested = false;

  function showBreakWindow({
    testMode = false,
    reminder = null,
    presentation = 'overlay',
    skipAllWorkspaces = false,
    onDidFinishLoad = null,
  } = {}) {
    const settings = getSettings();
    const breakLayout = getBreakLayoutMetrics();
    const forceDefaultCat = env.BREAK_NEKO_LAYOUT_DIAG_FORCE_DEFAULT_CAT === '1';

    if (breakWindow && !breakWindow.isDestroyed()) {
      if (!testMode) {
        syncBreakWindowBounds(breakWindow);
      }
      breakMousePassthroughAllowed = canUseBreakMousePassthrough({
        presentation,
        testMode,
        platform: process.platform,
        automationTestMode: isBreakAutomationTestMode(),
      });
      breakWindow.loadFile(getSourcePath('break', 'index.html'), {
        query: getBreakWindowQuery({
          breakLayout,
          forceDefaultCat,
          presentation,
          reminder,
          settings,
        }),
      });
      breakWindow.show();
      breakWindow.focus();
      if (!testMode) {
        breakWindow.moveTop();
      }
      return breakWindow;
    }

    resumeTimerAfterBreak = getTimerService()?.getState().running === true;
    getTimerService()?.pause();
    const bounds = getBreakWindowBounds(testMode);
    const isFullscreen = presentation === 'fullscreen' && !testMode;
    breakMousePassthroughAllowed = canUseBreakMousePassthrough({
      presentation,
      testMode,
      platform: process.platform,
      automationTestMode: isBreakAutomationTestMode(),
    });
    isClosingBreakWindow = false;
    skipRequested = false;
    breakWindow = new BrowserWindow({
      width: bounds.width,
      height: bounds.height,
      x: Number.isFinite(bounds.x) ? bounds.x : undefined,
      y: Number.isFinite(bounds.y) ? bounds.y : undefined,
      useContentSize: false,
      fullscreen: isFullscreen,
      fullscreenable: isFullscreen,
      resizable: testMode,
      movable: testMode,
      frame: testMode,
      alwaysOnTop: true,
      skipTaskbar: !testMode,
      show: false,
      transparent: true,
      hasShadow: false,
      backgroundColor: '#00000000',
      ...(process.platform === 'darwin' && !testMode ? { type: 'panel' } : {}),
      ...(process.platform === 'win32' && !testMode ? { roundedCorners: false } : {}),
      webPreferences: {
        preload: getSourcePath('preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    breakWindow.webContents.on('before-input-event', (event, input) => {
      if (isBreakSkipShortcut(input)) {
        event.preventDefault();
        requestSkipBreak();
      }
    });

    if (!testMode) {
      syncBreakWindowBounds(breakWindow);
      if (process.platform !== 'win32' && !skipAllWorkspaces) {
        breakWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
      }
      breakWindow.setAlwaysOnTop(true, 'screen-saver');
      breakWindow.setFullScreenable(false);
      syncBreakWindowBounds(breakWindow);
    }

    breakWindow.once('ready-to-show', () => {
      if (!testMode) {
        syncBreakWindowBounds(breakWindow);
      }
      breakWindow.show();
      if (!testMode) {
        enforceBreakWindowBounds(breakWindow);
      }
    });

    breakWindow.loadFile(getSourcePath('break', 'index.html'), {
      query: getBreakWindowQuery({
        breakLayout,
        forceDefaultCat,
        presentation,
        reminder,
        settings,
      }),
    });

    breakWindow.webContents.once('did-finish-load', () => {
      if (!testMode) {
        enforceBreakWindowBounds(breakWindow);
      }

      if (typeof onDidFinishLoad === 'function') {
        onDidFinishLoad(breakWindow);
      }
    });

    breakWindow.on('close', (event) => {
      if (isClosingBreakWindow || testMode) {
        return;
      }

      event.preventDefault();
      requestSkipBreak();
    });

    breakWindow.on('closed', () => {
      breakMousePassthroughAllowed = false;
      isClosingBreakWindow = false;
      skipRequested = false;
      breakWindow = null;
    });

    return breakWindow;
  }

  function getBreakWindowQuery({
    breakLayout,
    forceDefaultCat,
    presentation,
    reminder,
    settings,
  }) {
    return {
      breakMinutes: String(settings.breakTime),
      title: reminder?.title || tMain('defaultBreakTitle', settings.language),
      message: reminder?.message || tMain('defaultBreakMessage', settings.language),
      actionLabel: reminder?.actionLabel || tMain('done', settings.language),
      reminderType: reminder?.type || 'manual',
      snoozeLabel: tMain('snoozeLabel', settings.language, settings.snoozeMinutes),
      snoozeMinutes: String(settings.snoozeMinutes),
      language: settings.language,
      fallbackTitle: tMain('breakFallbackTitle', settings.language),
      fallbackMessage: tMain('breakFallbackMessage', settings.language),
      shortcutHint: tMain('shortcutHint', settings.language),
      catAlt: tMain('catAlt', settings.language),
      customCatAlt: tMain('customCatAlt', settings.language),
      presentation,
      allowMousePassthrough: breakMousePassthroughAllowed ? '1' : '0',
      neko1: toFileUrl(getUnpackedAssetPath(app, 'neko1.webm')),
      neko2: toFileUrl(getUnpackedAssetPath(app, 'neko2.webm')),
      icon: toFileUrl(getAssetPath('break-neko-icon128.png')),
      customCat: !forceDefaultCat && settings.customCat ? toFileUrl(settings.customCat.path) : '',
      customCatKind: !forceDefaultCat && settings.customCat ? settings.customCat.kind || '' : '',
      customCatOffsetX: String(settings.customCat?.offsetX || 0),
      customCatOffsetY: String(settings.customCat?.offsetY || 0),
      catSizeMode: settings.catDisplay.sizeMode,
      catCustomSize: String(settings.catDisplay.customSize),
      layoutOriginX: String(breakLayout.originX),
      layoutWidth: String(breakLayout.width),
    };
  }

  function getBreakTargetDisplay() {
    return screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  }

  function getBreakWindowBounds(testMode) {
    if (testMode) {
      return {
        width: 1100,
        height: 700,
      };
    }

    const display = getBreakTargetDisplay();
    return getBreakWindowBoundsForDisplay(display, process.platform);
  }

  function getBreakLayoutMetrics() {
    const target = getBreakWindowBounds(false);
    return {
      originX: 0,
      originY: 0,
      width: target.width,
      height: target.height,
      centerX: target.width / 2,
    };
  }

  function syncBreakWindowBounds(win) {
    if (!win || win.isDestroyed()) {
      return false;
    }

    const target = getBreakWindowBounds(false);
    win.setResizable(false);
    win.setBounds(target);

    const actual = win.getBounds();
    if (actual.x !== target.x || actual.y !== target.y) {
      win.setPosition(target.x, target.y);
    }
    if (actual.width !== target.width || actual.height !== target.height) {
      win.setSize(target.width, target.height);
    }

    const aligned = win.getBounds();
    return aligned.x === target.x && aligned.width === target.width;
  }

  function enforceBreakWindowBounds(win, attempt = 0) {
    if (!win || win.isDestroyed() || attempt > 40) {
      return;
    }

    const aligned = syncBreakWindowBounds(win);
    if (!aligned || attempt < 4) {
      setTimeout(() => enforceBreakWindowBounds(win, attempt + 1), 80);
    }
  }

  function isBreakAutomationTestMode() {
    return Boolean(
      env.BREAK_NEKO_BUTTON_TEST ||
      env.BREAK_NEKO_VISUAL_TEST ||
      env.BREAK_NEKO_LAYOUT_DIAG
    );
  }

  function collectBreakLayoutMetricsScript() {
    return `(() => {
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      const centerX = viewport.width / 2;
      function measure(selector) {
        const el = document.querySelector(selector);
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        const center = rect.left + rect.width / 2;
        return {
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          top: Math.round(rect.top),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          centerX: Math.round(center),
          deltaFromViewportCenter: Math.round(center - centerX),
          deltaFromViewportLeftPct: Number(((rect.left / viewport.width) * 100).toFixed(2)),
          centerPct: Number(((center / viewport.width) * 100).toFixed(2)),
        };
      }
      const catMedia = document.querySelector('#customCatVideo.is-visible, #customCatImage.is-visible, #catRun:not(.is-hidden), #catSleep.sleeping');
      let catMediaRect = null;
      if (catMedia) {
        const rect = catMedia.getBoundingClientRect();
        const center = rect.left + rect.width / 2;
        catMediaRect = {
          id: catMedia.id,
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          centerX: Math.round(center),
          deltaFromViewportCenter: Math.round(center - centerX),
          centerPct: Number(((center / viewport.width) * 100).toFixed(2)),
        };
      }
      return {
        viewport,
        devicePixelRatio: window.devicePixelRatio,
        catCenterOffset: getComputedStyle(document.documentElement).getPropertyValue('--cat-center-offset').trim(),
        hud: measure('.break-hud'),
        actions: measure('.break-actions'),
        catLayer: measure('.break-cat-layer'),
        catMedia: catMediaRect,
        hasCustomCat: Boolean(document.querySelector('#customCatVideo.is-visible, #customCatImage.is-visible')),
      };
    })()`;
  }

  async function injectBreakLayoutGuides(win) {
    await win.webContents.executeJavaScript(`(() => {
      if (document.getElementById('layout-diag-style')) return;
      const style = document.createElement('style');
      style.id = 'layout-diag-style';
      style.textContent = [
        '#layout-diag-vcenter { position: fixed; left: 50%; top: 0; bottom: 0; width: 3px; background: rgba(255, 40, 120, 0.95); z-index: 99999; pointer-events: none; transform: translateX(-50%); }',
        '#layout-diag-left { position: fixed; left: 0; top: 0; bottom: 0; width: 3px; background: rgba(40, 255, 120, 0.95); z-index: 99999; pointer-events: none; }',
        '#layout-diag-hud-anchor { position: fixed; left: max(20px, env(safe-area-inset-left, 0px)); top: max(24px, env(safe-area-inset-top, 0px)); width: 10px; height: 10px; background: #ffe600; z-index: 99999; border-radius: 50%; pointer-events: none; box-shadow: 0 0 0 2px rgba(0,0,0,0.5); }',
      ].join('');
      document.head.appendChild(style);
      for (const id of ['layout-diag-vcenter', 'layout-diag-left', 'layout-diag-hud-anchor']) {
        const marker = document.createElement('motion');
        marker.id = id;
        document.body.appendChild(marker);
      }
    })()`.replaceAll('motion', 'div'));
  }

  async function captureBreakLayoutSample(label, outputDir) {
    if (!breakWindow || breakWindow.isDestroyed()) {
      return null;
    }

    await injectBreakLayoutGuides(breakWindow);
    const metrics = await breakWindow.webContents.executeJavaScript(collectBreakLayoutMetricsScript());
    const cursorPoint = screen.getCursorScreenPoint();
    const display = getBreakTargetDisplay();
    const settings = getSettings();
    const report = {
      label,
      timestamp: new Date().toISOString(),
      cursorPoint,
      allDisplays: screen.getAllDisplays().map((item) => ({
        id: item.id,
        bounds: item.bounds,
        workArea: item.workArea,
      })),
      metrics,
      window: {
        bounds: breakWindow.getBounds(),
        contentBounds: breakWindow.getContentBounds(),
        contentSize: breakWindow.getContentSize(),
      },
      display: {
        id: display.id,
        bounds: display.bounds,
        workArea: display.workArea,
        scaleFactor: display.scaleFactor,
      },
      settings: {
        hasCustomCat: Boolean(settings.customCat),
        catSizeMode: settings.catDisplay?.sizeMode,
        customCatOffsetX: settings.customCat?.offsetX ?? 0,
        customCatOffsetY: settings.customCat?.offsetY ?? 0,
      },
    };

    const insetX = report.window.contentBounds.x - report.window.bounds.x;
    const insetY = report.window.contentBounds.y - report.window.bounds.y;
    report.window.contentInset = { x: insetX, y: insetY };
    report.window.boundsMatchDisplay =
      report.window.bounds.x === report.display.bounds.x &&
      report.window.bounds.y === report.display.bounds.y &&
      report.window.bounds.width === report.display.bounds.width &&
      report.window.bounds.height === report.display.bounds.height;

    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(path.join(outputDir, `${label}.json`), `${JSON.stringify(report, null, 2)}\n`);
    const image = await breakWindow.webContents.capturePage();
    fs.writeFileSync(path.join(outputDir, `${label}.png`), image.toPNG());
    console.log(`[layout-diag] ${label}`, JSON.stringify(metrics));
    return report;
  }

  function consumeResumeTimerAfterBreak() {
    const shouldResume = resumeTimerAfterBreak;
    resumeTimerAfterBreak = false;
    return shouldResume;
  }

  function closeBreakWindow() {
    if (breakWindow && !breakWindow.isDestroyed()) {
      isClosingBreakWindow = true;
      breakWindow.close();
    }
  }

  function requestSkipBreak() {
    if (skipRequested) return;
    skipRequested = true;
    onSkipBreak();
  }

  return {
    captureBreakLayoutSample,
    closeBreakWindow,
    consumeResumeTimerAfterBreak,
    getBreakMousePassthroughAllowed: () => breakMousePassthroughAllowed,
    getBreakWindow: () => breakWindow,
    showBreakWindow,
  };
}

function getBreakWindowBoundsForDisplay(display, platform = process.platform) {
  const { bounds, workArea } = display;
  // On macOS, Stage Manager / menu bar shrink the usable work area. Using full
  // display bounds leaves the window centered in the remaining strip, which
  // makes the whole overlay look shifted right. On Windows, workArea avoids
  // covering the taskbar and keeps HUD controls reachable.
  if (platform === 'darwin' || platform === 'win32') {
    return {
      x: Math.round(workArea.x),
      y: Math.round(workArea.y),
      width: Math.round(workArea.width),
      height: Math.round(workArea.height),
    };
  }

  return {
    x: Math.round(bounds.x),
    y: Math.round(bounds.y),
    width: Math.round(bounds.width),
    height: Math.round(bounds.height),
  };
}

function canUseBreakMousePassthrough({
  presentation,
  testMode,
  platform = process.platform,
  automationTestMode = false,
}) {
  return presentation === 'overlay' &&
    !testMode &&
    !automationTestMode &&
    platform === 'darwin';
}

function isBreakSkipShortcut(input = {}) {
  const key = String(input.key || '').toLowerCase();
  return key === 'escape' ||
    (key === 'f4' && input.alt) ||
    (key === 'w' && (input.meta || input.control)) ||
    (key === 'q' && (input.meta || input.control));
}

module.exports = {
  canUseBreakMousePassthrough,
  createBreakWindowController,
  getBreakWindowBoundsForDisplay,
  isBreakSkipShortcut,
};
