const api = window.breakNeko;
const petIcon = document.getElementById('petIcon');
const petBubble = document.getElementById('petBubble');
const params = new URLSearchParams(window.location.search);
const language = params.get('language') === 'zh' ? 'zh' : 'en';

const copy = {
  en: {
    focus: 'Focus',
    break: 'Break time',
    hydration: 'Water',
    sedentary: 'Stretch',
    task: 'Task',
    manual: 'Break',
  },
  zh: {
    focus: '专注中',
    break: '休息中',
    hydration: '喝水',
    sedentary: '活动',
    task: '待办',
    manual: '休息',
  },
};

if (params.get('icon')) {
  petIcon.src = params.get('icon');
}

function t(key) {
  return copy[language]?.[key] || copy.en[key];
}

function setBubble(text) {
  if (!text) {
    petBubble.hidden = true;
    return;
  }
  petBubble.textContent = text;
  petBubble.hidden = false;
}

function refreshBubble(state) {
  if (!state?.running) {
    setBubble('');
    return;
  }
  if (state.activeReminder?.type) {
    setBubble(t(state.activeReminder.type));
    return;
  }
  if (state.primaryCountdown?.source === 'pomodoro') {
    setBubble(state.pomodoroPhase === 'break' ? t('break') : t('focus'));
    return;
  }
  setBubble('');
}

petIcon.addEventListener('dblclick', () => {
  api.triggerBreakNow().catch(() => {});
});

api.getTimerState().then(refreshBubble).catch(() => {});
api.onTimerState?.(refreshBubble);
