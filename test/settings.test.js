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

test('translates main-process labels', () => {
  assert.equal(tMain('pause30', 'zh'), '暂停 30 分钟');
  assert.equal(tMain('snoozeLabel', 'en', 10), 'Snooze 10m');
  assert.equal(tMain('dndEndedTitle', 'en'), 'Quiet time ended');
  assert.equal(tMain('dndEndedTitle', 'zh'), '勿扰时间结束');
});
