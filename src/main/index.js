const path = require('node:path');
const os = require('node:os');
const {
  app,
  BrowserWindow,
  dialog,
  Notification,
  powerMonitor,
  screen,
} = require('electron');
const TimerService = require('./timer-service');
const {
  getAssetPath,
  getDistPath,
  getSourcePath,
  getUnpackedAssetPath,
  toFileUrl,
} = require('./paths');
const {
  DEFAULT_DESKTOP_SETTINGS,
  localizeReminder,
  normalizeDesktopSettings,
  tMain,
} = require('./settings');
const { createAutomationTestRunner } = require('./automation-tests');
const { createBreakWindowController } = require('./break-window');
const { createCustomCatPicker } = require('./custom-cat');
const { registerIpcHandlers } = require('./ipc');
const { createMenuController } = require('./menu');
const { createPetWindowController } = require('./pet-window');
const { createReminderPresenter } = require('./reminders');
const { createStatsTracker } = require('./stats');

let Store;
let store;
let mainWindow;
let timerService;
let statsTracker;
let automationTestRunner;
let breakWindowController;
let customCatPicker;
let menuController;
let petWindowController;
let reminderPresenter;

async function bootstrap() {
  ({ default: Store } = await import('electron-store'));
  app.setName('Break Neko');

  if (process.env.BREAK_NEKO_TEST_PROFILE === '1') {
    app.setPath('userData', path.join(os.tmpdir(), 'break-neko-test-profile'));
  }

  await app.whenReady();
  store = new Store({
    defaults: {
      settings: DEFAULT_DESKTOP_SETTINGS,
      stats: {},
    },
  });
  statsTracker = createStatsTracker(store);
  menuController = createMenuController({
    app,
    defaultLanguage: DEFAULT_DESKTOP_SETTINGS.language,
    getAssetPath,
    getSettings,
    getTimerService: () => timerService,
    setDndForMinutes,
    showMainWindow,
    tMain,
  });
  breakWindowController = createBreakWindowController({
    app,
    BrowserWindow,
    getAssetPath,
    getSettings,
    getSourcePath,
    getTimerService: () => timerService,
    getUnpackedAssetPath,
    onSkipBreak: () => closeBreakWindow('skip'),
    screen,
    tMain,
    toFileUrl,
  });
  customCatPicker = createCustomCatPicker({
    app,
    dialog,
    getMainWindow: () => mainWindow,
    getSettings,
    saveSettings,
  });
  petWindowController = createPetWindowController({
    BrowserWindow,
    getAssetPath,
    getSettings,
    getSourcePath,
    screen,
    toFileUrl,
    updateSettings: (settings) => store.set('settings', normalizeDesktopSettings(settings)),
  });
  reminderPresenter = createReminderPresenter({
    Notification,
    getSettings,
    getTimerService: () => timerService,
    localizeReminder,
    recordReminderAction: (...args) => statsTracker.recordReminderAction(...args),
    refreshTrayMenu,
    showBreakWindow,
  });
  automationTestRunner = createAutomationTestRunner({
    app,
    breakWindowController,
    getDistPath,
    getMainWindow: () => mainWindow,
  });

  if (process.env.BREAK_NEKO_UI_TEST_LANGUAGE) {
    store.set('settings', normalizeDesktopSettings({
      ...getSettings(),
      language: process.env.BREAK_NEKO_UI_TEST_LANGUAGE,
    }));
  }

  if (process.env.BREAK_NEKO_TEST_CAT_SIZE_MODE) {
    store.set('settings', normalizeDesktopSettings({
      ...getSettings(),
      catDisplay: {
        sizeMode: process.env.BREAK_NEKO_TEST_CAT_SIZE_MODE,
        customSize: Number.parseInt(process.env.BREAK_NEKO_TEST_CAT_CUSTOM_SIZE || '50', 10),
      },
    }));
  }

  if (process.env.BREAK_NEKO_TEST_PET === '1') {
    const settings = getSettings();
    store.set('settings', normalizeDesktopSettings({
      ...settings,
      pet: {
        ...settings.pet,
        enabled: true,
      },
    }));
  }

  createApplicationMenu();
  createTray();
  createTimerService();
  registerIpcHandlers({
    chooseCustomCat,
    clearCustomCat,
    closeBreakWindow,
    completeOnboarding,
    getBreakWindow: () => breakWindowController.getBreakWindow(),
    getBreakMousePassthroughAllowed: () => breakWindowController.getBreakMousePassthroughAllowed(),
    getAppInfo: () => ({
      name: app.getName(),
      version: app.getVersion(),
    }),
    getPublicTimerState,
    getSettings,
    getTimerService: () => timerService,
    markTaskDone,
    refreshTrayMenu,
    saveSettings,
    setDndForMinutes,
    snoozeReminder,
  });
  createMainWindow();
  const settings = getSettings();
  updatePetWindow(settings);
  timerService.start();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    } else {
      showMainWindow();
    }
  });

  automationTestRunner.runStartupAutomation();
}

function getSettings() {
  return normalizeDesktopSettings(store.get('settings'));
}

function saveSettings(settings) {
  const normalizedSettings = normalizeDesktopSettings(settings);
  store.set('settings', normalizedSettings);
  timerService?.updateSettings();

  refreshTrayMenu();
  createApplicationMenu();
  updatePetWindow(normalizedSettings);
  return normalizedSettings;
}

function createMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    showMainWindow();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 920,
    height: 720,
    minWidth: 720,
    minHeight: 620,
    title: 'Break Neko',
    backgroundColor: '#1a1a1a',
    icon: getAssetPath('break-neko-icon128.png'),
    webPreferences: {
      preload: getSourcePath('preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(getSourcePath('renderer', 'index.html'));

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

function showMainWindow() {
  mainWindow?.show();
  mainWindow?.focus();
}

function updatePetWindow(settings = getSettings()) {
  petWindowController?.updatePetWindow(settings);
}

function createTimerService() {
  timerService = new TimerService({
    getSettings,
    powerMonitor,
    onTick: broadcastTimerState,
    onReminderDue: (reminder) => presentReminder(reminder),
    onDndEnded: () => {
      const settings = getSettings();
      if (Notification.isSupported()) {
        const notification = new Notification({
          title: tMain('dndEndedTitle', settings.language),
          body: tMain('dndEndedMessage', settings.language),
        });
        notification.show();
      }
      refreshTrayMenu();
    },
  });

  powerMonitor.on('suspend', () => timerService.pause());
  powerMonitor.on('lock-screen', () => timerService.pause());
  powerMonitor.on('resume', () => {
    timerService.start();
  });
  powerMonitor.on('unlock-screen', () => {
    timerService.start();
  });
}

function refreshTrayMenu() {
  menuController?.refreshTrayMenu();
}

function createApplicationMenu() {
  menuController?.createApplicationMenu();
}

function createTray() {
  menuController.createTray();
}

function presentReminder(reminder) {
  reminderPresenter.presentReminder(reminder);
}

function showBreakWindow(options) {
  return breakWindowController.showBreakWindow(options);
}

function clearNotificationRetry(reminderId) {
  reminderPresenter?.clearNotificationRetry(reminderId);
}

function closeBreakWindow(action = 'complete') {
  const activeReminder = timerService?.getState().activeReminder;
  clearNotificationRetry(activeReminder?.id);
  breakWindowController.closeBreakWindow();
  if (action === 'complete' && activeReminder?.taskId) {
    markTaskDone(activeReminder.taskId);
  }
  statsTracker.recordReminderAction(action, activeReminder);
  if (action === 'skip') {
    timerService?.skipActiveReminder();
  } else {
    timerService?.completeActiveReminder();
  }
  if (breakWindowController.consumeResumeTimerAfterBreak()) {
    timerService?.start();
  }
  refreshTrayMenu();
}

function snoozeReminder(minutes) {
  const activeReminder = timerService?.getState().activeReminder;
  clearNotificationRetry(activeReminder?.id);
  breakWindowController.closeBreakWindow();
  statsTracker.recordReminderAction('snooze', activeReminder);
  timerService?.snoozeActiveReminder(minutes);
  if (breakWindowController.consumeResumeTimerAfterBreak()) {
    timerService?.start();
  }
  refreshTrayMenu();
}

function setDndForMinutes(minutes) {
  const settings = getSettings();
  const dndUntil = new Date(Date.now() + minutes * 60 * 1000).toISOString();
  saveSettings({
    ...settings,
    dndUntil,
  });
  refreshTrayMenu();
  return getSettings();
}

function markTaskDone(taskId) {
  const settings = getSettings();
  saveSettings({
    ...settings,
    tasks: settings.tasks.map((task) =>
      task.id === taskId ? { ...task, done: true } : task
    ),
  });
  return getSettings();
}

function clearCustomCat() {
  return saveSettings({ ...getSettings(), customCat: null });
}

function completeOnboarding() {
  return saveSettings({ ...getSettings(), hasCompletedOnboarding: true });
}

async function chooseCustomCat() {
  return customCatPicker.chooseCustomCat();
}

function getPublicTimerState(state = timerService?.getState()) {
  return state
    ? {
      ...state,
      stats: statsTracker.getTodayStats(),
    }
    : null;
}

function broadcastTimerState(state = timerService?.getState()) {
  if (!state) return;
  const publicState = getPublicTimerState(state);
  refreshTrayMenu();

  BrowserWindow.getAllWindows().forEach((window) => {
    window.webContents.send('timer:state', publicState);
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
});

bootstrap().catch((error) => {
  console.error(error);
  app.quit();
});
