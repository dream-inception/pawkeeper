(function attachShared(root, factory) {
  const shared = factory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = shared;
  }

  root.BreakNekoShared = shared;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  const DEFAULT_SETTINGS = Object.freeze({
    catEnabled: true,
    breakTime: 5,
  });

  function clampNumber(value, min, max, fallback) {
    const parsedValue = Number.parseInt(value, 10);

    if (Number.isNaN(parsedValue)) {
      return fallback;
    }

    return Math.min(Math.max(parsedValue, min), max);
  }

  function normalizeSettings(settings) {
    const safeSettings = settings && typeof settings === 'object' ? settings : {};

    return {
      catEnabled: true,
      breakTime: clampNumber(
        safeSettings.breakTime,
        1,
        60,
        DEFAULT_SETTINGS.breakTime
      ),
    };
  }

  return {
    DEFAULT_SETTINGS,
    clampNumber,
    normalizeSettings,
  };
});
