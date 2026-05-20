const assert = require('node:assert/strict');
const test = require('node:test');

const shared = require('../src/shared');
const {
  DEFAULT_DESKTOP_SETTINGS,
  normalizeDesktopSettings,
  tMain,
} = require('../src/main/settings');

test('clampNumber returns fallback for invalid input', () => {
  assert.equal(shared.clampNumber('abc', 1, 100, 42), 42);
  assert.equal(shared.clampNumber(null, 1, 100, 42), 42);
  assert.equal(shared.clampNumber(200, 1, 100, 42), 100);
  assert.equal(shared.clampNumber(-5, 1, 100, 42), 1);
  assert.equal(shared.clampNumber(50, 1, 100, 42), 50);
});

test('normalizes base settings with safe defaults', () => {
  const settings = shared.normalizeSettings({
    breakTime: '3',
    catEnabled: false,
  });

  assert.equal(settings.breakTime, 3);
  assert.equal(settings.catEnabled, true);
});

test('builds preview file URLs for POSIX and Windows paths', () => {
  assert.equal(
    shared.toPreviewFileUrl('/tmp/My Cat/cat.png'),
    'file:///tmp/My%20Cat/cat.png'
  );
  assert.equal(
    shared.toPreviewFileUrl('C:\\Users\\Neko Cat\\spritesheet.webp'),
    'file:///C:/Users/Neko%20Cat/spritesheet.webp'
  );
  assert.equal(
    shared.toPreviewFileUrl('\\\\neko-nas\\pets\\cat.png'),
    'file://neko-nas/pets/cat.png'
  );
  assert.equal(
    shared.toPreviewFileUrl('file:///C:/Users/Neko%20Cat/cat.png'),
    'file:///C:/Users/Neko%20Cat/cat.png'
  );
});

test('normalizes desktop settings with safe defaults and legacy cat scale', () => {
  const settings = normalizeDesktopSettings({
    language: 'zh',
    reminderIntensity: 'loud',
    snoozeMinutes: '999',
    customCat: {
      path: '/tmp/my-cat.png',
      kind: 'gif',
      scale: 72,
      offsetX: 100,
      offsetY: -100,
    },
    pet: {
      enabled: true,
      size: 999,
      alwaysOnTop: false,
    },
    reminders: {
      sedentary: {
        intervalMinutes: 1,
        idleThresholdMinutes: 999,
      },
      hydration: {
        enabled: false,
        intervalMinutes: 7,
      },
      pomodoro: {
        enabled: true,
        focusMinutes: 2,
        breakMinutes: 999,
      },
    },
    tasks: [
      { id: 'a', title: '  Ship it  ', remindAt: '2026-05-19T10:00', done: false },
      { title: '   ' },
    ],
  });

  assert.equal(settings.language, 'zh');
  assert.equal(settings.reminderIntensity, DEFAULT_DESKTOP_SETTINGS.reminderIntensity);
  assert.equal(settings.snoozeMinutes, 60);
  assert.equal(settings.customCat.kind, 'image');
  assert.equal(settings.customCat.offsetX, 40);
  assert.equal(settings.customCat.offsetY, -40);
  assert.equal(settings.catDisplay.sizeMode, 'custom');
  assert.equal(settings.catDisplay.customSize, 72);
  assert.equal(settings.pet.size, 220);
  assert.equal(settings.pet.alwaysOnTop, false);
  assert.equal(settings.pet.interactionEnabled, true);
  assert.equal(settings.pet.interactionMode, 'quiet');
  assert.equal(settings.pet.mouseReactivity, 50);
  assert.equal(settings.pet.mcpEnabled, false);
  assert.equal(settings.reminders.sedentary.intervalMinutes, 5);
  assert.equal(settings.reminders.sedentary.idleThresholdMinutes, 60);
  assert.equal(settings.reminders.hydration.enabled, false);
  assert.equal(settings.reminders.hydration.intervalMinutes, 7);
  assert.equal(settings.reminders.pomodoro.focusMinutes, 5);
  assert.equal(settings.reminders.pomodoro.breakMinutes, 60);
  assert.deepEqual(settings.tasks, [
    { id: 'a', title: 'Ship it', remindAt: '2026-05-19T10:00', done: false },
  ]);
});

test('normalizes pet interaction settings', () => {
  const settings = normalizeDesktopSettings({
    pet: {
      interactionEnabled: false,
      interactionMode: 'follow',
      lookAtCursor: false,
      pettingEnabled: false,
      followCursor: true,
      avoidCursor: true,
      mouseReactivity: 999,
      reducedMotion: true,
      mcpEnabled: false,
      mcpLocalDomain: 'Neko.local',
      interactionPausedUntil: '2026-05-19T10:00:00.000Z',
    },
  });

  assert.equal(settings.pet.interactionEnabled, false);
  assert.equal(settings.pet.interactionMode, 'follow');
  assert.equal(settings.pet.lookAtCursor, false);
  assert.equal(settings.pet.pettingEnabled, false);
  assert.equal(settings.pet.followCursor, true);
  assert.equal(settings.pet.avoidCursor, true);
  assert.equal(settings.pet.mouseReactivity, 100);
  assert.equal(settings.pet.reducedMotion, true);
  assert.equal(settings.pet.mcpEnabled, false);
  assert.equal(settings.pet.mcpLanEnabled, false);
  assert.equal(settings.pet.mcpLocalDomain, 'neko.local');
  assert.equal(settings.pet.interactionPausedUntil, '2026-05-19T10:00:00.000Z');
});

test('defaults MCP control to off for new settings', () => {
  const settings = normalizeDesktopSettings({});

  assert.equal(settings.pet.mcpEnabled, false);
  assert.equal(settings.pet.mcpLanEnabled, false);
});

test('normalizes MCP LAN access setting', () => {
  const enabled = normalizeDesktopSettings({
    pet: {
      mcpLanEnabled: true,
    },
  });
  assert.equal(enabled.pet.mcpLanEnabled, true);

  const disabled = normalizeDesktopSettings({
    pet: {
      mcpLanEnabled: 'yes',
    },
  });
  assert.equal(disabled.pet.mcpLanEnabled, false);
});

test('normalizes custom MCP local domains', () => {
  assert.equal(normalizeDesktopSettings({
    pet: { mcpLocalDomain: ' neko.local ' },
  }).pet.mcpLocalDomain, 'neko.local');
  assert.equal(normalizeDesktopSettings({
    pet: { mcpLocalDomain: 'Neko Pet.local' },
  }).pet.mcpLocalDomain, 'neko-pet.local');
  assert.equal(normalizeDesktopSettings({
    pet: { mcpLocalDomain: '../bad.local' },
  }).pet.mcpLocalDomain, 'bad.local');
});

test('normalizes Codex pet library settings', () => {
  const settings = normalizeDesktopSettings({
    codexPets: {
      activeId: 'pet-2',
      items: [
        {
          id: 'pet-1',
          displayName: 'First Pet',
          description: 'A steady helper',
          petJsonPath: '/tmp/pet-1/pet.json',
          spritesheetPath: '/tmp/pet-1/spritesheet.webp',
          importedAt: '2026-05-19T10:00:00.000Z',
        },
        {
          id: 'pet-2',
          displayName: 'Second Pet',
          petJsonPath: '/tmp/pet-2/pet.json',
          spritesheetPath: '/tmp/pet-2/spritesheet.webp',
        },
        {
          id: 'pet-1',
          displayName: 'Duplicate Pet',
          petJsonPath: '/tmp/pet-1b/pet.json',
          spritesheetPath: '/tmp/pet-1b/spritesheet.webp',
        },
        {
          id: '',
          petJsonPath: '/tmp/broken/pet.json',
          spritesheetPath: '/tmp/broken/spritesheet.webp',
        },
      ],
    },
  });

  assert.equal(settings.codexPets.activeId, 'pet-2');
  assert.equal(settings.codexPets.items.length, 2);
  assert.equal(settings.codexPets.items[0].displayName, 'First Pet');
  assert.equal(settings.codexPets.items[1].description, '');
  assert.equal(settings.codexPets.items[1].importedAt, '1970-01-01T00:00:00.000Z');
});

test('clears invalid active Codex pet id', () => {
  const settings = normalizeDesktopSettings({
    codexPets: {
      activeId: 'missing',
      items: [
        {
          id: 'pet-1',
          petJsonPath: '/tmp/pet-1/pet.json',
          spritesheetPath: '/tmp/pet-1/spritesheet.webp',
        },
      ],
    },
  });

  assert.equal(settings.codexPets.activeId, null);
  assert.equal(settings.codexPets.items.length, 1);
});

test('translates main-process labels', () => {
  assert.equal(tMain('pause30', 'zh'), '暂停 30 分钟');
  assert.equal(tMain('snoozeLabel', 'en', 10), 'Snooze 10m');
  assert.equal(tMain('dndEndedTitle', 'en'), 'Quiet time ended');
  assert.equal(tMain('dndEndedTitle', 'zh'), '勿扰时间结束');
});
