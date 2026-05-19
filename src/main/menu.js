const { Menu, Tray, nativeImage } = require('electron');

function createMenuController({
  app,
  defaultLanguage,
  getAssetPath,
  getSettings,
  getTimerService,
  setDndForMinutes,
  showMainWindow,
  tMain,
}) {
  let tray = null;

  function createTray() {
    const icon = nativeImage.createFromPath(getAssetPath('break-neko-tray16.png'));
    const trayIcon = icon.resize({ width: 16, height: 16 });
    tray = new Tray(trayIcon);
    tray.setToolTip('Break Neko');
    tray.on('click', showMainWindow);
    refreshTrayMenu();
  }

  function refreshTrayMenu() {
    if (!tray) return;

    const timerService = getTimerService();
    const state = timerService?.getState();
    const settings = getSettings();
    const language = settings.language;
    const contextMenu = Menu.buildFromTemplate([
      {
        label: tMain('openBreakNeko', language),
        click: showMainWindow,
      },
      {
        label: state?.nextReminderAt
          ? tMain('nextReminder', language, new Date(state.nextReminderAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
          : tMain('noRemindersScheduled', language),
        enabled: false,
      },
      { type: 'separator' },
      {
        label: state?.running ? tMain('pauseTimer', language) : tMain('startTimer', language),
        click: () => {
          if (timerService.getState().running) {
            timerService.pause();
          } else {
            timerService.start();
          }
          refreshTrayMenu();
        },
      },
      {
        label: tMain('summonCatNow', language),
        click: () => timerService.triggerManualReminder(),
      },
      {
        label: tMain('pause30', language),
        click: () => setDndForMinutes(30),
      },
      { type: 'separator' },
      {
        label: tMain('quit', language),
        click: () => {
          app.isQuitting = true;
          app.quit();
        },
      },
    ]);

    tray.setContextMenu(contextMenu);
  }

  function createApplicationMenu() {
    const language = getSettings()?.language || defaultLanguage;
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      {
        label: 'Break Neko',
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          {
            label: tMain('openSettings', language),
            accelerator: 'CommandOrControl+,',
            click: showMainWindow,
          },
          { type: 'separator' },
          { role: 'quit' },
        ],
      },
    ]));
  }

  return {
    createApplicationMenu,
    createTray,
    refreshTrayMenu,
  };
}

module.exports = {
  createMenuController,
};
