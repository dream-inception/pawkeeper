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

function getCompletedCount(stats) {
  return (stats?.sedentaryCompletedCount || 0) +
    (stats?.hydrationCompletedCount || 0) +
    (stats?.pomodoroCompletedCount || 0) +
    (stats?.taskCompletedCount || 0);
}

function addDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function getStatsSummary(statsByDate = {}, today = new Date()) {
  const todayKey = getLocalDateKey(today);
  const weekDates = Array.from({ length: 7 }, (_, index) => getLocalDateKey(addDays(today, index - 6)));
  const week = weekDates.reduce((summary, date) => {
    const stats = {
      ...getEmptyDailyStats(date),
      ...(statsByDate[date] || {}),
      date,
    };
    return {
      completedCount: summary.completedCount + getCompletedCount(stats),
      snoozeCount: summary.snoozeCount + (stats.snoozeCount || 0),
      skippedCount: summary.skippedCount + (stats.skippedCount || 0),
      deferredCount: summary.deferredCount + (stats.deferredCount || 0),
      activeDays: summary.activeDays + (getCompletedCount(stats) > 0 ? 1 : 0),
    };
  }, {
    completedCount: 0,
    snoozeCount: 0,
    skippedCount: 0,
    deferredCount: 0,
    activeDays: 0,
  });

  let streakDays = 0;
  for (let offset = 0; offset < 366; offset += 1) {
    const date = getLocalDateKey(addDays(today, -offset));
    const stats = {
      ...getEmptyDailyStats(date),
      ...(statsByDate[date] || {}),
      date,
    };
    if (getCompletedCount(stats) <= 0) break;
    streakDays += 1;
  }

  return {
    today: {
      ...getEmptyDailyStats(todayKey),
      ...(statsByDate[todayKey] || {}),
      date: todayKey,
    },
    week,
    streakDays,
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
    getStatsSummary: () => getStatsSummary(store.get('stats') || {}),
    getTodayStats,
    recordReminderAction,
  };
}

module.exports = {
  createStatsTracker,
  getCompletedCount,
  getEmptyDailyStats,
  getLocalDateKey,
  getStatsSummary,
};
