const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const CODEX_ATLAS_WIDTH = 1536;
const CODEX_ATLAS_HEIGHT = 1872;
const CODEX_ATLAS_COLUMNS = 8;
const CODEX_ATLAS_ROWS = 9;
const CODEX_CELL_WIDTH = 192;
const CODEX_CELL_HEIGHT = 208;
const MIN_CODEX_SPRITESHEET_SIZE = 256;

function createCodexPetLibrary({
  app,
  dialog,
  getMainWindow,
  getSettings,
  saveSettings,
}) {
  async function importCodexPet() {
    const result = await dialog.showOpenDialog(getMainWindow(), {
      title: 'Import Codex pet',
      properties: ['openFile'],
      filters: [
        { name: 'Codex pet manifest', extensions: ['json'] },
      ],
    });

    if (result.canceled || !result.filePaths[0]) {
      return getSettings();
    }

    const settings = getSettings();
    const nextCodexPets = importCodexPetPackage({
      sourcePetJsonPath: result.filePaths[0],
      userDataPath: app.getPath('userData'),
      currentCodexPets: settings.codexPets,
    });

    return saveSettings({
      ...settings,
      codexPets: nextCodexPets,
    });
  }

  function selectCodexPet(petId) {
    const settings = getSettings();
    const nextCodexPets = selectCodexPetInLibrary(settings.codexPets, petId);
    return saveSettings({
      ...settings,
      codexPets: nextCodexPets,
    });
  }

  function deleteCodexPet(petId) {
    const settings = getSettings();
    const { codexPets, deletedItem } = deleteCodexPetFromLibrary(settings.codexPets, petId);

    if (deletedItem) {
      removeImportedPetFiles(app.getPath('userData'), deletedItem);
    }

    return saveSettings({
      ...settings,
      codexPets,
    });
  }

  return {
    deleteCodexPet,
    importCodexPet,
    selectCodexPet,
  };
}

function importCodexPetPackage({
  sourcePetJsonPath,
  userDataPath,
  currentCodexPets = {},
  now = new Date(),
}) {
  const sourceJson = readPetManifest(sourcePetJsonPath);
  const sourceDir = path.dirname(sourcePetJsonPath);
  const id = getPetId(sourceJson, sourceDir);
  const displayName = String(sourceJson.displayName || sourceJson.name || id).trim().slice(0, 80) || id;
  const description = String(sourceJson.description || '').trim().slice(0, 240);
  const sourceSpritesheetPath = resolveSpritesheetPath(sourceJson, sourceDir);
  const dimensions = readWebpDimensions(fs.readFileSync(sourceSpritesheetPath));

  if (
    dimensions.width < MIN_CODEX_SPRITESHEET_SIZE ||
    dimensions.height < MIN_CODEX_SPRITESHEET_SIZE
  ) {
    throw new Error(
      `Codex spritesheet must be at least ${MIN_CODEX_SPRITESHEET_SIZE}x${MIN_CODEX_SPRITESHEET_SIZE}; got ${dimensions.width}x${dimensions.height}.`
    );
  }
  if (dimensions.width % CODEX_ATLAS_COLUMNS !== 0 || dimensions.height % CODEX_ATLAS_ROWS !== 0) {
    throw new Error(
      `Codex spritesheet must divide cleanly into ${CODEX_ATLAS_COLUMNS} columns and ${CODEX_ATLAS_ROWS} rows; got ${dimensions.width}x${dimensions.height}.`
    );
  }

  const targetDir = path.join(userDataPath, 'codex-pets', getSafePetFolderName(id));
  const targetPetJsonPath = path.join(targetDir, 'pet.json');
  const targetSpritesheetPath = path.join(targetDir, 'spritesheet.webp');
  fs.mkdirSync(targetDir, { recursive: true });
  fs.copyFileSync(sourceSpritesheetPath, targetSpritesheetPath);
  fs.writeFileSync(
    targetPetJsonPath,
    `${JSON.stringify({
      ...sourceJson,
      id,
      displayName,
      description,
      spritesheetPath: 'spritesheet.webp',
    }, null, 2)}\n`
  );

  const importedItem = {
    id,
    displayName,
    description,
    petJsonPath: targetPetJsonPath,
    spritesheetPath: targetSpritesheetPath,
    importedAt: now.toISOString(),
  };
  const existingItems = Array.isArray(currentCodexPets.items) ? currentCodexPets.items : [];
  const items = [
    importedItem,
    ...existingItems.filter((item) => item?.id !== id),
  ];

  return {
    activeId: id,
    items,
  };
}

function selectCodexPetInLibrary(codexPets = {}, petId) {
  const items = Array.isArray(codexPets.items) ? codexPets.items : [];
  const activeId = items.some((item) => item?.id === petId) ? petId : null;

  if (petId && !activeId) {
    throw new Error('The selected Codex pet is no longer available.');
  }

  return {
    activeId,
    items,
  };
}

function deleteCodexPetFromLibrary(codexPets = {}, petId) {
  const items = Array.isArray(codexPets.items) ? codexPets.items : [];
  const deletedItem = items.find((item) => item?.id === petId) || null;
  const remainingItems = items.filter((item) => item?.id !== petId);
  const activeId = codexPets.activeId === petId
    ? remainingItems[0]?.id || null
    : (codexPets.activeId || null);

  return {
    codexPets: {
      activeId,
      items: remainingItems,
    },
    deletedItem,
  };
}

function removeImportedPetFiles(userDataPath, item) {
  const petsRoot = path.join(userDataPath, 'codex-pets');
  const targetDir = path.dirname(item.petJsonPath || '');

  if (!isPathInside(petsRoot, targetDir)) {
    return;
  }

  try {
    fs.rmSync(targetDir, { recursive: true, force: true });
  } catch (_error) {
    // The library state is the source of truth; stale files can be cleaned later.
  }
}

function readPetManifest(sourcePetJsonPath) {
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(sourcePetJsonPath, 'utf8'));
  } catch (error) {
    throw new Error(`Could not read Codex pet JSON: ${error.message}`);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Codex pet JSON must be an object.');
  }

  return parsed;
}

function getPetId(manifest, sourceDir) {
  const id = String(manifest.id || manifest.displayName || manifest.name || path.basename(sourceDir)).trim();
  if (!id) {
    throw new Error('Codex pet JSON needs an id or displayName.');
  }
  return id.slice(0, 100);
}

function resolveSpritesheetPath(manifest, sourceDir) {
  const rawSpritesheetPath = manifest.spritesheetPath
    || manifest.spriteSheetPath
    || manifest.spritesheet
    || 'spritesheet.webp';
  if (typeof rawSpritesheetPath !== 'string' || !rawSpritesheetPath.trim()) {
    throw new Error('Codex pet JSON needs a spritesheetPath string.');
  }
  const normalizedSpritesheetPath = rawSpritesheetPath.trim();
  const spritesheetPath = path.isAbsolute(normalizedSpritesheetPath)
    ? normalizedSpritesheetPath
    : path.resolve(sourceDir, normalizedSpritesheetPath);

  if (path.extname(spritesheetPath).toLowerCase() !== '.webp') {
    throw new Error('Codex pet spritesheet must be a .webp file.');
  }

  if (!fs.existsSync(spritesheetPath)) {
    throw new Error(`Could not find Codex spritesheet: ${path.basename(spritesheetPath)}.`);
  }

  return spritesheetPath;
}

function readWebpDimensions(buffer) {
  if (
    buffer.length < 30 ||
    buffer.toString('ascii', 0, 4) !== 'RIFF' ||
    buffer.toString('ascii', 8, 12) !== 'WEBP'
  ) {
    throw new Error('Spritesheet is not a valid WebP file.');
  }

  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkType = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const payloadOffset = offset + 8;

    if (payloadOffset + chunkSize > buffer.length) {
      throw new Error('Spritesheet WebP file is truncated.');
    }

    if (chunkType === 'VP8X' && chunkSize >= 10) {
      return {
        width: 1 + readUInt24LE(buffer, payloadOffset + 4),
        height: 1 + readUInt24LE(buffer, payloadOffset + 7),
      };
    }

    if (chunkType === 'VP8L' && chunkSize >= 5 && buffer[payloadOffset] === 0x2f) {
      const b1 = buffer[payloadOffset + 1];
      const b2 = buffer[payloadOffset + 2];
      const b3 = buffer[payloadOffset + 3];
      const b4 = buffer[payloadOffset + 4];
      return {
        width: 1 + (((b2 & 0x3f) << 8) | b1),
        height: 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6)),
      };
    }

    if (chunkType === 'VP8 ' && chunkSize >= 10) {
      return {
        width: buffer.readUInt16LE(payloadOffset + 6) & 0x3fff,
        height: buffer.readUInt16LE(payloadOffset + 8) & 0x3fff,
      };
    }

    offset = payloadOffset + chunkSize + (chunkSize % 2);
  }

  throw new Error('Could not read spritesheet WebP dimensions.');
}

function readUInt24LE(buffer, offset) {
  return buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
}

function getSafePetFolderName(id) {
  const slug = id
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50) || 'pet';
  const hash = crypto.createHash('sha1').update(id).digest('hex').slice(0, 8);
  return `${slug}-${hash}`;
}

function isPathInside(parentPath, childPath) {
  const relativePath = path.relative(parentPath, childPath);
  return Boolean(relativePath) && !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
}

module.exports = {
  CODEX_ATLAS_HEIGHT,
  CODEX_ATLAS_COLUMNS,
  CODEX_ATLAS_ROWS,
  CODEX_ATLAS_WIDTH,
  CODEX_CELL_HEIGHT,
  CODEX_CELL_WIDTH,
  createCodexPetLibrary,
  deleteCodexPetFromLibrary,
  getSafePetFolderName,
  importCodexPetPackage,
  readWebpDimensions,
  selectCodexPetInLibrary,
};
