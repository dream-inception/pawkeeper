const assert = require('node:assert/strict');
const test = require('node:test');

const { createReminderPresenter } = require('../src/main/reminders');

function createNotificationStub({ supported = true } = {}) {
  const instances = [];

  class StubNotification {
    constructor(options) {
      this.options = options;
      this.handlers = {};
      this.shown = false;
      instances.push(this);
    }

    static isSupported() {
      return supported;
    }

    on(event, handler) {
      this.handlers[event] = handler;
    }

    show() {
      this.shown = true;
    }
  }

  return { instances, Notification: StubNotification };
}

test('manual reminders always use overlay presentation', () => {
  const { Notification } = createNotificationStub();
  const shown = [];
  const presenter = createReminderPresenter({
    Notification,
    getSettings: () => ({ language: 'en', reminderIntensity: 'notification', snoozeMinutes: 5 }),
    getTimerService: () => null,
    localizeReminder: (reminder) => reminder,
    recordReminderAction: () => {},
    refreshTrayMenu: () => {},
    showBreakWindow: (payload) => shown.push(payload),
  });

  presenter.presentReminder({ id: 'manual:1', type: 'manual', title: 'Break', message: 'Pause' });

  assert.equal(shown.length, 1);
  assert.equal(shown[0].presentation, 'overlay');
});

test('unsupported notifications fall back to overlay', () => {
  const { Notification } = createNotificationStub({ supported: false });
  const shown = [];
  const presenter = createReminderPresenter({
    Notification,
    getSettings: () => ({ language: 'en', reminderIntensity: 'notification', snoozeMinutes: 5 }),
    getTimerService: () => null,
    localizeReminder: (reminder) => reminder,
    recordReminderAction: () => {},
    refreshTrayMenu: () => {},
    showBreakWindow: (payload) => shown.push(payload),
  });

  presenter.presentReminder({ id: 'hydration:1', type: 'hydration', title: 'Water', message: 'Drink' });

  assert.equal(shown.length, 1);
  assert.equal(shown[0].presentation, 'overlay');
});

test('notification click opens overlay for the active reminder', () => {
  const { instances, Notification } = createNotificationStub();
  const shown = [];
  const timerService = {
    getState: () => ({ activeReminder: { id: 'hydration:1' } }),
  };
  const presenter = createReminderPresenter({
    Notification,
    getSettings: () => ({ language: 'en', reminderIntensity: 'notification', snoozeMinutes: 5 }),
    getTimerService: () => timerService,
    localizeReminder: (reminder) => ({ ...reminder, title: `Localized ${reminder.title}` }),
    recordReminderAction: () => {},
    refreshTrayMenu: () => {},
    showBreakWindow: (payload) => shown.push(payload),
  });

  presenter.presentReminder({ id: 'hydration:1', type: 'hydration', title: 'Water', message: 'Drink' });
  instances[0].handlers.click();

  assert.equal(instances[0].shown, true);
  assert.equal(shown.length, 1);
  assert.equal(shown[0].presentation, 'overlay');
  assert.equal(shown[0].reminder.title, 'Localized Water');
});

test('unanswered notification defers the active reminder', async () => {
  const { Notification } = createNotificationStub();
  const actions = [];
  const trayRefreshes = [];
  const timerService = {
    getState: () => ({ activeReminder: { id: 'hydration:1', type: 'hydration' } }),
    deferActiveReminder: (minutes) => actions.push(['defer', minutes]),
  };
  const presenter = createReminderPresenter({
    Notification,
    getSettings: () => ({ language: 'en', reminderIntensity: 'notification', snoozeMinutes: 7 }),
    getTimerService: () => timerService,
    localizeReminder: (reminder) => reminder,
    notificationRetryDelayMs: 5,
    recordReminderAction: (action, reminder) => actions.push([action, reminder.id]),
    refreshTrayMenu: () => trayRefreshes.push('refresh'),
    showBreakWindow: () => {},
  });

  presenter.presentReminder({ id: 'hydration:1', type: 'hydration', title: 'Water', message: 'Drink' });
  await new Promise((resolve) => setTimeout(resolve, 20));

  assert.deepEqual(actions, [
    ['defer', 'hydration:1'],
    ['defer', 7],
  ]);
  assert.equal(trayRefreshes.length, 1);
});
