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

  function updatePetWindow(settings) {
    if (!settings.pet.enabled) {
      if (petWindow && !petWindow.isDestroyed()) {
        petWindow.close();
      }
      return;
    }

    if (petWindow && !petWindow.isDestroyed()) {
      petWindow.setAlwaysOnTop(settings.pet.alwaysOnTop, 'floating');
      petWindow.setSize(settings.pet.size, settings.pet.size);
      return;
    }

    createPetWindow(settings);
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
    petWindow.loadFile(getSourcePath('pet', 'index.html'), {
      query: {
        language: settings.language,
        icon: toFileUrl(getAssetPath('break-neko-icon128.png')),
      },
    });

    petWindow.on('move', schedulePetPositionSave);
    petWindow.on('closed', () => {
      petWindow = null;
    });
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

  return {
    updatePetWindow,
  };
}

module.exports = {
  createPetWindowController,
};
