const path = require('node:path');
const fs = require('node:fs');

function createAutomationTestRunner({
  app,
  breakWindowController,
  getDistPath,
  getMainWindow,
  env = process.env,
}) {
  function runStartupAutomation() {
    const mainWindow = getMainWindow();

    if (env.BREAK_NEKO_BUTTON_TEST) {
      runBreakButtonTest(mainWindow);
      return true;
    }
    if (env.BREAK_NEKO_INTERACTION_TEST) {
      runInteractionTest(mainWindow);
      return true;
    }
    if (env.BREAK_NEKO_COUNTDOWN_TEST) {
      runCountdownTest(mainWindow);
      return true;
    }
    if (env.BREAK_NEKO_UI_TEST) {
      runUiTest(mainWindow);
      return true;
    }
    if (env.BREAK_NEKO_VISUAL_TEST) {
      mainWindow.hide();
      runVisualTest();
      return true;
    }
    if (env.BREAK_NEKO_LAYOUT_DIAG) {
      mainWindow.hide();
      runLayoutDiagnostic();
      return true;
    }
    if (env.BREAK_NEKO_SMOKE_TEST === '1') {
      setTimeout(() => {
        app.isQuitting = true;
        app.quit();
      }, 1000);
      return true;
    }

    return false;
  }

  function runVisualTest() {
    breakWindowController.showBreakWindow({
      testMode: false,
      presentation: 'overlay',
      onDidFinishLoad: (breakWindow) => {
        setTimeout(async () => {
          const screenshotPath = env.BREAK_NEKO_VISUAL_TEST === '1'
            ? getDistPath('break-visual-test.png')
            : env.BREAK_NEKO_VISUAL_TEST;
          fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
          const image = await breakWindow.webContents.capturePage();
          fs.writeFileSync(screenshotPath, image.toPNG());
          console.log(`Visual test screenshot: ${screenshotPath}`);
          app.isQuitting = true;
          app.quit();
        }, getVisualTestDelay());
      },
    });
  }

  function runLayoutDiagnostic() {
    const label = env.BREAK_NEKO_LAYOUT_DIAG || 'overlay';
    const skipAllWorkspaces = env.BREAK_NEKO_LAYOUT_DIAG_NO_ALL_WORKSPACES === '1';
    breakWindowController.showBreakWindow({
      testMode: false,
      presentation: 'overlay',
      skipAllWorkspaces,
      onDidFinishLoad: () => {
        const delay = getVisualTestDelay();
        setTimeout(async () => {
          try {
            await breakWindowController.captureBreakLayoutSample(label, getDistPath('layout-diag'));
          } catch (error) {
            console.error('[layout-diag] failed:', error);
            process.exitCode = 1;
          } finally {
            app.isQuitting = true;
            app.quit();
          }
        }, delay);
      },
    });
  }

  function getVisualTestDelay() {
    const delay = Number.parseInt(env.BREAK_NEKO_VISUAL_TEST_DELAY_MS, 10);
    return Number.isFinite(delay) && delay > 0 ? delay : 3500;
  }

  function getButtonTestScreenshotPath() {
    return env.BREAK_NEKO_BUTTON_TEST === '1'
      ? getDistPath('button-break-test.png')
      : env.BREAK_NEKO_BUTTON_TEST;
  }

  function runBreakButtonTest(mainWindow) {
    mainWindow.webContents.once('did-finish-load', async () => {
      try {
        await mainWindow.webContents.executeJavaScript(
          "document.getElementById('breakNowBtn').click()"
        );

        setTimeout(async () => {
          const breakWindow = breakWindowController.getBreakWindow();
          if (!breakWindow || breakWindow.isDestroyed()) {
            throw new Error('Break window was not created by the Take a Break Now button.');
          }

          const screenshotPath = getButtonTestScreenshotPath();
          fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
          const image = await breakWindow.webContents.capturePage();
          fs.writeFileSync(screenshotPath, image.toPNG());
          console.log(`Button test screenshot: ${screenshotPath}`);
          if (env.BREAK_NEKO_BUTTON_TEST_ACTION) {
            if (env.BREAK_NEKO_BUTTON_TEST_ACTION === 'escape') {
              breakWindow.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
              breakWindow.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' });
            } else {
              const actionSelector = env.BREAK_NEKO_BUTTON_TEST_ACTION === 'snooze'
                ? '#snoozeBtn'
                : '#dismissBtn';
              await breakWindow.webContents.executeJavaScript(`document.querySelector(${JSON.stringify(actionSelector)}).click()`);
            }
            await new Promise((resolve) => setTimeout(resolve, 700));
            if (breakWindowController.getBreakWindow() && !breakWindowController.getBreakWindow().isDestroyed()) {
              throw new Error(`${env.BREAK_NEKO_BUTTON_TEST_ACTION} did not close the break window.`);
            }
            console.log(`Button action test passed: ${env.BREAK_NEKO_BUTTON_TEST_ACTION}`);
          }
          app.isQuitting = true;
          app.quit();
        }, getVisualTestDelay());
      } catch (error) {
        console.error(error);
        app.isQuitting = true;
        app.quit();
      }
    });
  }

  function runInteractionTest(mainWindow) {
    mainWindow.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        const result = await mainWindow.webContents.executeJavaScript(`
          (async () => {
            const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
            const timerButton = document.getElementById('timerToggleBtn');
            const languageSelect = document.getElementById('languageSelect');
            const taskTitle = document.getElementById('taskTitle');
            const taskTime = document.getElementById('taskTime');
            const addTask = document.getElementById('addTaskBtn');
            const taskTimeError = document.getElementById('taskTimeError');
            const hydrationInterval = document.getElementById('hydrationInterval');
            const pomodoroEnabled = document.getElementById('pomodoroEnabled');
            const saveButton = document.getElementById('saveBtn');
            const timerTime = document.getElementById('timerTime');

            languageSelect.value = 'en';
            languageSelect.dispatchEvent(new Event('change', { bubbles: true }));
            await wait(100);
            hydrationInterval.value = '5';
            pomodoroEnabled.checked = false;
            saveButton.click();
            await wait(300);

            if (/pause|暂停/i.test(document.getElementById('timerToggleLabel').textContent)) {
              timerButton.click();
              await wait(400);
            }

            timerButton.click();
            await wait(400);
            const afterStart = document.getElementById('timerToggleLabel').textContent;
            const timerCountdown = timerTime.textContent;
            timerButton.click();
            await wait(400);
            const afterPause = document.getElementById('timerToggleLabel').textContent;

            languageSelect.value = 'zh';
            languageSelect.dispatchEvent(new Event('change', { bubbles: true }));
            await wait(100);
            const language = document.documentElement.lang;
            const intensityOptionText = Array.from(document.querySelectorAll('#reminderIntensity option')).map((option) => option.textContent).join('|');
            const taskTimeMin = taskTime.min;

            taskTitle.value = 'Past task';
            taskTime.value = '2000-01-01T09:00';
            addTask.click();
            await wait(100);

            return {
              afterStart,
              afterPause,
              timerCountdown,
              language,
              intensityOptionText,
              taskTimeMin,
              taskTimeError: taskTimeError.textContent,
            };
          })()
        `);

        const passed = /pause/i.test(result.afterStart) &&
          /start|开始/.test(result.afterPause.toLowerCase()) &&
          /^[45]:/.test(result.timerCountdown) &&
          result.language === 'zh-CN' &&
          result.intensityOptionText.includes('系统通知') &&
          result.taskTimeMin &&
          result.taskTimeError;

        if (!passed) {
          throw new Error(`Interaction test failed: ${JSON.stringify(result)}`);
        }

        console.log(`Interaction test passed: ${JSON.stringify(result)}`);
        app.isQuitting = true;
        app.quit();
      }, 1000);
    });
  }

  function runCountdownTest(mainWindow) {
    mainWindow.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        try {
          const result = await mainWindow.webContents.executeJavaScript(`
            (async () => {
              const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
              const api = window.breakNeko;
              const settings = await api.getSettings();
              await api.saveSettings({
                ...settings,
                language: 'zh',
                reminders: {
                  sedentary: { enabled: true, intervalMinutes: 45, idleThresholdMinutes: 1 },
                  hydration: { enabled: true, intervalMinutes: 5 },
                  pomodoro: { enabled: false, focusMinutes: 25, breakMinutes: 5 },
                },
                tasks: [],
              });
              const before = await api.startTimer();
              await wait(2500);
              const after = await api.getTimerState();
              const chips = Array.from(document.querySelectorAll('#statusReminderChips .reminder-chip'))
                .map((chip) => chip.textContent.trim().replace(/\\s+/g, ' '));
              const ringText = document.getElementById('timerTime')?.textContent || '';
              const ringProgress = Number.parseFloat(
                getComputedStyle(document.getElementById('statusOrb')).getPropertyValue('--timer-progress')
              );
              await api.pauseTimer();
              return {
                beforeHydration: before.hydrationRemainingSeconds,
                afterHydration: after.hydrationRemainingSeconds,
                beforeSedentary: before.sedentarySeconds,
                afterSedentary: after.sedentarySeconds,
                chips,
                ringProgress,
                ringText,
              };
            })()
          `);

          const passed = result.afterHydration < result.beforeHydration &&
            result.afterSedentary > result.beforeSedentary &&
            result.chips.some((text) => text.includes('喝水 4:5')) &&
            result.ringProgress > 0.95 &&
            /^4:5[0-9]$/.test(result.ringText);

          if (!passed) {
            throw new Error(`Countdown test failed: ${JSON.stringify(result)}`);
          }

          console.log(`Countdown test passed: ${JSON.stringify(result)}`);
        } catch (error) {
          console.error(error);
          process.exitCode = 1;
        } finally {
          app.isQuitting = true;
          app.quit();
        }
      }, 1000);
    });
  }

  function runUiTest(mainWindow) {
    mainWindow.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        if (env.BREAK_NEKO_UI_TEST_LANGUAGE) {
          await mainWindow.webContents.executeJavaScript(`
            (() => {
              const languageSelect = document.getElementById('languageSelect');
              if (!languageSelect) return false;
              languageSelect.value = ${JSON.stringify(env.BREAK_NEKO_UI_TEST_LANGUAGE)};
              languageSelect.dispatchEvent(new Event('change', { bubbles: true }));
              return document.documentElement.lang;
            })()
          `).catch((error) => {
            console.error(error);
          });
        }

        const screenshotPath = env.BREAK_NEKO_UI_TEST === '1'
          ? getDistPath('ui-test.png')
          : env.BREAK_NEKO_UI_TEST;
        fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
        const image = await mainWindow.webContents.capturePage();
        fs.writeFileSync(screenshotPath, image.toPNG());
        console.log(`UI test screenshot: ${screenshotPath}`);
        app.isQuitting = true;
        app.quit();
      }, 1000);
    });
  }

  return {
    runStartupAutomation,
  };
}

module.exports = {
  createAutomationTestRunner,
};
