function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getEmptyDailyStats(date = getLocalDateKey()) {
  return {
    date,
    sedentaryCompletedCount: 0,
    hydrationCompletedCount: 0,
    pomodoroCompletedCount: 0,
    taskCompletedCount: 0,
    snoozeCount: 0,
    skippedCount: 0,
    deferredCount: 0,
  };
}

function createStatsTracker(store) {
  function getTodayStats() {
    const date = getLocalDateKey();
    const stats = store.get('stats') || {};
    return {
      ...getEmptyDailyStats(date),
      ...(stats[date] || {}),
      date,
    };
  }

  function incrementTodayStat(field) {
    const date = getLocalDateKey();
    const stats = store.get('stats') || {};
    const todayStats = {
      ...getEmptyDailyStats(date),
      ...(stats[date] || {}),
      date,
    };
    todayStats[field] = (todayStats[field] || 0) + 1;
    store.set('stats', {
      ...stats,
      [date]: todayStats,
    });
  }

  function recordReminderAction(action, reminder) {
    if (!reminder || reminder.type === 'manual') return;

    if (action === 'snooze') {
      incrementTodayStat('snoozeCount');
      return;
    }

    if (action === 'skip') {
      incrementTodayStat('skippedCount');
      return;
    }

    if (action === 'defer') {
      incrementTodayStat('deferredCount');
      return;
    }

    if (action !== 'complete') return;

    const completedField = {
      sedentary: 'sedentaryCompletedCount',
      hydration: 'hydrationCompletedCount',
      pomodoro: 'pomodoroCompletedCount',
      task: 'taskCompletedCount',
    }[reminder.type];

    if (completedField) {
      incrementTodayStat(completedField);
    }
  }

  return {
    getTodayStats,
    recordReminderAction,
  };
}

module.exports = {
  createStatsTracker,
  getEmptyDailyStats,
  getLocalDateKey,
};
