const assert = require('node:assert/strict');
const test = require('node:test');

const TimerService = require('../src/main/timer-service');
const { normalizeDesktopSettings } = require('../src/main/settings');

function createService(settingsOverrides = {}) {
  const settings = normalizeDesktopSettings({
    catEnabled: true,
    reminders: {
      sedentary: { enabled: false },
      hydration: { enabled: false },
      pomodoro: { enabled: false },
    },
    ...settingsOverrides,
  });
  const reminders = [];
  const ticks = [];
  const service = new TimerService({
    getSettings: () => settings,
    powerMonitor: null,
    onTick: (state) => ticks.push(state),
    onReminderDue: (reminder) => reminders.push(reminder),
  });

  return { reminders, service, settings, ticks };
}

test('start and pause update running state', () => {
  const { service, ticks } = createService();

  service.start();
  assert.equal(service.getState().running, true);
  assert.equal(ticks.at(-1).running, true);

  service.pause();
  assert.equal(service.getState().running, false);
  assert.equal(service.interval, null);
});

test('manual reminder becomes active immediately', () => {
  const { reminders, service } = createService();

  service.triggerManualReminder();

  assert.equal(reminders.length, 1);
  assert.equal(reminders[0].type, 'manual');
  assert.equal(service.getState().activeReminder.type, 'manual');
});

test('queue sorts reminders by due time and priority', () => {
  const { service } = createService();
  service.state.activeReminder = { id: 'active', type: 'manual', dueAt: 1 };

  service.enqueueReminder({
    id: 'task:1',
    type: 'task',
    title: 'Task',
    message: 'Task',
    dueAt: 100,
  });
  service.enqueueReminder({
    id: 'pomodoro:1',
    type: 'pomodoro',
    title: 'Pomodoro',
    message: 'Pomodoro',
    dueAt: 100,
  });

  assert.deepEqual(service.getState().queue.map((item) => item.type), ['pomodoro', 'task']);
});

test('due task reminder is emitted once', () => {
  const { reminders, service, settings } = createService({
    tasks: [
      { id: 'task-1', title: 'Stretch', remindAt: '2000-01-01T09:00', done: false },
    ],
  });

  service.tickTasks(settings);
  service.tickTasks(settings);

  assert.equal(reminders.length, 1);
  assert.equal(reminders[0].type, 'task');
  assert.equal(reminders[0].taskId, 'task-1');
  assert.equal(service.getState().activeReminder.type, 'task');
});

test('active reminder keeps countdowns moving without firing additional reminders', () => {
  const { reminders, service, settings } = createService({
    reminders: {
      sedentary: { enabled: false },
      hydration: { enabled: true, intervalMinutes: 5 },
      pomodoro: { enabled: true, focusMinutes: 5, breakMinutes: 5 },
    },
  });
  service.reconcileSettings(settings);
  service.state.running = true;
  service.state.activeReminder = { id: 'manual:1', type: 'manual', dueAt: Date.now() };
  service.state.hydrationRemainingSeconds = 1;
  service.state.pomodoroRemainingSeconds = 1;

  service.tick();

  assert.equal(reminders.length, 0);
  assert.equal(service.getState().hydrationRemainingSeconds, 0);
  assert.equal(service.getState().pomodoroRemainingSeconds, 0);
  assert.equal(service.getState().pomodoroPhase, 'focus');
});

test('one due reminder is presented per tick', () => {
  const { reminders, service, settings } = createService({
    reminders: {
      sedentary: { enabled: false },
      hydration: { enabled: true, intervalMinutes: 5 },
      pomodoro: { enabled: true, focusMinutes: 5, breakMinutes: 5 },
    },
  });
  service.reconcileSettings(settings);
  service.state.running = true;
  service.state.hydrationRemainingSeconds = 1;
  service.state.pomodoroRemainingSeconds = 1;

  service.tick();

  assert.equal(reminders.length, 1);
  assert.equal(service.getState().activeReminder.type, 'hydration');
  assert.equal(service.getState().queue.length, 0);
  assert.equal(service.getState().pomodoroRemainingSeconds, 1);
});

test('future queued reminder does not block normal countdowns', () => {
  const { reminders, service, settings } = createService({
    reminders: {
      sedentary: { enabled: false },
      hydration: { enabled: true, intervalMinutes: 5 },
      pomodoro: { enabled: false },
    },
  });
  service.reconcileSettings(settings);
  service.state.running = true;
  service.state.hydrationRemainingSeconds = 2;
  service.state.queue.push({
    id: 'hydration:later',
    type: 'hydration',
    title: 'Water later',
    message: 'Later',
    dueAt: Date.now() + 60 * 1000,
    priority: 30,
  });

  service.tick();

  assert.equal(reminders.length, 0);
  assert.equal(service.getState().hydrationRemainingSeconds, 1);
  assert.equal(service.getState().queue.length, 1);
});

test('due queued reminder is presented before timers advance', () => {
  const { reminders, service, settings } = createService({
    reminders: {
      sedentary: { enabled: false },
      hydration: { enabled: true, intervalMinutes: 5 },
      pomodoro: { enabled: false },
    },
  });
  service.reconcileSettings(settings);
  service.state.running = true;
  service.state.hydrationRemainingSeconds = 1;
  service.state.queue.push({
    id: 'task:1',
    type: 'task',
    title: 'Stretch',
    message: 'Due',
    taskId: '1',
    dueAt: Date.now() - 1000,
    priority: 60,
  });

  service.tick();

  assert.equal(reminders.length, 1);
  assert.equal(reminders[0].type, 'task');
  assert.equal(service.getState().hydrationRemainingSeconds, 1);
});

test('coalesces repeated timer reminders but keeps distinct task reminders', () => {
  const { reminders, service, settings } = createService({
    tasks: [
      { id: 'task-1', title: 'Stretch', remindAt: '2000-01-01T09:00', done: false },
      { id: 'task-2', title: 'Water plant', remindAt: '2000-01-01T09:05', done: false },
    ],
  });

  service.state.activeReminder = { id: 'hydration:1', type: 'hydration', dueAt: Date.now() };
  service.enqueueReminder({
    id: 'hydration:2',
    type: 'hydration',
    title: 'Water',
    message: 'Drink',
    dueAt: Date.now(),
  });
  assert.equal(service.getState().queue.length, 0);

  service.state.activeReminder = null;
  service.tickTasks(settings);
  assert.equal(reminders.length, 1);
  assert.equal(reminders[0].taskId, 'task-1');
  service.completeActiveReminder();
  service.tickTasks(settings);
  assert.equal(reminders.length, 2);
  assert.equal(reminders[1].taskId, 'task-2');
});

test('primary countdown reports the nearest reminder progress', () => {
  const { service, settings } = createService({
    reminders: {
      sedentary: { enabled: false },
      hydration: { enabled: true, intervalMinutes: 5 },
      pomodoro: { enabled: true, focusMinutes: 25, breakMinutes: 5 },
    },
  });
  service.reconcileSettings(settings);
  service.state.hydrationRemainingSeconds = 60;
  service.state.pomodoroRemainingSeconds = 25 * 60;

  const countdown = service.getState().primaryCountdown;

  assert.equal(countdown.type, 'hydration');
  assert.equal(countdown.remainingSeconds, 60);
  assert.equal(countdown.totalSeconds, 5 * 60);
  assert.ok(countdown.progress > 0.7);
});

test('dnd suppresses ticking reminders without pausing timer', () => {
  const { reminders, service } = createService({
    dndUntil: new Date(Date.now() + 60 * 1000).toISOString(),
    reminders: {
      sedentary: { enabled: true, intervalMinutes: 5, idleThresholdMinutes: 1 },
      hydration: { enabled: true, intervalMinutes: 5 },
      pomodoro: { enabled: true, focusMinutes: 5, breakMinutes: 5 },
    },
    tasks: [
      { id: 'task-1', title: 'Stretch', remindAt: '2000-01-01T09:00', done: false },
    ],
  });
  service.state.running = true;

  service.tick();

  assert.equal(service.getState().running, true);
  assert.equal(reminders.length, 0);
});

test('onDndEnded fires when dnd transitions from active to inactive', () => {
  let dndEndedCount = 0;
  const dndUntil = new Date(Date.now() + 500).toISOString();
  const settings = normalizeDesktopSettings({
    catEnabled: true,
    dndUntil,
    reminders: {
      sedentary: { enabled: false },
      hydration: { enabled: false },
      pomodoro: { enabled: false },
    },
  });

  const service = new TimerService({
    getSettings: () => settings,
    powerMonitor: null,
    onTick: () => {},
    onReminderDue: () => {},
    onDndEnded: () => { dndEndedCount += 1; },
  });
  service.state.running = true;

  // First tick: DnD is active
  service.tick();
  assert.equal(dndEndedCount, 0);

  // Expire DnD
  settings.dndUntil = new Date(Date.now() - 1000).toISOString();

  // Second tick: DnD just ended
  service.tick();
  assert.equal(dndEndedCount, 1);

  // Third tick: DnD still inactive, callback should NOT fire again
  service.tick();
  assert.equal(dndEndedCount, 1);
});
