const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const SRC_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

function getAssetPath(...segments) {
  return path.join(ROOT_DIR, 'assets', ...segments);
}

function getSourcePath(...segments) {
  return path.join(SRC_DIR, ...segments);
}

function getDistPath(...segments) {
  return path.join(DIST_DIR, ...segments);
}

function getUnpackedAssetPath(app, ...segments) {
  const assetPath = getAssetPath(...segments);
  return app.isPackaged
    ? assetPath.replace(`${path.sep}app.asar${path.sep}`, `${path.sep}app.asar.unpacked${path.sep}`)
    : assetPath;
}

function toFileUrl(filePath) {
  return pathToFileURL(filePath).toString();
}

module.exports = {
  DIST_DIR,
  ROOT_DIR,
  SRC_DIR,
  getAssetPath,
  getDistPath,
  getSourcePath,
  getUnpackedAssetPath,
  toFileUrl,
};
