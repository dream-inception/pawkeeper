const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('breakNeko', {
  getAppInfo: () => ipcRenderer.invoke('app:get-info'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  getTimerState: () => ipcRenderer.invoke('timer:get-state'),
  startTimer: (mode) => ipcRenderer.invoke('timer:start', mode),
  pauseTimer: () => ipcRenderer.invoke('timer:pause'),
  resetTimer: (mode) => ipcRenderer.invoke('timer:reset', mode),
  triggerBreakNow: () => ipcRenderer.invoke('break:trigger-now'),
  finishBreak: () => ipcRenderer.invoke('break:finish'),
  setBreakMousePassthrough: (enabled) => ipcRenderer.invoke('break:set-mouse-passthrough', enabled),
  snoozeReminder: (minutes) => ipcRenderer.invoke('reminder:snooze', minutes),
  setDnd: (minutes) => ipcRenderer.invoke('dnd:set', minutes),
  completeTask: (taskId) => ipcRenderer.invoke('task:complete', taskId),
  chooseCustomCat: () => ipcRenderer.invoke('cat:choose'),
  clearCustomCat: () => ipcRenderer.invoke('cat:clear'),
  completeOnboarding: () => ipcRenderer.invoke('onboarding:complete'),
  onTimerState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('timer:state', listener);
    return () => ipcRenderer.removeListener('timer:state', listener);
  },
});
