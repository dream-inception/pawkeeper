const path = require('node:path');
const fs = require('node:fs');

function createCustomCatPicker({
  app,
  dialog,
  getMainWindow,
  getSettings,
  saveSettings,
}) {
  async function chooseCustomCat() {
    const result = await dialog.showOpenDialog(getMainWindow(), {
      title: 'Choose your cat',
      properties: ['openFile'],
      filters: [
        { name: 'Cat media', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'webm', 'mp4'] },
      ],
    });

    if (result.canceled || !result.filePaths[0]) {
      return getSettings();
    }

    const sourcePath = result.filePaths[0];
    const extension = path.extname(sourcePath).toLowerCase();
    const mediaDir = path.join(app.getPath('userData'), 'custom-cat');
    fs.mkdirSync(mediaDir, { recursive: true });
    const targetPath = path.join(mediaDir, `cat${extension}`);
    fs.copyFileSync(sourcePath, targetPath);

    return saveSettings({
      ...getSettings(),
      customCat: {
        path: targetPath,
        kind: ['.webm', '.mp4'].includes(extension) ? 'video' : 'image',
        name: path.basename(sourcePath),
        offsetX: 0,
        offsetY: 0,
      },
    });
  }

  return {
    chooseCustomCat,
  };
}

module.exports = {
  createCustomCatPicker,
};
