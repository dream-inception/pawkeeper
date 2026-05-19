const shared = globalThis.BreakNekoShared;
const api = window.breakNeko;

const form = document.getElementById('settingsForm');
const onboardingPanel = document.getElementById('onboardingPanel');
const languageSelect = document.getElementById('languageSelect');
const reminderIntensityInput = document.getElementById('reminderIntensity');
const sedentaryEnabledInput = document.getElementById('sedentaryEnabled');
const sedentaryIntervalInput = document.getElementById('sedentaryInterval');
const idleThresholdInput = document.getElementById('idleThresholdMinutes');
const hydrationEnabledInput = document.getElementById('hydrationEnabled');
const hydrationIntervalInput = document.getElementById('hydrationInterval');
const pomodoroEnabledInput = document.getElementById('pomodoroEnabled');
const pomodoroFocusInput = document.getElementById('pomodoroFocus');
const pomodoroBreakInput = document.getElementById('pomodoroBreak');
const breakTimeInput = document.getElementById('breakTime');
const snoozeMinutesInput = document.getElementById('snoozeMinutes');
const timerStatus = document.getElementById('timerStatus');
const timerTime = document.getElementById('timerTime');
const nextReminderText = document.getElementById('nextReminderText');
const timerQueueText = document.getElementById('timerQueueText');
const statusReminderChips = document.getElementById('statusReminderChips');
const todayStatsText = document.getElementById('todayStatsText');
const statusOrb = document.getElementById('statusOrb');
const statusTypeIcon = document.getElementById('statusTypeIcon');
const enabledReminderSummary = document.getElementById('enabledReminderSummary');
const timerToggleBtn = document.getElementById('timerToggleBtn');
const timerToggleLabel = document.getElementById('timerToggleLabel');
const savedMsg = document.getElementById('savedMsg');
const taskTitleInput = document.getElementById('taskTitle');
const taskTemplateList = document.getElementById('taskTemplateList');
const taskTimeInput = document.getElementById('taskTime');
const taskTimeError = document.getElementById('taskTimeError');
const taskList = document.getElementById('taskList');
const catPreview = document.getElementById('catPreview');
const catPreviewImage = document.getElementById('catPreviewImage');
const catPreviewVideo = document.getElementById('catPreviewVideo');
const catPreviewLabel = document.getElementById('catPreviewLabel');
const petEnabledInput = document.getElementById('petEnabled');
const catSizeModeInput = document.getElementById('catSizeMode');
const catCustomSizeField = document.getElementById('catCustomSizeField');
const catCustomSizeInput = document.getElementById('catCustomSize');
const catCustomSizeValue = document.getElementById('catCustomSizeValue');
const catOffsetXInput = document.getElementById('catOffsetX');
const catOffsetYInput = document.getElementById('catOffsetY');
const appVersionText = document.getElementById('appVersion');
const tabButtons = Array.from(document.querySelectorAll('.tab-button'));
const panels = Array.from(document.querySelectorAll('.panel'));
const quickTaskTimeButtons = Array.from(document.querySelectorAll('[data-task-offset-minutes]'));
const durationControls = Array.from(document.querySelectorAll('[data-duration-control]'));
const durationPresetButtons = Array.from(document.querySelectorAll('[data-duration-preset]'));

let currentSettings;
let currentTimerState;
let currentAppInfo;

const TASK_TEMPLATES = [
  { key: 'drinkWater', offsetMinutes: 15 },
  { key: 'stretch', offsetMinutes: 15 },
  { key: 'restEyes', offsetMinutes: 30 },
  { key: 'walk', offsetMinutes: 30 },
  { key: 'message', offsetMinutes: 60 },
  { key: 'meeting', offsetMinutes: 60 },
];

const I18N = {
  en: {
    heroEyebrow: 'Cat-powered reminders',
    heroTagline: 'Stand, drink, focus, and let the cat nudge you gently.',
    suggestedStart: 'Suggested start',
    suggestedCopy: 'Stand + water reminders with a transparent cat overlay.',
    useDefaults: 'Use defaults',
    today: 'Today',
    controlCenter: 'Control center',
    reminderSetup: 'Reminder setup',
    startReminders: 'Start Reminders',
    pauseReminders: 'Pause Reminders',
    summonCat: 'Summon Cat',
    timers: 'Timers',
    tasks: 'Tasks',
    cat: 'Cat',
    settings: 'Settings',
    timersHint: 'Stand, drink, focus',
    standReminder: 'Stand up reminder',
    everyActiveMinutes: 'Remind me after active minutes',
    idleReset: 'Reset after idle minutes',
    waterReminder: 'Water reminder',
    everyMinutes: 'Remind me every minutes',
    pomodoro: 'Pomodoro',
    focusMinutes: 'Focus minutes',
    breakMinutes: 'Break minutes',
    tasksHint: 'Lightweight due reminders',
    task: 'Task',
    taskPlaceholder: 'Water the plants',
    remindAt: 'Remind me at',
    addTask: 'Add Task Reminder',
    noTasks: 'No task reminders yet.',
    noTime: 'No time',
    markDone: 'Mark Done',
    done: 'Done',
    catHint: 'Use the default cat or your own',
    chooseCat: 'Choose My Cat',
    useDefault: 'Use Default',
    defaultCat: 'Using the default orange cat',
    usingCat: (name) => `Using ${name}`,
    catPreviewAlt: 'Cat preview',
    showDesktopPet: 'Show desktop pet',
    desktopPetHelp: 'Shows a draggable cat. Double-click it to summon a break.',
    catSize: 'Overlay size',
    catSizeScreen: 'Full screen',
    catSizeHalf: '1/2 screen',
    catSizeQuarter: '1/4 screen',
    catSizeCustom: 'Custom',
    catCustomSize: 'Custom size (% of screen)',
    horizontalOffset: 'Horizontal offset',
    verticalOffset: 'Vertical offset',
    settingsHint: 'Interruptions and quiet time',
    language: 'Language',
    reminderIntensity: 'Reminder intensity',
    intensityNotification: 'Light: system notification',
    intensityOverlay: 'Medium: transparent cat overlay',
    intensityFullscreen: 'Strong: fullscreen cat break',
    countdown: 'Cat overlay countdown (minutes)',
    snoozeDuration: 'Snooze duration (minutes)',
    pause30: 'Pause 30 Minutes',
    save: 'Save Settings',
    saved: 'Saved!',
    appVersion: (version) => `Version ${version}`,
    runningReminders: 'Running reminders',
    runningRhythm: (phase) => `Running - ${phase} rhythm`,
    paused: 'Paused',
    nextReminder: (time) => `Next reminder: ${time}`,
    noNextReminder: 'Next reminder: none scheduled',
    queuedReminders: (count) => `${count} reminder${count === 1 ? '' : 's'} waiting`,
    enabledReminders: 'Enabled reminders',
    noEnabledReminders: 'No reminders enabled',
    pendingTasksCount: (count) => `${count} item${count === 1 ? '' : 's'}`,
    todayStats: (stand, water, focus) => `Today: stand ${stand} · water ${water} · focus ${focus}`,
    todayStatsEmpty: 'No healthy breaks yet today. Start with one sip of water.',
    todayStatsWin: 'Nice rhythm',
    pastTaskTime: 'Choose a future reminder time.',
    minutesShort: 'm',
    hoursShort: 'h',
    deleteTask: 'Delete',
    clearCompleted: 'Clear completed',
    taskNoAutoReminder: 'No automatic reminder',
    taskTemplateHint: 'Choose a common task or type your own.',
    preciseSettings: 'Precise settings',
    taskTemplateDrinkWater: 'Drink water',
    taskTemplateStretch: 'Stand & stretch',
    taskTemplateRestEyes: 'Rest eyes',
    taskTemplateWalk: 'Walk 5m',
    taskTemplateMessage: 'Reply message',
    taskTemplateMeeting: 'Meeting prep',
    reminderType: {
      manual: 'Cat break',
      sedentary: 'Stand',
      hydration: 'Water',
      pomodoro: 'Focus',
      task: 'Task',
    },
  },
  zh: {
    heroEyebrow: '小猫提醒助手',
    heroTagline: '久坐、喝水、专注和待办，都让小猫温柔提醒你。',
    suggestedStart: '推荐开始',
    suggestedCopy: '开启久坐 + 喝水提醒，并使用透明小猫覆盖层。',
    useDefaults: '使用推荐设置',
    today: '今天',
    controlCenter: '控制中心',
    reminderSetup: '提醒设置',
    startReminders: '开始提醒',
    pauseReminders: '暂停提醒',
    summonCat: '召唤小猫',
    timers: '计时',
    tasks: '待办',
    cat: '小猫',
    settings: '设置',
    timersHint: '站立、喝水、专注',
    standReminder: '久坐提醒',
    everyActiveMinutes: '活跃多久后提醒',
    idleReset: '空闲多久后重置',
    waterReminder: '喝水提醒',
    everyMinutes: '每隔多久提醒',
    pomodoro: '番茄钟',
    focusMinutes: '专注分钟',
    breakMinutes: '休息分钟',
    tasksHint: '轻量到点提醒',
    task: '待办事项',
    taskPlaceholder: '给植物浇水',
    remindAt: '提醒时间',
    addTask: '添加待办提醒',
    noTasks: '还没有待办提醒。',
    noTime: '未设置时间',
    markDone: '标记完成',
    done: '已完成',
    catHint: '使用默认小猫或自家小猫',
    chooseCat: '选择我的小猫',
    useDefault: '使用默认',
    defaultCat: '正在使用默认橘猫',
    usingCat: (name) => `正在使用 ${name}`,
    catPreviewAlt: '小猫预览',
    showDesktopPet: '显示桌面小猫',
    desktopPetHelp: '显示一只可拖动的小猫，双击可召唤休息。',
    catSize: '覆盖层尺寸',
    catSizeScreen: '全屏',
    catSizeHalf: '1/2 屏幕',
    catSizeQuarter: '1/4 屏幕',
    catSizeCustom: '自定义',
    catCustomSize: '自定义尺寸（屏幕百分比）',
    horizontalOffset: '水平偏移',
    verticalOffset: '垂直偏移',
    settingsHint: '打扰强度和勿扰',
    language: '语言',
    reminderIntensity: '提醒强度',
    intensityNotification: '轻提醒：系统通知',
    intensityOverlay: '中提醒：透明小猫覆盖层',
    intensityFullscreen: '强提醒：全屏小猫休息页',
    countdown: '小猫覆盖倒计时（分钟）',
    snoozeDuration: '稍后提醒时长（分钟）',
    pause30: '暂停 30 分钟',
    save: '保存设置',
    saved: '已保存！',
    appVersion: (version) => `版本 ${version}`,
    runningReminders: '提醒运行中',
    runningRhythm: (phase) => `运行中 - ${phase === 'break' ? '休息' : '专注'}节奏`,
    paused: '已暂停',
    nextReminder: (time) => `下次提醒：${time}`,
    noNextReminder: '下次提醒：暂无',
    queuedReminders: (count) => `还有 ${count} 个提醒排队中`,
    enabledReminders: '已启用提醒',
    noEnabledReminders: '未启用提醒',
    pendingTasksCount: (count) => `${count} 个`,
    todayStats: (stand, water, focus) => `今天：活动 ${stand} · 喝水 ${water} · 专注 ${focus}`,
    todayStatsEmpty: '今天还没有完成提醒，先从一次喝水开始。',
    todayStatsWin: '节奏不错',
    pastTaskTime: '请选择未来的提醒时间。',
    minutesShort: '分',
    hoursShort: '小时',
    deleteTask: '删除',
    clearCompleted: '清除已完成',
    taskNoAutoReminder: '不会自动提醒',
    taskTemplateHint: '选择常用待办，或直接输入自己的事项。',
    preciseSettings: '精确设置',
    taskTemplateDrinkWater: '喝水',
    taskTemplateStretch: '站起拉伸',
    taskTemplateRestEyes: '远眺护眼',
    taskTemplateWalk: '走动 5 分钟',
    taskTemplateMessage: '回复消息',
    taskTemplateMeeting: '准备会议',
    reminderType: {
      manual: '小猫休息',
      sedentary: '活动',
      hydration: '喝水',
      pomodoro: '专注',
      task: '待办',
    },
  },
};

function t(key, ...args) {
  const language = currentSettings?.language === 'zh' ? 'zh' : 'en';
  const value = I18N[language][key] || I18N.en[key] || key;
  return typeof value === 'function' ? value(...args) : value;
}

function reminderLabel(type) {
  const language = currentSettings?.language === 'zh' ? 'zh' : 'en';
  return I18N[language].reminderType[type] || I18N.en.reminderType[type] || type || '';
}

function reminderIconSvg(type) {
  const icons = {
    hydration: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11Z"></path><path d="M9 15.5c.8 1.2 1.8 1.8 3 1.8"></path></svg>',
    pomodoro: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7c4 0 7 2.7 7 6.4 0 4.2-3.2 7.1-7 7.1s-7-2.9-7-7.1C5 9.7 8 7 12 7Z"></path><path d="M12 7c-.2-2 1-3.4 3-4"></path><path d="M9 6c1.4-.7 3.5-.7 5 0"></path></svg>',
    sedentary: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 20h8"></path><path d="M12 4v16"></path><path d="m7 9 5-5 5 5"></path></svg>',
    task: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 12l2.4 2.4L16 8.8"></path><path d="M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"></path></svg>',
    manual: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8 3.5 4.5 8 6l2-2h4l2 2 4.5-1.5L19 8v5a7 7 0 0 1-14 0V8Z"></path><path d="M9 13h.01M15 13h.01M10 16c1.2.7 2.8.7 4 0"></path></svg>',
  };
  return icons[type] || icons.manual;
}

function taskTemplateLabel(template) {
  const key = `taskTemplate${template.key.charAt(0).toUpperCase()}${template.key.slice(1)}`;
  return t(key);
}

function getStatusCountdownItems(settings = currentSettings, state = currentTimerState) {
  if (!settings) return [];

  const items = [];
  if (settings.reminders.sedentary.enabled) {
    const totalSeconds = settings.reminders.sedentary.intervalMinutes * 60;
    const remainingSeconds = state?.running
      ? Math.max(0, totalSeconds - (state.sedentarySeconds || 0))
      : totalSeconds;
    items.push({
      type: 'sedentary',
      label: reminderLabel('sedentary'),
      remainingSeconds,
      totalSeconds,
      value: formatDuration(remainingSeconds),
    });
  }
  if (settings.reminders.hydration.enabled) {
    const totalSeconds = settings.reminders.hydration.intervalMinutes * 60;
    const remainingSeconds = state?.running
      ? Math.max(0, state.hydrationRemainingSeconds || 0)
      : totalSeconds;
    items.push({
      type: 'hydration',
      label: reminderLabel('hydration'),
      remainingSeconds,
      totalSeconds,
      value: formatDuration(remainingSeconds),
    });
  }
  if (settings.reminders.pomodoro.enabled) {
    const totalSeconds = (state?.pomodoroPhase === 'break'
      ? settings.reminders.pomodoro.breakMinutes
      : settings.reminders.pomodoro.focusMinutes) * 60;
    const remainingSeconds = state?.running
      ? Math.max(0, state.pomodoroRemainingSeconds || 0)
      : totalSeconds;
    items.push({
      type: 'pomodoro',
      label: reminderLabel('pomodoro'),
      remainingSeconds,
      totalSeconds,
      value: formatDuration(remainingSeconds),
    });
  }

  const pendingTasks = (settings.tasks || []).filter((task) => !task.done);
  if (pendingTasks.length > 0) {
    const nextTask = pendingTasks
      .filter((task) => task.remindAt && Date.parse(task.remindAt) > Date.now())
      .sort((a, b) => Date.parse(a.remindAt) - Date.parse(b.remindAt))[0];
    const remainingSeconds = nextTask
      ? Math.max(0, Math.ceil((Date.parse(nextTask.remindAt) - Date.now()) / 1000))
      : null;
    items.push({
      type: 'task',
      label: reminderLabel('task'),
      remainingSeconds,
      totalSeconds: 0,
      value: remainingSeconds == null
        ? t('pendingTasksCount', pendingTasks.length)
        : formatDuration(remainingSeconds),
    });
  }

  return items;
}

function getPrimaryStatusCountdown(items) {
  return items
    .filter((item) => Number.isFinite(item.remainingSeconds))
    .sort((a, b) => a.remainingSeconds - b.remainingSeconds)[0] || null;
}

function renderReminderChips(container, items) {
  if (!container) return;

  if (items.length === 0) {
    container.innerHTML = `<span class="reminder-empty">${t('noEnabledReminders')}</span>`;
    return;
  }

  container.innerHTML = items.map((item) => `
    <span class="reminder-chip" data-reminder-type="${item.type}">
      <span class="reminder-chip-icon">${reminderIconSvg(item.type)}</span>
      <span>${item.label}</span>
      <strong>${item.value}</strong>
    </span>
  `).join('');
}

function renderEnabledReminderSummary(state = currentTimerState) {
  const items = getStatusCountdownItems(currentSettings, state);
  if (enabledReminderSummary) {
    enabledReminderSummary.hidden = true;
    enabledReminderSummary.innerHTML = '';
  }
  renderReminderChips(statusReminderChips, items);
}

function clampInput(input, fallback) {
  return shared.clampNumber(input.value, Number(input.min), Number(input.max), fallback);
}

function readSettingsFromForm() {
  return {
    ...currentSettings,
    catEnabled: true,
    language: languageSelect.value,
    reminderIntensity: reminderIntensityInput.value,
    breakTime: clampInput(breakTimeInput, 5),
    snoozeMinutes: clampInput(snoozeMinutesInput, 5),
    reminders: {
      sedentary: {
        enabled: sedentaryEnabledInput.checked,
        intervalMinutes: clampInput(sedentaryIntervalInput, 45),
        idleThresholdMinutes: clampInput(idleThresholdInput, 5),
      },
      hydration: {
        enabled: hydrationEnabledInput.checked,
        intervalMinutes: clampInput(hydrationIntervalInput, 60),
      },
      pomodoro: {
        enabled: pomodoroEnabledInput.checked,
        focusMinutes: clampInput(pomodoroFocusInput, 25),
        breakMinutes: clampInput(pomodoroBreakInput, 5),
      },
    },
    customCat: currentSettings.customCat
      ? {
        ...currentSettings.customCat,
        offsetX: clampInput(catOffsetXInput, 0),
        offsetY: clampInput(catOffsetYInput, 0),
      }
      : null,
    pet: {
      ...(currentSettings.pet || {}),
      enabled: petEnabledInput.checked,
    },
    catDisplay: {
      sizeMode: catSizeModeInput.value,
      customSize: clampInput(catCustomSizeInput, 50),
    },
  };
}

function applySettingsToForm(settings) {
  currentSettings = settings;
  document.documentElement.lang = settings.language === 'zh' ? 'zh-CN' : 'en';
  onboardingPanel.hidden = settings.hasCompletedOnboarding;
  languageSelect.value = settings.language || 'en';
  reminderIntensityInput.value = settings.reminderIntensity;
  breakTimeInput.value = settings.breakTime;
  snoozeMinutesInput.value = settings.snoozeMinutes || 5;
  sedentaryEnabledInput.checked = settings.reminders.sedentary.enabled;
  sedentaryIntervalInput.value = settings.reminders.sedentary.intervalMinutes;
  idleThresholdInput.value = settings.reminders.sedentary.idleThresholdMinutes;
  hydrationEnabledInput.checked = settings.reminders.hydration.enabled;
  hydrationIntervalInput.value = settings.reminders.hydration.intervalMinutes;
  pomodoroEnabledInput.checked = settings.reminders.pomodoro.enabled;
  pomodoroFocusInput.value = settings.reminders.pomodoro.focusMinutes;
  pomodoroBreakInput.value = settings.reminders.pomodoro.breakMinutes;
  catSizeModeInput.value = settings.catDisplay?.sizeMode || 'half';
  catCustomSizeInput.value = settings.catDisplay?.customSize || 50;
  catCustomSizeValue.textContent = `${catCustomSizeInput.value}%`;
  catOffsetXInput.value = settings.customCat?.offsetX || 0;
  catOffsetYInput.value = settings.customCat?.offsetY || 0;
  petEnabledInput.checked = settings.pet?.enabled === true;
  renderTasks();
  renderCatPreview();
  applyTranslations();
  syncAllDurationControls();
  renderEnabledReminderSummary();
}

function formatDuration(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatClock(dateString) {
  if (!dateString) return '--:--';
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateString));
}

function formatDateTime(dateString) {
  if (!dateString) return t('taskNoAutoReminder');
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateString));
}

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = value;
}

function setCheckboxLabel(input, value) {
  const labelText = input.closest('.check-row')?.querySelector('span');
  if (labelText) labelText.textContent = value;
}

function applyTranslations() {
  setText('.hero .eyebrow', t('heroEyebrow'));
  setText('.hero-copy p', t('heroTagline'));
  setText('#onboardingPanel .eyebrow', t('suggestedStart'));
  setText('#onboardingPanel strong', t('suggestedCopy'));
  setText('#completeOnboardingBtn', t('useDefaults'));
  setText('.status-card .eyebrow', t('today'));
  setText('.card-heading .eyebrow', t('controlCenter'));
  setText('.card-heading h2', t('reminderSetup'));
  setText('#breakNowBtn span', t('summonCat'));
  setText('[data-panel-target="timersPanel"] span', t('timers'));
  setText('[data-panel-target="tasksPanel"] span', t('tasks'));
  setText('[data-panel-target="catPanel"] span', t('cat'));
  setText('[data-panel-target="settingsPanel"] span', t('settings'));
  setText('#timersPanel h3', t('timers'));
  setText('#timersPanel .sub-card-title span', t('timersHint'));
  setText('label[for="sedentaryInterval"]', t('everyActiveMinutes'));
  setText('label[for="idleThresholdMinutes"]', t('idleReset'));
  setText('label[for="hydrationInterval"]', t('everyMinutes'));
  setText('label[for="pomodoroFocus"]', t('focusMinutes'));
  setText('label[for="pomodoroBreak"]', t('breakMinutes'));
  setCheckboxLabel(sedentaryEnabledInput, t('standReminder'));
  setCheckboxLabel(hydrationEnabledInput, t('waterReminder'));
  setCheckboxLabel(pomodoroEnabledInput, t('pomodoro'));
  setText('#tasksPanel h3', t('tasks'));
  setText('#tasksPanel .sub-card-title span', t('tasksHint'));
  setText('label[for="taskTitle"]', t('task'));
  taskTitleInput.placeholder = t('taskPlaceholder');
  setText('#taskTemplateHint', t('taskTemplateHint'));
  renderTaskTemplateOptions();
  setText('label[for="taskTime"]', t('remindAt'));
  setText('#addTaskBtn', t('addTask'));
  setText('#catPanel h3', t('cat'));
  setText('#catPanel .sub-card-title span', t('catHint'));
  setCheckboxLabel(petEnabledInput, t('showDesktopPet'));
  setText('#petHelpText', t('desktopPetHelp'));
  setText('#chooseCatBtn', t('chooseCat'));
  setText('#clearCatBtn', t('useDefault'));
  setText('label[for="catSizeMode"]', t('catSize'));
  setText('label[for="catCustomSize"]', t('catCustomSize'));
  document.querySelectorAll('#catSizeMode [data-i18n-option]').forEach((option) => {
    option.textContent = t(option.dataset.i18nOption);
  });
  setText('label[for="catOffsetX"]', t('horizontalOffset'));
  setText('label[for="catOffsetY"]', t('verticalOffset'));
  setText('#settingsPanel h3', t('settings'));
  setText('#settingsPanel .sub-card-title span', t('settingsHint'));
  setText('label[for="languageSelect"]', t('language'));
  setText('label[for="reminderIntensity"]', t('reminderIntensity'));
  document.querySelectorAll('[data-i18n-option]').forEach((option) => {
    option.textContent = t(option.dataset.i18nOption);
  });
  const reminderIntensityValue = reminderIntensityInput.value;
  reminderIntensityInput.value = reminderIntensityValue;
  quickTaskTimeButtons.forEach((button) => {
    const minutes = Number.parseInt(button.dataset.taskOffsetMinutes, 10);
    button.textContent = minutes >= 60
      ? `+${minutes / 60}${t('hoursShort')}`
      : `+${minutes}${t('minutesShort')}`;
  });
  document.querySelectorAll('.advanced-fields summary').forEach((summary) => {
    summary.textContent = t('preciseSettings');
  });
  setText('label[for="breakTime"]', t('countdown'));
  setText('label[for="snoozeMinutes"]', t('snoozeDuration'));
  setText('#pause30Btn', t('pause30'));
  setText('#saveBtn span', t('save'));
  setText('#savedMsg', t('saved'));
  renderAppVersion();
  renderTimerState(currentTimerState);
  updateCatSizeControls();
  renderEnabledReminderSummary();
}

function renderAppVersion() {
  if (!appVersionText) return;
  appVersionText.textContent = currentAppInfo?.version
    ? t('appVersion', currentAppInfo.version)
    : t('appVersion', '--');
}

function updateCatSizeControls() {
  catCustomSizeField.hidden = catSizeModeInput.value !== 'custom';
  catCustomSizeValue.textContent = `${catCustomSizeInput.value}%`;
  renderCatPreview();
}

function toPreviewFileUrl(filePath) {
  if (!filePath) return '';
  if (/^(file|https?|data):/i.test(filePath)) return filePath;
  return encodeURI(`file://${filePath}`);
}

function getLocalDateTimeValue(date = new Date()) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
  return offsetDate.toISOString().slice(0, 16);
}

function updateTaskTimeMinimum() {
  taskTimeInput.min = getLocalDateTimeValue(new Date(Date.now() + 60 * 1000));
}

function renderTaskTemplateOptions() {
  if (!taskTemplateList) return;

  taskTemplateList.innerHTML = '';
  TASK_TEMPLATES.forEach((template) => {
    const option = document.createElement('option');
    option.value = taskTemplateLabel(template);
    option.dataset.templateKey = template.key;
    taskTemplateList.appendChild(option);
  });
}

function applySelectedTaskTemplate() {
  const selectedTemplate = TASK_TEMPLATES.find((template) =>
    taskTitleInput.value.trim() === taskTemplateLabel(template)
  );
  if (!selectedTemplate) return;

  taskTimeInput.value = getLocalDateTimeValue(
    new Date(Date.now() + selectedTemplate.offsetMinutes * 60 * 1000)
  );
  taskTimeError.textContent = '';
}

function syncDurationControl(control) {
  const input = document.getElementById(control.dataset.inputId);
  if (!input) return;

  const min = Number(input.min);
  const max = Number(input.max);
  const value = shared.clampNumber(input.value, min, max, Number(input.defaultValue || min));
  const progress = max > min ? (value - min) / (max - min) : 0;
  const dial = control.querySelector('.duration-dial');
  const valueText = control.querySelector('[data-duration-value]');

  control.style.setProperty('--duration-progress', progress.toFixed(4));
  control.dataset.value = String(value);
  if (valueText) valueText.textContent = String(value);
  if (dial) {
    dial.setAttribute('aria-valuemin', String(min));
    dial.setAttribute('aria-valuemax', String(max));
    dial.setAttribute('aria-valuenow', String(value));
    dial.setAttribute('aria-label', input.labels?.[0]?.textContent || input.id);
  }
}

function setDurationValue(input, rawValue) {
  const min = Number(input.min);
  const max = Number(input.max);
  const step = Number(input.step) || 1;
  const steppedValue = min + Math.round((rawValue - min) / step) * step;
  input.value = shared.clampNumber(steppedValue, min, max, Number(input.defaultValue || min));
  syncAllDurationControls();
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function syncAllDurationControls() {
  durationControls.forEach(syncDurationControl);
  updateDurationPresetStates();
  updateTimerCardStates();
}

function updateDurationPresetStates() {
  durationPresetButtons.forEach((button) => {
    const input = document.getElementById(button.dataset.inputId);
    const presetValue = Number.parseInt(button.dataset.durationPreset, 10);
    const isActive = Boolean(input) && Number(input.value) === presetValue;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
}

function updateTimerCardStates() {
  const states = {
    sedentary: sedentaryEnabledInput.checked,
    hydration: hydrationEnabledInput.checked,
    pomodoro: pomodoroEnabledInput.checked,
  };
  document.querySelectorAll('[data-timer-card]').forEach((card) => {
    card.classList.toggle('is-disabled', states[card.dataset.timerCard] === false);
  });
  renderEnabledReminderSummary(currentTimerState);
}

function setDurationFromPointer(control, event) {
  const input = document.getElementById(control.dataset.inputId);
  const dial = control.querySelector('.duration-dial');
  if (!input || !dial) return;

  const rect = dial.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const angle = Math.atan2(event.clientY - centerY, event.clientX - centerX);
  const normalized = ((angle + Math.PI / 2) / (Math.PI * 2) + 1) % 1;
  const min = Number(input.min);
  const max = Number(input.max);
  setDurationValue(input, min + normalized * (max - min));
}

function renderTimerState(state) {
  currentTimerState = state;
  const settings = currentSettings;

  if (!settings || !state) {
    return;
  }

  const statusItems = getStatusCountdownItems(settings, state);
  const primaryStatusCountdown = getPrimaryStatusCountdown(statusItems);
  const primaryCountdown = state.running
    ? (primaryStatusCountdown || state.primaryCountdown)
    : primaryStatusCountdown;
  const activeType = primaryCountdown?.type || (state.running ? state.activeReminder?.type : null) || 'manual';
  statusOrb?.setAttribute('data-reminder-type', activeType);
  statusOrb?.classList.toggle('is-paused', !state.running);
  timerStatus.textContent = state.running && state.activeReminder
    ? `${reminderLabel(state.activeReminder.type)} · ${state.activeReminder.title}`
    : state.running
      ? settings.reminders.pomodoro.enabled
        ? t('runningRhythm', state.pomodoroPhase)
        : t('runningReminders')
      : t('paused');
  const primarySeconds = primaryCountdown
    ? primaryCountdown.remainingSeconds
    : state.nextReminderAt
      ? Math.max(0, Math.ceil((new Date(state.nextReminderAt).getTime() - Date.now()) / 1000))
      : 0;
  timerTime.textContent = primaryCountdown || primarySeconds > 0
    ? formatDuration(primarySeconds)
    : '--:--';
  const ringProgress = primaryCountdown?.totalSeconds > 0
    ? Math.min(1, Math.max(0, primarySeconds / primaryCountdown.totalSeconds))
    : primaryCountdown?.progress || 0;
  statusOrb?.style.setProperty('--timer-progress', String(ringProgress));
  if (statusTypeIcon) {
    statusTypeIcon.innerHTML = reminderIconSvg(activeType);
    statusTypeIcon.setAttribute('aria-label', reminderLabel(activeType));
  }
  nextReminderText.textContent = state.nextReminderAt
    ? t('nextReminder', formatClock(state.nextReminderAt))
    : t('noNextReminder');
  timerQueueText.textContent = state.queue?.length
    ? t('queuedReminders', state.queue.length)
    : '';
  renderEnabledReminderSummary(state);
  const standCount = state.stats?.sedentaryCompletedCount || 0;
  const waterCount = state.stats?.hydrationCompletedCount || 0;
  const focusCount = state.stats?.pomodoroCompletedCount || 0;
  const statsSummary = t('todayStats', standCount, waterCount, focusCount);
  const totalHealthyActions = standCount + waterCount + focusCount;
  todayStatsText.textContent = totalHealthyActions === 0
    ? t('todayStatsEmpty')
    : totalHealthyActions >= 3
    ? `${statsSummary} · ${t('todayStatsWin')}`
    : statsSummary;
  timerToggleLabel.textContent = state.running ? t('pauseReminders') : t('startReminders');
  timerToggleBtn.classList.toggle('is-running', state.running);
}

function renderTasks() {
  const tasks = [...(currentSettings?.tasks || [])].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (!a.remindAt && !b.remindAt) return 0;
    if (!a.remindAt) return 1;
    if (!b.remindAt) return -1;
    return Date.parse(a.remindAt) - Date.parse(b.remindAt);
  });
  taskList.innerHTML = '';

  if (tasks.length === 0) {
    taskList.innerHTML = `<p class="empty-state">${t('noTasks')}</p>`;
    return;
  }

  const hasCompleted = tasks.some((task) => task.done);

  tasks.forEach((task) => {
    const item = document.createElement('div');
    item.className = `task-item${task.done ? ' is-done' : ''}`;
    item.innerHTML = `
      <div>
        <strong></strong>
        <span>${task.remindAt ? formatDateTime(task.remindAt) : t('taskNoAutoReminder')}</span>
      </div>
      <div class="task-actions">
        <button type="button" class="secondary task-done-btn">${task.done ? t('done') : t('markDone')}</button>
        <button type="button" class="secondary task-delete-btn" aria-label="${t('deleteTask')}">&times;</button>
      </div>
    `;
    item.querySelector('strong').textContent = task.title;
    item.querySelector('.task-done-btn').addEventListener('click', async () => {
      currentSettings = await api.completeTask(task.id);
      applySettingsToForm(currentSettings);
    });
    item.querySelector('.task-delete-btn').addEventListener('click', async () => {
      currentSettings = await api.saveSettings({
        ...readSettingsFromForm(),
        tasks: currentSettings.tasks.filter((t) => t.id !== task.id),
      });
      applySettingsToForm(currentSettings);
    });
    taskList.appendChild(item);
  });

  if (hasCompleted) {
    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'secondary clear-completed-btn';
    clearBtn.textContent = t('clearCompleted');
    clearBtn.addEventListener('click', async () => {
      currentSettings = await api.saveSettings({
        ...readSettingsFromForm(),
        tasks: currentSettings.tasks.filter((task) => !task.done),
      });
      applySettingsToForm(currentSettings);
    });
    taskList.appendChild(clearBtn);
  }
}

function renderCatPreview() {
  const customCat = currentSettings?.customCat;
  const offsetX = shared.clampNumber(catOffsetXInput.value, -40, 40, 0);
  const offsetY = shared.clampNumber(catOffsetYInput.value, -40, 40, 0);
  const customSize = shared.clampNumber(catCustomSizeInput.value, 20, 100, 50);
  const sizeScale = catSizeModeInput.value === 'screen'
    ? 1.15
    : catSizeModeInput.value === 'quarter'
      ? 0.62
      : catSizeModeInput.value === 'custom'
        ? customSize / 55
        : 0.86;

  catPreviewLabel.textContent = customCat
    ? t('usingCat', customCat.name)
    : t('defaultCat');
  catPreviewImage.alt = t('catPreviewAlt');

  const transform = `translate(${offsetX * 0.28}px, ${offsetY * 0.28}px) scale(${sizeScale.toFixed(2)})`;
  catPreviewImage.style.transform = transform;
  catPreviewVideo.style.transform = transform;

  if (!customCat) {
    catPreviewVideo.pause();
    catPreviewVideo.removeAttribute('src');
    catPreviewVideo.hidden = true;
    catPreviewImage.hidden = false;
    catPreviewImage.src = '../../assets/break-neko-icon128.png';
    return;
  }

  const previewUrl = toPreviewFileUrl(customCat.path);

  if (customCat.kind === 'video') {
    catPreviewImage.hidden = true;
    catPreviewVideo.hidden = false;
    if (catPreviewVideo.src !== previewUrl) {
      catPreviewVideo.src = previewUrl;
    }
    catPreviewVideo.play().catch(() => {});
    return;
  }

  catPreviewVideo.pause();
  catPreviewVideo.hidden = true;
  catPreviewImage.hidden = false;
  catPreviewImage.src = previewUrl;
}

function showSavedMessage() {
  savedMsg.style.display = 'block';
  setTimeout(() => {
    savedMsg.style.display = 'none';
  }, 1800);
}

async function saveSettings({ showMessage = true } = {}) {
  const settings = readSettingsFromForm();
  const normalizedSettings = await api.saveSettings(settings);
  applySettingsToForm(normalizedSettings);
  currentTimerState = await api.getTimerState();
  renderTimerState(currentTimerState);

  if (showMessage) {
    showSavedMessage();
  }

  return normalizedSettings;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  await saveSettings();
});

languageSelect.addEventListener('change', () => {
  currentSettings = {
    ...currentSettings,
    language: languageSelect.value,
  };
  document.documentElement.lang = languageSelect.value === 'zh' ? 'zh-CN' : 'en';
  applyTranslations();
  api.saveSettings(readSettingsFromForm()).catch((error) => {
    console.error('Failed to persist language setting:', error);
  });
});

function activateTab(button, { focus = false } = {}) {
  tabButtons.forEach((tabButton) => {
    const isActive = tabButton === button;
    tabButton.classList.toggle('is-active', isActive);
    tabButton.setAttribute('aria-selected', String(isActive));
    tabButton.tabIndex = isActive ? 0 : -1;
  });

  panels.forEach((panel) => {
    const isActive = panel.id === button.dataset.panelTarget;
    panel.hidden = !isActive;
    panel.classList.toggle('is-active', isActive);
  });

  if (focus) {
    button.focus();
  }
}

tabButtons.forEach((button, index) => {
  button.addEventListener('click', () => activateTab(button));
  button.addEventListener('keydown', (event) => {
    const lastIndex = tabButtons.length - 1;
    const keyTargetIndex = {
      ArrowRight: index === lastIndex ? 0 : index + 1,
      ArrowDown: index === lastIndex ? 0 : index + 1,
      ArrowLeft: index === 0 ? lastIndex : index - 1,
      ArrowUp: index === 0 ? lastIndex : index - 1,
      Home: 0,
      End: lastIndex,
    }[event.key];

    if (keyTargetIndex === undefined) return;
    event.preventDefault();
    activateTab(tabButtons[keyTargetIndex], { focus: true });
  });
});

timerToggleBtn.addEventListener('click', async () => {
  if (currentTimerState?.running) {
    renderTimerState(await api.pauseTimer());
    return;
  }

  await saveSettings({ showMessage: false });
  renderTimerState(await api.startTimer());
});

document.getElementById('breakNowBtn').addEventListener('click', async () => {
  try {
    await saveSettings({ showMessage: false });
  } catch (error) {
    console.error('Failed to save settings before starting a break:', error);
  }

  renderTimerState(await api.triggerBreakNow());
});

document.getElementById('pause30Btn').addEventListener('click', async () => {
  applySettingsToForm(await api.setDnd(30));
  showSavedMessage();
});

document.getElementById('addTaskBtn').addEventListener('click', async () => {
  const title = taskTitleInput.value.trim();
  if (!title) return;
  updateTaskTimeMinimum();
  taskTimeError.textContent = '';

  if (taskTimeInput.value && new Date(taskTimeInput.value).getTime() <= Date.now()) {
    taskTimeError.textContent = t('pastTaskTime');
    taskTimeInput.focus();
    return;
  }

  const task = {
    id: `task-${Date.now()}`,
    title,
    remindAt: taskTimeInput.value ? new Date(taskTimeInput.value).toISOString() : '',
    done: false,
  };
  currentSettings = await api.saveSettings({
    ...readSettingsFromForm(),
    tasks: [...(currentSettings.tasks || []), task],
  });
  taskTitleInput.value = '';
  taskTimeInput.value = '';
  applySettingsToForm(currentSettings);
  showSavedMessage();
});

taskTimeInput.addEventListener('focus', updateTaskTimeMinimum);
taskTimeInput.addEventListener('change', () => {
  if (!taskTimeInput.value || new Date(taskTimeInput.value).getTime() > Date.now()) {
    taskTimeError.textContent = '';
  }
});

quickTaskTimeButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const minutes = Number.parseInt(button.dataset.taskOffsetMinutes, 10);
    taskTimeInput.value = getLocalDateTimeValue(new Date(Date.now() + minutes * 60 * 1000));
    taskTimeError.textContent = '';
    quickTaskTimeButtons.forEach((timeButton) => {
      const isActive = timeButton === button;
      timeButton.classList.toggle('is-active', isActive);
      timeButton.setAttribute('aria-pressed', String(isActive));
    });
  });
});

taskTitleInput.addEventListener('input', applySelectedTaskTemplate);
taskTitleInput.addEventListener('change', applySelectedTaskTemplate);

durationControls.forEach((control) => {
  control.querySelectorAll('[data-duration-step]').forEach((button) => {
    button.addEventListener('click', () => {
      const input = document.getElementById(control.dataset.inputId);
      if (!input) return;
      const step = Number.parseInt(button.dataset.durationStep, 10) || Number(input.step) || 1;
      setDurationValue(input, Number(input.value) + step);
    });
  });

  const dial = control.querySelector('.duration-dial');
  let isDraggingDial = false;
  dial?.addEventListener('pointerdown', (event) => {
    isDraggingDial = true;
    dial.setPointerCapture(event.pointerId);
    setDurationFromPointer(control, event);
  });
  dial?.addEventListener('pointermove', (event) => {
    if (!isDraggingDial) return;
    setDurationFromPointer(control, event);
  });
  dial?.addEventListener('pointerup', (event) => {
    isDraggingDial = false;
    dial.releasePointerCapture(event.pointerId);
  });
  dial?.addEventListener('pointercancel', () => {
    isDraggingDial = false;
  });
  dial?.addEventListener('keydown', (event) => {
    const input = document.getElementById(control.dataset.inputId);
    if (!input) return;

    const baseStep = Number(input.step) || 1;
    const keyStep = {
      ArrowUp: baseStep,
      ArrowRight: baseStep,
      ArrowDown: -baseStep,
      ArrowLeft: -baseStep,
      PageUp: baseStep * 5,
      PageDown: -baseStep * 5,
      Home: Number(input.min) - Number(input.value),
      End: Number(input.max) - Number(input.value),
    }[event.key];
    if (keyStep === undefined) return;
    event.preventDefault();
    setDurationValue(input, Number(input.value) + keyStep);
  });
});

durationPresetButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const input = document.getElementById(button.dataset.inputId);
    if (!input) return;
    setDurationValue(input, Number.parseInt(button.dataset.durationPreset, 10));
  });
});

let autoSaveTimer = null;
function scheduleAutoSave() {
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    saveSettings().catch((error) => {
      console.error('Auto-save failed:', error);
    });
  }, 800);
}

form.addEventListener('change', (event) => {
  if (event.target === languageSelect) return;
  currentSettings = readSettingsFromForm();
  syncAllDurationControls();
  renderEnabledReminderSummary();
  scheduleAutoSave();
});

catSizeModeInput.addEventListener('change', updateCatSizeControls);
catCustomSizeInput.addEventListener('input', () => {
  updateCatSizeControls();
  scheduleAutoSave();
});

document.getElementById('chooseCatBtn').addEventListener('click', async () => {
  applySettingsToForm(await api.chooseCustomCat());
});

document.getElementById('clearCatBtn').addEventListener('click', async () => {
  applySettingsToForm(await api.clearCustomCat());
});

document.getElementById('completeOnboardingBtn').addEventListener('click', async () => {
  applySettingsToForm(await api.completeOnboarding());
});

api.onTimerState((state) => {
  renderTimerState(state);
});

(async function init() {
  updateTaskTimeMinimum();
  currentAppInfo = await api.getAppInfo();
  applySettingsToForm(await api.getSettings());
  renderTimerState(await api.getTimerState());
})();
