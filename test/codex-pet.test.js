const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  CODEX_ATLAS_HEIGHT,
  CODEX_ATLAS_WIDTH,
  deleteCodexPetFromLibrary,
  importCodexPetPackage,
  readWebpDimensions,
  selectCodexPetInLibrary,
} = require('../src/main/codex-pet');

function createFakeWebp(width, height) {
  const payload = Buffer.alloc(10);
  payload[0] = 0;
  payload.writeUIntLE(width - 1, 4, 3);
  payload.writeUIntLE(height - 1, 7, 3);

  const riffHeader = Buffer.alloc(12);
  riffHeader.write('RIFF', 0, 'ascii');
  riffHeader.writeUInt32LE(4 + 8 + payload.length, 4);
  riffHeader.write('WEBP', 8, 'ascii');

  const chunkHeader = Buffer.alloc(8);
  chunkHeader.write('VP8X', 0, 'ascii');
  chunkHeader.writeUInt32LE(payload.length, 4);

  return Buffer.concat([riffHeader, chunkHeader, payload]);
}

function createTempPetPackage({
  id = 'stacky',
  displayName = 'Stacky',
  description = 'A balanced helper',
  width = CODEX_ATLAS_WIDTH,
  height = CODEX_ATLAS_HEIGHT,
} = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'break-neko-codex-pet-'));
  const sourceDir = path.join(root, 'source');
  const userDataPath = path.join(root, 'profile');
  fs.mkdirSync(sourceDir, { recursive: true });
  fs.mkdirSync(userDataPath, { recursive: true });
  fs.writeFileSync(path.join(sourceDir, 'spritesheet.webp'), createFakeWebp(width, height));
  fs.writeFileSync(path.join(sourceDir, 'pet.json'), `${JSON.stringify({
    id,
    displayName,
    description,
    spritesheetPath: 'spritesheet.webp',
  })}\n`);

  return {
    root,
    sourcePetJsonPath: path.join(sourceDir, 'pet.json'),
    userDataPath,
  };
}

test('reads VP8X WebP dimensions', () => {
  assert.deepEqual(readWebpDimensions(createFakeWebp(1536, 1872)), {
    width: 1536,
    height: 1872,
  });
});

test('imports Codex pet package and updates duplicates', () => {
  const first = createTempPetPackage({
    id: 'stacky',
    displayName: 'Stacky',
  });
  const imported = importCodexPetPackage({
    sourcePetJsonPath: first.sourcePetJsonPath,
    userDataPath: first.userDataPath,
    currentCodexPets: { activeId: null, items: [] },
    now: new Date('2026-05-19T10:00:00.000Z'),
  });

  assert.equal(imported.activeId, 'stacky');
  assert.equal(imported.items.length, 1);
  assert.equal(imported.items[0].displayName, 'Stacky');
  assert.ok(fs.existsSync(imported.items[0].petJsonPath));
  assert.ok(fs.existsSync(imported.items[0].spritesheetPath));

  fs.writeFileSync(first.sourcePetJsonPath, `${JSON.stringify({
    id: 'stacky',
    displayName: 'Stacky Prime',
    description: 'Updated',
    spritesheetPath: 'spritesheet.webp',
  })}\n`);
  const updated = importCodexPetPackage({
    sourcePetJsonPath: first.sourcePetJsonPath,
    userDataPath: first.userDataPath,
    currentCodexPets: imported,
    now: new Date('2026-05-19T11:00:00.000Z'),
  });

  assert.equal(updated.activeId, 'stacky');
  assert.equal(updated.items.length, 1);
  assert.equal(updated.items[0].displayName, 'Stacky Prime');
  assert.equal(updated.items[0].importedAt, '2026-05-19T11:00:00.000Z');
});

test('rejects Codex spritesheets with unexpected dimensions', () => {
  const petPackage = createTempPetPackage({
    width: 128,
    height: 128,
  });

  assert.throws(
    () => importCodexPetPackage({
      sourcePetJsonPath: petPackage.sourcePetJsonPath,
      userDataPath: petPackage.userDataPath,
      currentCodexPets: { activeId: null, items: [] },
    }),
    /at least 256x256/
  );
});

test('imports non-reference Codex spritesheets when grid can be derived', () => {
  const petPackage = createTempPetPackage({
    width: 768,
    height: 936,
  });

  const imported = importCodexPetPackage({
    sourcePetJsonPath: petPackage.sourcePetJsonPath,
    userDataPath: petPackage.userDataPath,
    currentCodexPets: { activeId: null, items: [] },
  });

  assert.equal(imported.items.length, 1);
});

test('selects and deletes Codex pets in library state', () => {
  const library = {
    activeId: 'pet-1',
    items: [
      { id: 'pet-1', petJsonPath: '/tmp/pet-1/pet.json', spritesheetPath: '/tmp/pet-1/spritesheet.webp' },
      { id: 'pet-2', petJsonPath: '/tmp/pet-2/pet.json', spritesheetPath: '/tmp/pet-2/spritesheet.webp' },
    ],
  };

  assert.equal(selectCodexPetInLibrary(library, 'pet-2').activeId, 'pet-2');
  assert.throws(() => selectCodexPetInLibrary(library, 'missing'), /no longer available/);

  const deleted = deleteCodexPetFromLibrary(library, 'pet-1');
  assert.equal(deleted.deletedItem.id, 'pet-1');
  assert.equal(deleted.codexPets.activeId, 'pet-2');
  assert.deepEqual(deleted.codexPets.items.map((item) => item.id), ['pet-2']);
});
