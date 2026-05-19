const { ipcMain } = require('electron');
const shared = require('../shared');

function registerIpcHandlers({
  chooseCustomCat,
  clearCustomCat,
  closeBreakWindow,
  completeOnboarding,
  getBreakWindow,
  getBreakMousePassthroughAllowed,
  getAppInfo,
  getPublicTimerState,
  getSettings,
  getTimerService,
  markTaskDone,
  refreshTrayMenu,
  saveSettings,
  setDndForMinutes,
  snoozeReminder,
}) {
  ipcMain.handle('app:get-info', () => getAppInfo());
  ipcMain.handle('settings:get', () => getSettings());
  ipcMain.handle('settings:save', (_event, settings) => saveSettings(settings));
  ipcMain.handle('timer:get-state', () => getPublicTimerState());
  ipcMain.handle('timer:start', () => {
    getTimerService().start();
    refreshTrayMenu();
    return getPublicTimerState();
  });
  ipcMain.handle('timer:pause', () => {
    getTimerService().pause();
    refreshTrayMenu();
    return getPublicTimerState();
  });
  ipcMain.handle('timer:reset', () => {
    getTimerService().reset();
    return getPublicTimerState();
  });
  ipcMain.handle('break:trigger-now', () => {
    getTimerService().triggerManualReminder();
    return getPublicTimerState();
  });
  ipcMain.handle('break:finish', () => {
    closeBreakWindow();
    return getPublicTimerState();
  });
  ipcMain.handle('break:set-mouse-passthrough', (event, enabled) => {
    const breakWindow = getBreakWindow();
    if (!breakWindow || breakWindow.isDestroyed() || event.sender !== breakWindow.webContents) {
      return false;
    }

    const shouldPassThrough = getBreakMousePassthroughAllowed() && enabled === true;
    breakWindow.setIgnoreMouseEvents(shouldPassThrough, { forward: true });
    return shouldPassThrough;
  });
  ipcMain.handle('reminder:snooze', (_event, minutes) => {
    snoozeReminder(shared.clampNumber(minutes, 1, 120, 5));
    return getPublicTimerState();
  });
  ipcMain.handle('dnd:set', (_event, minutes) => setDndForMinutes(shared.clampNumber(minutes, 5, 1440, 30)));
  ipcMain.handle('task:complete', (_event, taskId) => markTaskDone(taskId));
  ipcMain.handle('cat:choose', () => chooseCustomCat());
  ipcMain.handle('cat:clear', () => clearCustomCat());
  ipcMain.handle('onboarding:complete', () => completeOnboarding());
}

module.exports = {
  registerIpcHandlers,
};
