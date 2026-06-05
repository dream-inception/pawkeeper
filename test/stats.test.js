const assert = require('node:assert/strict');
const test = require('node:test');

const {
  getCompletedCount,
  getStatsSummary,
} = require('../src/main/stats');

test('counts completed healthy actions across reminder types', () => {
  assert.equal(getCompletedCount({
    sedentaryCompletedCount: 1,
    hydrationCompletedCount: 2,
    pomodoroCompletedCount: 3,
    taskCompletedCount: 4,
    snoozeCount: 5,
  }), 10);
});

test('summarizes the last seven local days and current streak', () => {
  const today = new Date(2026, 4, 20, 12, 0, 0);
  const summary = getStatsSummary({
    '2026-05-14': { sedentaryCompletedCount: 1, snoozeCount: 1 },
    '2026-05-15': { hydrationCompletedCount: 2 },
    '2026-05-18': { pomodoroCompletedCount: 1, skippedCount: 1 },
    '2026-05-19': { taskCompletedCount: 1, deferredCount: 1 },
    '2026-05-20': { sedentaryCompletedCount: 1, hydrationCompletedCount: 1 },
  }, today);

  assert.equal(summary.today.date, '2026-05-20');
  assert.equal(summary.week.completedCount, 7);
  assert.equal(summary.week.activeDays, 5);
  assert.equal(summary.week.snoozeCount, 1);
  assert.equal(summary.week.skippedCount, 1);
  assert.equal(summary.week.deferredCount, 1);
  assert.equal(summary.streakDays, 3);
});

test('streak is zero when today has no completed reminders', () => {
  const today = new Date(2026, 4, 20, 12, 0, 0);
  const summary = getStatsSummary({
    '2026-05-19': { hydrationCompletedCount: 1 },
  }, today);

  assert.equal(summary.week.completedCount, 1);
  assert.equal(summary.week.activeDays, 1);
  assert.equal(summary.streakDays, 0);
});
