const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('breakNeko', {
  getAppInfo: () => ipcRenderer.invoke('app:get-info'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  getTimerState: () => ipcRenderer.invoke('timer:get-state'),
  startTimer: (mode) => ipcRenderer.invoke('timer:start', mode),
  pauseTimer: () => ipcRenderer.invoke('timer:pause'),
  resetTimer: (mode) => ipcRenderer.invoke('timer:reset', mode),
  triggerBreakNow: (intensity) => ipcRenderer.invoke('break:trigger-now', intensity),
  finishBreak: () => ipcRenderer.invoke('break:finish'),
  setBreakMousePassthrough: (enabled) => ipcRenderer.invoke('break:set-mouse-passthrough', enabled),
  snoozeReminder: (minutes) => ipcRenderer.invoke('reminder:snooze', minutes),
  setDnd: (minutes) => ipcRenderer.invoke('dnd:set', minutes),
  completeTask: (taskId) => ipcRenderer.invoke('task:complete', taskId),
  chooseCustomCat: () => ipcRenderer.invoke('cat:choose'),
  clearCustomCat: () => ipcRenderer.invoke('cat:clear'),
  importCodexPet: () => ipcRenderer.invoke('codex-pet:import'),
  selectCodexPet: (petId) => ipcRenderer.invoke('codex-pet:select', petId),
  deleteCodexPet: (petId) => ipcRenderer.invoke('codex-pet:delete', petId),
  beginPetDrag: () => ipcRenderer.invoke('pet:drag-start'),
  movePetBy: (delta) => ipcRenderer.invoke('pet:drag-move', delta),
  finishPetDrag: () => ipcRenderer.invoke('pet:drag-end'),
  getPetRuntimeState: () => ipcRenderer.invoke('pet:get-runtime-state'),
  getPetMcpStatus: () => ipcRenderer.invoke('pet:get-mcp-status'),
  rotatePetMcpToken: () => ipcRenderer.invoke('pet:rotate-mcp-token'),
  testPetInteraction: () => ipcRenderer.invoke('pet:test-interaction'),
  completeOnboarding: () => ipcRenderer.invoke('onboarding:complete'),
  onPetControl: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('pet:control', listener);
    return () => ipcRenderer.removeListener('pet:control', listener);
  },
  onPetCursor: (callback) => {
    const listener = (_event, cursor) => callback(cursor);
    ipcRenderer.on('pet:cursor', listener);
    return () => ipcRenderer.removeListener('pet:cursor', listener);
  },
  onTimerState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('timer:state', listener);
    return () => ipcRenderer.removeListener('timer:state', listener);
  },
});
