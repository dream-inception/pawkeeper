const api = window.breakNeko;
const countdown = document.getElementById('break-neko-countdown');
const reminderType = document.getElementById('reminderType');
const reminderIcon = document.getElementById('reminderIcon');
const reminderMessage = document.getElementById('reminderMessage');
const catStill = document.getElementById('catStill');
const customCatImage = document.getElementById('customCatImage');
const customCatVideo = document.getElementById('customCatVideo');
const catRun = document.getElementById('catRun');
const catSleep = document.getElementById('catSleep');
const fallback = document.getElementById('assetFallback');
const fallbackCat = document.getElementById('fallbackCat');
const fallbackTitle = document.getElementById('fallbackTitle');
const fallbackMessage = document.getElementById('fallbackMessage');
const dismissBtn = document.getElementById('dismissBtn');
const snoozeBtn = document.getElementById('snoozeBtn');
const shortcutHint = document.getElementById('shortcutHint');

const params = new URLSearchParams(window.location.search);
const language = params.get('language') === 'zh' ? 'zh-CN' : 'en';
const presentation = params.get('presentation') === 'fullscreen' ? 'fullscreen' : 'overlay';
const allowMousePassthrough = params.get('allowMousePassthrough') === '1';
const reminderKind = params.get('reminderType') || 'manual';
const snoozeMinutes = Math.max(1, Number.parseInt(params.get('snoozeMinutes'), 10) || 5);
let seconds = Math.max(1, Number.parseInt(params.get('breakMinutes'), 10) || 5) * 60;
let countdownTimer;
let sleepStarted = false;

const mediaSources = {
  neko1: params.get('neko1') || '../../assets/neko1.webm',
  neko2: params.get('neko2') || '../../assets/neko2.webm',
  icon: params.get('icon') || '../../assets/break-neko-icon128.png',
  customCat: params.get('customCat') || '',
  customCatKind: params.get('customCatKind') || '',
};
const customCatOffsetX = Number.parseInt(params.get('customCatOffsetX'), 10) || 0;
const customCatOffsetY = Number.parseInt(params.get('customCatOffsetY'), 10) || 0;
const catSizeMode = params.get('catSizeMode') || 'half';
const catCustomSize = Number.parseInt(params.get('catCustomSize'), 10) || 50;
const catSizePresets = {
  // The default cat videos include transparent padding. These values compensate
  // so the visible cat roughly matches the user's intended screen coverage.
  screen: 118,
  half: 66,
  quarter: 34,
  custom: catCustomSize * 1.25,
};
const catSize = Math.min(Math.max(catSizePresets[catSizeMode] || 66, 26), 132);
const layoutOriginX = Number.parseFloat(params.get('layoutOriginX')) || 0;
const layoutWidth = Number.parseFloat(params.get('layoutWidth')) || 0;

document.documentElement.lang = language;
document.body.classList.add(`presentation-${presentation}`);
document.body.classList.add(`reminder-${reminderKind}`);
document.documentElement.style.setProperty('--cat-size', `${catSize}vw`);
document.documentElement.style.setProperty('--cat-max-height', `${Math.max(28, Math.min(catSize, presentation === 'overlay' ? 78 : 104))}vh`);
document.documentElement.style.setProperty('--custom-cat-visual-shift-x', '0vw');

const usesCustomCat = Boolean(mediaSources.customCat);
const overlayCenterOffset = usesCustomCat ? '0vw' : '-6vw';
document.documentElement.style.setProperty(
  '--cat-center-offset',
  presentation === 'overlay' ? overlayCenterOffset : '0vw'
);

function updateLayoutCenter() {
  const width = layoutWidth > 0 ? layoutWidth : window.innerWidth;
  const centerX = layoutOriginX + (width / 2);
  document.documentElement.style.setProperty('--layout-center-x', `${centerX}px`);
}

function measureOpaqueCenterRatio(media) {
  const width = media.videoWidth || media.naturalWidth;
  const height = media.videoHeight || media.naturalHeight;
  if (!width || !height) {
    return null;
  }

  const sampleWidth = Math.min(width, 640);
  const sampleHeight = Math.min(height, 640);
  const canvas = document.createElement('canvas');
  canvas.width = sampleWidth;
  canvas.height = sampleHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    return null;
  }

  context.drawImage(media, 0, 0, sampleWidth, sampleHeight);
  const { data } = context.getImageData(0, 0, sampleWidth, sampleHeight);
  let minX = sampleWidth;
  let maxX = -1;

  for (let y = 0; y < sampleHeight; y += 2) {
    for (let x = 0; x < sampleWidth; x += 2) {
      const alpha = data[(y * sampleWidth + x) * 4 + 3];
      if (alpha > 16) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
      }
    }
  }

  if (maxX < minX) {
    return null;
  }

  return ((minX + maxX) / 2) / sampleWidth;
}

function applyCustomCatVisualCentering() {
  if (!usesCustomCat || presentation !== 'overlay') {
    return;
  }

  const media = customCatVideo.classList.contains('is-visible')
    ? customCatVideo
    : (customCatImage.classList.contains('is-visible') ? customCatImage : null);
  if (!media) {
    return;
  }

  const centerRatio = measureOpaqueCenterRatio(media);
  if (centerRatio == null) {
    return;
  }

  const rect = media.getBoundingClientRect();
  const visualCenterX = rect.left + (rect.width * centerRatio);
  const layoutCenterX = layoutWidth > 0
    ? layoutOriginX + (layoutWidth / 2)
    : window.innerWidth / 2;
  const deltaVw = ((layoutCenterX - visualCenterX) / window.innerWidth) * 100;
  document.documentElement.style.setProperty('--custom-cat-visual-shift-x', `${deltaVw}vw`);
}

function scheduleCustomCatVisualCentering() {
  requestAnimationFrame(() => {
    applyCustomCatVisualCentering();
    requestAnimationFrame(applyCustomCatVisualCentering);
  });
}

updateLayoutCenter();
window.addEventListener('resize', () => {
  updateLayoutCenter();
  scheduleCustomCatVisualCentering();
});

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

reminderIcon.innerHTML = reminderIconSvg(reminderKind);
reminderType.textContent = params.get('title') || 'Cat reminder';
reminderMessage.textContent = params.get('message') || 'Take a gentle pause.';
dismissBtn.querySelector('span').textContent = params.get('actionLabel') || 'Done';
snoozeBtn.querySelector('span').textContent = params.get('snoozeLabel') || 'Snooze 5m';
dismissBtn.setAttribute('aria-label', params.get('actionLabel') || 'Done');
snoozeBtn.setAttribute('aria-label', params.get('snoozeLabel') || 'Snooze 5m');
fallbackTitle.textContent = params.get('fallbackTitle') || 'Cat break time';
fallbackMessage.textContent = params.get('fallbackMessage') || 'The cat video asset could not be loaded, but your break is still running.';
shortcutHint.textContent = params.get('shortcutHint') || 'Press Esc to skip';
catStill.alt = params.get('catAlt') || 'Cat';
fallbackCat.alt = params.get('catAlt') || 'Cat';
customCatImage.alt = params.get('customCatAlt') || 'Custom cat';

catStill.src = mediaSources.icon;
fallbackCat.src = mediaSources.icon;
catRun.src = mediaSources.neko1;
catSleep.src = mediaSources.neko2;

if (mediaSources.customCat) {
  document.documentElement.style.setProperty('--custom-cat-offset-x', `${customCatOffsetX}vw`);
  document.documentElement.style.setProperty('--custom-cat-offset-y', `${customCatOffsetY}vh`);
  catRun.classList.add('is-hidden');
  catSleep.classList.add('is-hidden');

  if (mediaSources.customCatKind === 'video') {
    customCatVideo.src = mediaSources.customCat;
    customCatVideo.classList.add('is-visible');
  } else {
    customCatImage.src = mediaSources.customCat;
    customCatImage.classList.add('is-visible');
  }
}

function formatDuration(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

function updateCountdown() {
  countdown.textContent = formatDuration(seconds);

  if (seconds <= 0) {
    finishBreak();
    return;
  }

  seconds -= 1;
  countdownTimer = setTimeout(updateCountdown, 1000);
}

function showFallback() {
  fallback.style.display = 'block';
  catStill.classList.add('is-visible');
}

function finishBreak() {
  clearTimeout(countdownTimer);
  api.finishBreak();
}

function snoozeBreak() {
  clearTimeout(countdownTimer);
  api.snoozeReminder(snoozeMinutes);
}

function setMousePassthrough(enabled) {
  if (!allowMousePassthrough || typeof api.setBreakMousePassthrough !== 'function') {
    return;
  }

  api.setBreakMousePassthrough(enabled).catch(() => {});
}

function setupOverlayPassthrough() {
  if (presentation !== 'overlay' || !allowMousePassthrough) return;

  const interactiveRegions = [
    document.querySelector('.break-hud'),
    document.querySelector('.break-actions'),
  ].filter(Boolean);

  interactiveRegions.forEach((region) => {
    region.addEventListener('mouseenter', () => setMousePassthrough(false));
    region.addEventListener('mouseleave', () => setMousePassthrough(true));
    region.addEventListener('focusin', () => setMousePassthrough(false));
    region.addEventListener('focusout', () => setMousePassthrough(true));
  });

  setMousePassthrough(true);
}

function showDefaultCat() {
  customCatImage.classList.remove('is-visible');
  customCatVideo.classList.remove('is-visible');
  catRun.classList.remove('is-hidden');
  catSleep.classList.remove('is-hidden');
  catSleep.classList.remove('sleeping');
  catRun.play().catch(() => {
    showFallback();
  });
}

catRun.addEventListener('ended', () => {
  catSleep.classList.add('sleeping');
  catSleep.play().catch(() => {
    // Keep the final frame of the first video visible if the sleep loop cannot start.
    showFallback();
  });
});

catRun.addEventListener('playing', () => {
  catStill.classList.remove('is-visible');
});

catSleep.addEventListener('playing', () => {
  sleepStarted = true;
  catRun.classList.add('is-hidden');
  catStill.classList.remove('is-visible');
  fallback.style.display = 'none';
});

catRun.addEventListener('error', () => {
  showFallback();
});

catSleep.addEventListener('error', () => {
  if (!sleepStarted) {
    showFallback();
  }
});

customCatImage.addEventListener('load', () => {
  fallback.style.display = 'none';
  scheduleCustomCatVisualCentering();
});
customCatImage.addEventListener('error', showDefaultCat);
customCatVideo.addEventListener('error', showDefaultCat);
customCatVideo.addEventListener('loadeddata', scheduleCustomCatVisualCentering);
customCatVideo.addEventListener('playing', () => {
  fallback.style.display = 'none';
  scheduleCustomCatVisualCentering();
});

setTimeout(() => {
  if (catRun.readyState < HTMLMediaElement.HAVE_CURRENT_DATA && !mediaSources.customCat) {
    catStill.classList.add('is-visible');
  }
}, 1200);

setTimeout(() => {
  if (catRun.ended && !sleepStarted && !mediaSources.customCat) {
    showFallback();
  }
}, 12500);

setTimeout(() => {
  if (mediaSources.customCat && mediaSources.customCatKind === 'video' && customCatVideo.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    showDefaultCat();
  }
}, 1200);

dismissBtn.addEventListener('click', finishBreak);
snoozeBtn.addEventListener('click', snoozeBreak);
window.addEventListener('beforeunload', () => setMousePassthrough(false));

setupOverlayPassthrough();
updateCountdown();
