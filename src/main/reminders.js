const NOTIFICATION_RETRY_DELAY_MS = 60 * 1000;
const NOTIFICATION_DEFER_MINUTES = 5;

function createReminderPresenter({
  Notification,
  getSettings,
  getTimerService,
  localizeReminder,
  notificationDeferMinutes = NOTIFICATION_DEFER_MINUTES,
  notificationRetryDelayMs = NOTIFICATION_RETRY_DELAY_MS,
  recordReminderAction,
  refreshTrayMenu,
  showBreakWindow,
}) {
  const notificationRetryTimers = new Map();

  function presentReminder(reminder) {
    const settings = getSettings();
    const localizedReminder = localizeReminder(reminder, settings.language);
    const presentation = getReminderPresentation(reminder, settings);

    if (presentation === 'notification') {
      if (!Notification.isSupported()) {
        showBreakWindow({ reminder: localizedReminder, presentation: 'overlay' });
        return;
      }

      const notification = new Notification({
        title: localizedReminder.title,
        body: localizedReminder.message,
      });
      notification.on('click', () => {
        clearNotificationRetry(reminder.id);
        if (getTimerService()?.getState().activeReminder?.id !== reminder.id) return;
        showBreakWindow({ reminder: localizedReminder, presentation: 'overlay' });
      });
      notification.show();
      scheduleNotificationRetry(reminder.id);
      return;
    }

    showBreakWindow({
      reminder: localizedReminder,
      presentation,
    });
  }

  function getReminderPresentation(reminder, settings) {
    // Manual summon is a direct user action; timed reminder intensity does not apply.
    if (reminder.type === 'manual') {
      return 'overlay';
    }

    return settings.reminderIntensity;
  }

  function scheduleNotificationRetry(reminderId) {
    clearNotificationRetry(reminderId);

    const retryTimer = setTimeout(() => {
      notificationRetryTimers.delete(reminderId);
      const timerService = getTimerService();
      const activeReminder = timerService?.getState().activeReminder;
      if (activeReminder?.id !== reminderId) return;

      recordReminderAction('defer', activeReminder);
      timerService.deferActiveReminder(getSettings().snoozeMinutes || notificationDeferMinutes);
      refreshTrayMenu();
    }, notificationRetryDelayMs);

    notificationRetryTimers.set(reminderId, retryTimer);
  }

  function clearNotificationRetry(reminderId) {
    if (!reminderId || !notificationRetryTimers.has(reminderId)) return;

    clearTimeout(notificationRetryTimers.get(reminderId));
    notificationRetryTimers.delete(reminderId);
  }

  return {
    clearNotificationRetry,
    presentReminder,
  };
}

module.exports = {
  createReminderPresenter,
};
