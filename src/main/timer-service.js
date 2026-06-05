const ONE_SECOND_MS = 1000;

const REMINDER_PRIORITY = Object.freeze({
  manual: 100,
  pomodoro: 80,
  task: 60,
  sedentary: 40,
  hydration: 30,
});

const COALESCED_REMINDER_TYPES = new Set(['hydration', 'pomodoro', 'sedentary']);

class TimerService {
  constructor({ getSettings, powerMonitor, onTick, onReminderDue, onDndEnded }) {
    this.getSettings = getSettings;
    this.powerMonitor = powerMonitor;
    this.onTick = onTick;
    this.onReminderDue = onReminderDue;
    this.onDndEnded = onDndEnded || null;
    this.interval = null;
    this.notifiedTaskIds = new Set();
    this.settingsSignature = '';
    this._dndWasActive = false;
    this.state = {
      running: false,
      activeReminder: null,
      queue: [],
      sedentarySeconds: 0,
      hydrationRemainingSeconds: 0,
      pomodoroPhase: 'focus',
      pomodoroRemainingSeconds: 0,
      nextReminderAt: null,
    };
  }

  getState() {
    return {
      ...this.state,
      queue: [...this.state.queue],
      activeReminder: this.state.activeReminder
        ? { ...this.state.activeReminder }
        : null,
      primaryCountdown: this.getPrimaryCountdown(),
    };
  }

  start() {
    const settings = this.getSettings();
    this.state.running = true;
    this.reconcileSettings(settings);
    this.ensureInterval();
    this.emitTick();
  }

  pause() {
    this.state.running = false;
    this.stopInterval();
    this.emitTick();
  }

  reset() {
    this.state.sedentarySeconds = 0;
    this.state.hydrationRemainingSeconds = 0;
    this.state.pomodoroPhase = 'focus';
    this.state.pomodoroRemainingSeconds = 0;
    this.state.queue = [];
    this.state.activeReminder = null;
    this.notifiedTaskIds.clear();
    this.settingsSignature = '';
    this.ensureDefaults(this.getSettings());
    this.emitTick();
  }

  updateSettings() {
    this.reconcileSettings(this.getSettings());
    this.emitTick();
  }

  triggerManualReminder({ presentationOverride = null } = {}) {
    const reminder = {
      id: `manual:${Date.now()}`,
      type: 'manual',
      title: 'Cat break time',
      message: 'Take a gentle pause with your cat.',
      actionLabel: 'Done',
      dueAt: Date.now(),
      priority: REMINDER_PRIORITY.manual,
      presentationOverride,
    };

    // Manual summon is a direct user action; never let stale queued reminders block it.
    this.state.activeReminder = reminder;
    this.state.queue = this.state.queue.filter((item) => item.type !== 'manual');
    this.onReminderDue(reminder);
    this.updateNextReminderAt();
    this.emitTick();
  }

  completeActiveReminder() {
    this.state.activeReminder = null;
    this.showNextReminder();
    this.emitTick();
  }

  snoozeActiveReminder(minutes = 5) {
    if (!this.state.activeReminder) return;

    const reminder = {
      ...this.state.activeReminder,
      id: `${this.state.activeReminder.id}:snooze:${Date.now()}`,
      dueAt: Date.now() + minutes * 60 * 1000,
    };
    this.state.activeReminder = null;
    this.state.queue.push(reminder);
    this.sortQueue();
    this.showNextReminder();
    this.emitTick();
  }

  deferActiveReminder(minutes = 5) {
    if (!this.state.activeReminder) return;

    const reminder = {
      ...this.state.activeReminder,
      id: `${this.state.activeReminder.id}:defer:${Date.now()}`,
      dueAt: Date.now() + minutes * 60 * 1000,
    };
    this.state.activeReminder = null;
    this.state.queue.push(reminder);
    this.sortQueue();
    this.showNextReminder();
    this.emitTick();
  }

  skipActiveReminder() {
    this.state.activeReminder = null;
    this.showNextReminder();
    this.emitTick();
  }

  ensureInterval() {
    if (this.interval) return;
    this.interval = setInterval(() => this.tick(), ONE_SECOND_MS);
  }

  stopInterval() {
    if (!this.interval) return;
    clearInterval(this.interval);
    this.interval = null;
  }

  tick() {
    const settings = this.getSettings();

    if (!this.state.running) {
      this.pause();
      return;
    }

    this.reconcileSettings(settings);

    if (this.isDndActive(settings)) {
      this._dndWasActive = true;
      this.emitTick();
      return;
    }

    if (this._dndWasActive) {
      this._dndWasActive = false;
      if (typeof this.onDndEnded === 'function') {
        this.onDndEnded();
      }
    }

    if (this.state.activeReminder) {
      this.tickSedentary(settings, { suppressReminder: true });
      this.tickHydration(settings, { suppressReminder: true });
      this.tickPomodoro(settings, { suppressReminder: true });
      this.updateNextReminderAt();
      this.emitTick();
      return;
    }

    if (this.showNextReminder()) {
      this.emitTick();
      return;
    }

    this.tickSedentary(settings);
    if (this.state.activeReminder || !this.state.running) {
      this.emitTick();
      return;
    }

    this.tickHydration(settings);
    if (this.state.activeReminder || !this.state.running) {
      this.emitTick();
      return;
    }

    this.tickPomodoro(settings);
    if (this.state.activeReminder || !this.state.running) {
      this.emitTick();
      return;
    }

    this.tickTasks(settings);
    this.emitTick();
  }

  tickSedentary(settings, { suppressReminder = false } = {}) {
    const reminder = settings.reminders.sedentary;
    if (!reminder.enabled) return;

    if (!this.isUserActive(reminder.idleThresholdMinutes)) {
      this.state.sedentarySeconds = 0;
      return;
    }

    this.state.sedentarySeconds += 1;

    if (this.state.sedentarySeconds >= reminder.intervalMinutes * 60) {
      if (suppressReminder) {
        this.state.sedentarySeconds = reminder.intervalMinutes * 60;
        return;
      }
      this.state.sedentarySeconds = 0;
      this.enqueueReminder({
        id: `sedentary:${Date.now()}`,
        type: 'sedentary',
        title: 'Time to stand up',
        message: 'Stretch your back and walk around for a minute.',
        actionLabel: 'I moved',
        dueAt: Date.now(),
      });
    }
  }

  tickHydration(settings, { suppressReminder = false } = {}) {
    const reminder = settings.reminders.hydration;
    if (!reminder.enabled) return;

    this.state.hydrationRemainingSeconds = Math.max(0, this.state.hydrationRemainingSeconds - 1);

    if (this.state.hydrationRemainingSeconds <= 0) {
      if (suppressReminder) {
        return;
      }
      this.state.hydrationRemainingSeconds = reminder.intervalMinutes * 60;
      this.enqueueReminder({
        id: `hydration:${Date.now()}`,
        type: 'hydration',
        title: 'Water break',
        message: 'Drink some water before you dive back in.',
        actionLabel: 'I drank water',
        dueAt: Date.now(),
      });
    }
  }

  tickPomodoro(settings, { suppressReminder = false } = {}) {
    const reminder = settings.reminders.pomodoro;
    if (!reminder.enabled) return;

    this.state.pomodoroRemainingSeconds = Math.max(0, this.state.pomodoroRemainingSeconds - 1);

    if (this.state.pomodoroRemainingSeconds > 0) return;
    if (suppressReminder) return;

    if (this.state.pomodoroPhase === 'focus') {
      this.state.pomodoroPhase = 'break';
      this.state.pomodoroRemainingSeconds = reminder.breakMinutes * 60;
      this.enqueueReminder({
        id: `pomodoro:break:${Date.now()}`,
        type: 'pomodoro',
        title: 'Pomodoro complete',
        message: 'Your focus session is done. Let the cat guard your break.',
        actionLabel: 'Start break',
        dueAt: Date.now(),
      });
      return;
    }

    this.state.pomodoroPhase = 'focus';
    this.state.pomodoroRemainingSeconds = reminder.focusMinutes * 60;
    this.enqueueReminder({
      id: `pomodoro:focus:${Date.now()}`,
      type: 'pomodoro',
      title: 'Break complete',
      message: 'Ready for another focus session?',
      actionLabel: 'Start focus',
      dueAt: Date.now(),
    });
  }

  tickTasks(settings) {
    if (this.state.activeReminder) return;

    const now = Date.now();

    for (const task of settings.tasks.filter((item) => !item.done && item.remindAt && Date.parse(item.remindAt) <= now)) {
      if (this.notifiedTaskIds.has(task.id)) continue;
      this.notifiedTaskIds.add(task.id);
      this.enqueueReminder({
        id: `task:${task.id}`,
        type: 'task',
        title: task.title || 'Task reminder',
        message: 'A task reminder is due now.',
        actionLabel: 'Mark done',
        taskId: task.id,
        dueAt: now,
      });
      return;
    }
  }

  enqueueReminder(reminder) {
    if (this.state.queue.some((item) => item.id === reminder.id)) return;
    if (this.hasEquivalentReminder(reminder)) return;

    this.state.queue.push({
      priority: REMINDER_PRIORITY[reminder.type] || 10,
      ...reminder,
    });
    this.sortQueue();
    return this.showNextReminder();
  }

  showNextReminder(now = Date.now()) {
    const nextIndex = this.findDueReminderIndex(now);

    if (this.state.activeReminder || nextIndex === -1) {
      this.updateNextReminderAt();
      return false;
    }

    const [nextReminder] = this.state.queue.splice(nextIndex, 1);
    this.state.activeReminder = nextReminder;
    this.onReminderDue(nextReminder);
    this.updateNextReminderAt();
    return true;
  }

  findDueReminderIndex(now = Date.now()) {
    let selectedIndex = -1;

    this.state.queue.forEach((item, index) => {
      if (item.dueAt > now) return;

      if (selectedIndex === -1) {
        selectedIndex = index;
        return;
      }

      const selected = this.state.queue[selectedIndex];
      if (
        item.priority > selected.priority ||
        (item.priority === selected.priority && item.dueAt < selected.dueAt)
      ) {
        selectedIndex = index;
      }
    });

    return selectedIndex;
  }

  hasEquivalentReminder(reminder) {
    return [this.state.activeReminder, ...this.state.queue]
      .filter(Boolean)
      .some((item) => this.getReminderDedupeKey(item) === this.getReminderDedupeKey(reminder));
  }

  getReminderDedupeKey(reminder) {
    if (!reminder?.type) return '';
    if (reminder.type === 'task') {
      return reminder.taskId ? `task:${reminder.taskId}` : reminder.id;
    }
    if (COALESCED_REMINDER_TYPES.has(reminder.type)) {
      return reminder.type;
    }
    return reminder.id;
  }

  sortQueue() {
    this.state.queue.sort((a, b) =>
      a.dueAt === b.dueAt
        ? b.priority - a.priority
        : a.dueAt - b.dueAt
    );
  }

  updateNextReminderAt() {
    const dueTimes = [];
    const settings = this.getSettings();

    if (settings.reminders.sedentary.enabled) {
      dueTimes.push(Date.now() + Math.max(0, settings.reminders.sedentary.intervalMinutes * 60 - this.state.sedentarySeconds) * 1000);
    }

    if (settings.reminders.hydration.enabled) {
      dueTimes.push(Date.now() + Math.max(0, this.state.hydrationRemainingSeconds) * 1000);
    }

    if (settings.reminders.pomodoro.enabled) {
      dueTimes.push(Date.now() + Math.max(0, this.state.pomodoroRemainingSeconds) * 1000);
    }

    settings.tasks
      .filter((task) => !task.done && task.remindAt)
      .forEach((task) => dueTimes.push(Date.parse(task.remindAt)));

    this.state.queue.forEach((reminder) => {
      if (Number.isFinite(reminder.dueAt)) {
        dueTimes.push(reminder.dueAt);
      }
    });

    this.state.nextReminderAt = dueTimes.length
      ? new Date(Math.min(...dueTimes)).toISOString()
      : null;
  }

  getPrimaryCountdown() {
    const settings = this.getSettings();
    const now = Date.now();

    if (this.state.activeReminder) {
      return {
        source: 'active',
        type: this.state.activeReminder.type,
        title: this.state.activeReminder.title,
        remainingSeconds: 0,
        totalSeconds: 0,
        progress: 1,
        dueAt: this.state.activeReminder.dueAt
          ? new Date(this.state.activeReminder.dueAt).toISOString()
          : null,
      };
    }

    const candidates = [];

    this.state.queue.forEach((queuedReminder) => {
      candidates.push({
        source: 'queued',
        type: queuedReminder.type,
        title: queuedReminder.title,
        remainingSeconds: Math.max(0, Math.ceil((queuedReminder.dueAt - now) / 1000)),
        totalSeconds: 0,
        dueAt: new Date(queuedReminder.dueAt).toISOString(),
      });
    });

    if (settings.reminders.pomodoro.enabled) {
      const totalSeconds = (this.state.pomodoroPhase === 'break'
        ? settings.reminders.pomodoro.breakMinutes
        : settings.reminders.pomodoro.focusMinutes) * 60;
      candidates.push({
        source: 'pomodoro',
        type: 'pomodoro',
        remainingSeconds: Math.max(0, this.state.pomodoroRemainingSeconds),
        totalSeconds,
      });
    }

    if (settings.reminders.hydration.enabled) {
      candidates.push({
        source: 'hydration',
        type: 'hydration',
        remainingSeconds: Math.max(0, this.state.hydrationRemainingSeconds),
        totalSeconds: settings.reminders.hydration.intervalMinutes * 60,
      });
    }

    if (settings.reminders.sedentary.enabled) {
      const totalSeconds = settings.reminders.sedentary.intervalMinutes * 60;
      candidates.push({
        source: 'sedentary',
        type: 'sedentary',
        remainingSeconds: Math.max(0, totalSeconds - this.state.sedentarySeconds),
        totalSeconds,
      });
    }

    settings.tasks
      .filter((task) => !task.done && task.remindAt)
      .forEach((task) => {
        const dueAt = Date.parse(task.remindAt);
        if (!Number.isFinite(dueAt)) return;
        candidates.push({
          source: 'task',
          type: 'task',
          title: task.title,
          remainingSeconds: Math.max(0, Math.ceil((dueAt - now) / 1000)),
          totalSeconds: 0,
          dueAt: new Date(dueAt).toISOString(),
        });
      });

    const primary = candidates
      .filter((candidate) => Number.isFinite(candidate.remainingSeconds))
      .sort((a, b) => a.remainingSeconds - b.remainingSeconds)[0];

    if (!primary) return null;

    const totalSeconds = Math.max(0, primary.totalSeconds || 0);
    const remainingSeconds = Math.max(0, primary.remainingSeconds);
    return {
      ...primary,
      remainingSeconds,
      totalSeconds,
      progress: totalSeconds > 0
        ? Math.min(1, Math.max(0, 1 - (remainingSeconds / totalSeconds)))
        : 0,
      dueAt: primary.dueAt || new Date(now + remainingSeconds * 1000).toISOString(),
    };
  }

  getNextQueuedReminder() {
    if (this.state.queue.length === 0) return null;
    return [...this.state.queue].sort((a, b) =>
      a.dueAt === b.dueAt
        ? b.priority - a.priority
        : a.dueAt - b.dueAt
    )[0];
  }

  ensureDefaults(settings) {
    if (this.state.hydrationRemainingSeconds <= 0) {
      this.state.hydrationRemainingSeconds = settings.reminders.hydration.intervalMinutes * 60;
    }

    if (this.state.pomodoroRemainingSeconds <= 0) {
      this.state.pomodoroRemainingSeconds = settings.reminders.pomodoro.focusMinutes * 60;
    }

    this.updateNextReminderAt();
  }

  reconcileSettings(settings, { force = false } = {}) {
    const signature = JSON.stringify({
      hydration: settings.reminders.hydration,
      pomodoro: settings.reminders.pomodoro,
      sedentary: settings.reminders.sedentary,
    });

    if (force || signature !== this.settingsSignature) {
      this.state.hydrationRemainingSeconds = settings.reminders.hydration.intervalMinutes * 60;
      this.state.pomodoroPhase = 'focus';
      this.state.pomodoroRemainingSeconds = settings.reminders.pomodoro.focusMinutes * 60;
      this.state.sedentarySeconds = Math.min(
        this.state.sedentarySeconds,
        settings.reminders.sedentary.intervalMinutes * 60
      );
      this.settingsSignature = signature;
    }

    this.ensureDefaults(settings);
  }

  isDndActive(settings) {
    return settings.dndUntil && Date.parse(settings.dndUntil) > Date.now();
  }

  isUserActive(idleThresholdMinutes) {
    if (!this.powerMonitor) return true;

    try {
      return this.powerMonitor.getSystemIdleState(idleThresholdMinutes * 60) === 'active';
    } catch (_error) {
      return true;
    }
  }

  emitTick() {
    this.onTick(this.getState());
  }
}

module.exports = TimerService;
