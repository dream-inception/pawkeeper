const path = require('node:path');
const shared = require('../shared');

const VALID_REMINDER_INTENSITIES = new Set(['notification', 'overlay', 'fullscreen']);
const VALID_CAT_SIZE_MODES = new Set(['screen', 'half', 'quarter', 'custom']);

const DEFAULT_DESKTOP_SETTINGS = Object.freeze({
  ...shared.DEFAULT_SETTINGS,
  language: 'en',
  hasCompletedOnboarding: false,
  reminderIntensity: 'overlay',
  snoozeMinutes: 5,
  dndUntil: null,
  customCat: null,
  catDisplay: {
    sizeMode: 'half',
    customSize: 50,
  },
  pet: {
    enabled: false,
    size: 120,
    alwaysOnTop: true,
    position: null,
  },
  reminders: {
    sedentary: {
      enabled: true,
      intervalMinutes: 45,
      idleThresholdMinutes: 5,
    },
    hydration: {
      enabled: true,
      intervalMinutes: 60,
    },
    pomodoro: {
      enabled: false,
      focusMinutes: 25,
      breakMinutes: 5,
    },
  },
  tasks: [],
});

const MAIN_I18N = Object.freeze({
  en: {
    openBreakNeko: 'Open Break Neko',
    nextReminder: (time) => `Next: ${time}`,
    noRemindersScheduled: 'No reminders scheduled',
    pauseTimer: 'Pause Timer',
    startTimer: 'Start Timer',
    summonCatNow: 'Summon Cat Now',
    pause30: 'Pause 30 Minutes',
    quit: 'Quit',
    openSettings: 'Open Settings',
    breakFallbackTitle: 'Cat break time',
    breakFallbackMessage: 'The cat video asset could not be loaded, but your break is still running.',
    defaultBreakTitle: 'Cat break time',
    defaultBreakMessage: 'Take a gentle pause with your cat.',
    shortcutHint: 'Press Esc to skip',
    done: 'Done',
    catAlt: 'Cat',
    customCatAlt: 'Custom cat',
    snoozeLabel: (minutes) => `Snooze ${minutes}m`,
    dndEndedTitle: 'Quiet time ended',
    dndEndedMessage: 'Reminders are active again.',
  },
  zh: {
    openBreakNeko: '打开 Break Neko',
    nextReminder: (time) => `下次：${time}`,
    noRemindersScheduled: '暂无提醒计划',
    pauseTimer: '暂停计时',
    startTimer: '开始计时',
    summonCatNow: '召唤小猫',
    pause30: '暂停 30 分钟',
    quit: '退出',
    openSettings: '打开设置',
    breakFallbackTitle: '小猫休息时间',
    breakFallbackMessage: '小猫视频资源暂时无法加载，但休息倒计时仍在继续。',
    defaultBreakTitle: '小猫休息时间',
    defaultBreakMessage: '和小猫一起轻轻暂停一下吧。',
    shortcutHint: '按 Esc 可跳过',
    done: '完成',
    catAlt: '小猫',
    customCatAlt: '自定义小猫',
    snoozeLabel: (minutes) => `稍后 ${minutes} 分钟`,
    dndEndedTitle: '勿扰时间结束',
    dndEndedMessage: '提醒已恢复。',
  },
});

function tMain(key, language = DEFAULT_DESKTOP_SETTINGS.language, ...args) {
  const dictionary = language === 'zh' ? MAIN_I18N.zh : MAIN_I18N.en;
  const value = dictionary[key] || MAIN_I18N.en[key] || key;
  return typeof value === 'function' ? value(...args) : value;
}

function normalizeDesktopSettings(settings) {
  const baseSettings = shared.normalizeSettings(settings);
  const safeSettings = settings && typeof settings === 'object' ? settings : {};
  const reminders = safeSettings.reminders && typeof safeSettings.reminders === 'object'
    ? safeSettings.reminders
    : {};
  const reminderIntensity = VALID_REMINDER_INTENSITIES.has(safeSettings.reminderIntensity)
    ? safeSettings.reminderIntensity
    : DEFAULT_DESKTOP_SETTINGS.reminderIntensity;

  return {
    ...baseSettings,
    language: safeSettings.language === 'zh' ? 'zh' : DEFAULT_DESKTOP_SETTINGS.language,
    hasCompletedOnboarding: safeSettings.hasCompletedOnboarding === true,
    reminderIntensity,
    snoozeMinutes: shared.clampNumber(safeSettings.snoozeMinutes, 1, 60, DEFAULT_DESKTOP_SETTINGS.snoozeMinutes),
    dndUntil: typeof safeSettings.dndUntil === 'string' ? safeSettings.dndUntil : null,
    customCat: normalizeCustomCat(safeSettings.customCat),
    catDisplay: normalizeCatDisplay(safeSettings.catDisplay, safeSettings.customCat),
    pet: normalizePetSettings(safeSettings.pet),
    reminders: {
      sedentary: {
        enabled: reminders.sedentary?.enabled !== false,
        intervalMinutes: shared.clampNumber(reminders.sedentary?.intervalMinutes, 5, 240, DEFAULT_DESKTOP_SETTINGS.reminders.sedentary.intervalMinutes),
        idleThresholdMinutes: shared.clampNumber(reminders.sedentary?.idleThresholdMinutes, 1, 60, DEFAULT_DESKTOP_SETTINGS.reminders.sedentary.idleThresholdMinutes),
      },
      hydration: {
        enabled: reminders.hydration?.enabled !== false,
        intervalMinutes: shared.clampNumber(reminders.hydration?.intervalMinutes, 5, 240, DEFAULT_DESKTOP_SETTINGS.reminders.hydration.intervalMinutes),
      },
      pomodoro: {
        enabled: reminders.pomodoro?.enabled === true,
        focusMinutes: shared.clampNumber(reminders.pomodoro?.focusMinutes, 5, 120, DEFAULT_DESKTOP_SETTINGS.reminders.pomodoro.focusMinutes),
        breakMinutes: shared.clampNumber(reminders.pomodoro?.breakMinutes, 1, 60, DEFAULT_DESKTOP_SETTINGS.reminders.pomodoro.breakMinutes),
      },
    },
    tasks: normalizeTasks(safeSettings.tasks),
  };
}

function normalizePetSettings(pet) {
  const safePet = pet && typeof pet === 'object' ? pet : {};
  const position = safePet.position && typeof safePet.position === 'object'
    ? {
      x: shared.clampNumber(safePet.position.x, -10000, 10000, 80),
      y: shared.clampNumber(safePet.position.y, -10000, 10000, 80),
    }
    : null;

  return {
    enabled: safePet.enabled === true,
    size: shared.clampNumber(safePet.size, 80, 220, DEFAULT_DESKTOP_SETTINGS.pet.size),
    alwaysOnTop: safePet.alwaysOnTop !== false,
    position,
  };
}

function normalizeCatDisplay(catDisplay, legacyCustomCat) {
  const safeCatDisplay = catDisplay && typeof catDisplay === 'object' ? catDisplay : {};
  const legacyScale = legacyCustomCat && typeof legacyCustomCat === 'object'
    ? legacyCustomCat.scale
    : null;
  const sizeMode = VALID_CAT_SIZE_MODES.has(safeCatDisplay.sizeMode)
    ? safeCatDisplay.sizeMode
    : legacyScale
      ? 'custom'
      : DEFAULT_DESKTOP_SETTINGS.catDisplay.sizeMode;

  return {
    sizeMode,
    customSize: shared.clampNumber(
      safeCatDisplay.customSize ?? legacyScale,
      20,
      100,
      DEFAULT_DESKTOP_SETTINGS.catDisplay.customSize
    ),
  };
}

function normalizeTasks(tasks) {
  return Array.isArray(tasks)
    ? tasks
      .filter((task) => task && typeof task === 'object')
      .map((task) => ({
        id: typeof task.id === 'string' ? task.id : `task-${Date.now()}`,
        title: String(task.title || '').trim().slice(0, 120),
        remindAt: typeof task.remindAt === 'string' ? task.remindAt : '',
        done: task.done === true,
      }))
      .filter((task) => task.title)
    : [];
}

function normalizeCustomCat(customCat) {
  if (!customCat || typeof customCat !== 'object' || typeof customCat.path !== 'string') {
    return null;
  }

  return {
    path: customCat.path,
    kind: customCat.kind === 'video' ? 'video' : 'image',
    name: String(customCat.name || path.basename(customCat.path)),
    offsetX: shared.clampNumber(customCat.offsetX, -40, 40, 0),
    offsetY: shared.clampNumber(customCat.offsetY, -40, 40, 0),
  };
}

function localizeReminder(reminder, language) {
  if (language !== 'zh') return reminder;

  const dictionary = {
    manual: {
      title: '小猫休息时间',
      message: '和小猫一起轻轻暂停一下吧。',
      actionLabel: '完成',
    },
    sedentary: {
      title: '该站起来活动了',
      message: '伸展一下背部，走动一分钟。',
      actionLabel: '我活动了',
    },
    hydration: {
      title: '喝水提醒',
      message: '先喝点水，再继续投入工作。',
      actionLabel: '我喝水了',
    },
    pomodoro: {
      title: reminder.id?.includes(':focus:') ? '休息结束' : '番茄钟完成',
      message: reminder.id?.includes(':focus:')
        ? '准备开始下一轮专注了吗？'
        : '专注时间结束了，让小猫守护你的休息。',
      actionLabel: reminder.id?.includes(':focus:') ? '知道了' : '开始休息',
    },
    task: {
      title: reminder.title,
      message: '待办提醒时间到了。',
      actionLabel: '标记完成',
    },
  };

  return {
    ...reminder,
    ...(dictionary[reminder.type] || {}),
  };
}

module.exports = {
  DEFAULT_DESKTOP_SETTINGS,
  localizeReminder,
  normalizeDesktopSettings,
  tMain,
};
