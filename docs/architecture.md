# Architecture

Pawkeeper is a CommonJS Electron app with no frontend build step. Source
files are loaded directly by Electron, so paths and packaged asset locations are
kept explicit.

## Runtime Shape

- `src/main/index.js` wires together the Electron app lifecycle, store, windows,
  timer service, menus, reminders, IPC, and test automation.
- `src/main/settings.js` owns desktop settings defaults, migration-friendly
  normalization, and main-process labels.
- `src/main/timer-service.js` owns reminder timing, queueing, snooze/defer
  behavior, task due detection, and Pomodoro phase state.
- `src/main/break-window.js` owns the overlay/fullscreen break window,
  platform-aware work-area alignment, mouse passthrough, and layout diagnostics.
- `src/main/reminders.js` decides how a reminder is presented: system
  notification, transparent overlay, or fullscreen break.
- `src/main/menu.js` owns the app menu and tray menu.
- `src/main/pet-window.js` owns the optional draggable desktop pet.
- `src/main/custom-cat.js` owns custom cat media import into Electron user data.
- `src/main/codex-pet.js` owns Codex pet package import, validation, and library
  updates for desktop pet spritesheets.
- `src/main/pet-runtime.js` owns desktop pet animation state priority and TTL.
- `src/main/pet-mcp-server.js` owns the optional MCP server that exposes pet
  control tools over loopback HTTP and, when enabled, LAN/mDNS.
- `src/main/ipc.js` registers the stable `window.breakNeko` IPC contract.
- `docs/pet-mcp.md` documents how to connect Cursor and other local agents to the
  pet MCP/HTTP control server.
- `src/main/automation-tests.js` owns Electron smoke/visual test entrypoints.
- `src/shared.js` contains shared settings helpers and legacy settings
  migration utilities.

## App Windows

- Settings window: `src/renderer/index.html`, `src/renderer/app.js`,
  `src/renderer/styles.css`.
- Break window: `src/break/index.html`, `src/break/break.js`,
  `src/break/styles.css`.
- Desktop pet: `src/pet/index.html`, `src/pet/pet.js`, `src/pet/styles.css`.

The preload API exposed as `window.breakNeko` is intentionally stable. When
adding IPC, update `src/preload.js`, register the handler in `src/main/ipc.js`,
and keep renderer calls behind that API. App metadata, including the displayed
runtime version, comes from `app:get-info` rather than hardcoded renderer text.

## Data Flow

1. `electron-store` persists `settings` and daily `stats`.
2. `settings.js` normalizes all settings reads before use, including older
   browser-extension-shaped settings.
3. `timer-service.js` emits public timer state through `broadcastTimerState`.
4. `reminders.js` presents active reminders and delegates overlay/fullscreen
   windows to `break-window.js`.
5. Renderer and pet windows receive state updates through `timer:state`.

## Assets And Packaging

`assets/` stays at the repository root. `src/main/paths.js` is the source of
truth for root, source, dist, asset, and unpacked asset paths. Cat videos are
listed in `asarUnpack` because the break window streams them as files.

Runtime development is supported on macOS and Windows. The current builder
configuration only packages macOS artifacts; Windows installer/portable targets
are intentionally left for a release packaging pass.

The active application tree lives under `src/`. Root-level renderer, break, or
pet folders are not part of the active app layout and should not be reintroduced.

## Commands

- `npm run dev`: start the Electron app.
- `npm run check`: run syntax checks for every source module.
- `npm test`: run lightweight unit tests with Node's built-in test runner.
- `npm run test:visual`: run the optional Electron visual smoke entrypoint.
- `npm run build:mac`: package the macOS app with electron-builder.
- Windows packaging is not configured yet; Windows compatibility work should be
  validated through development smoke runs until a packaging pass is added.

## Maintenance Notes

- Keep `src/main/index.js` as an orchestration layer. New behavior should usually
  land in a focused controller or service module.
- Keep settings migrations in `settings.js` or `src/shared.js`; avoid ad hoc
  normalization in renderer code.
- Keep Windows file paths going through shared URL/path helpers before assigning
  them to renderer `img`, `video`, or canvas preview sources.
- Prefer adding unit tests around pure services and controllers before expanding
  Electron UI automation.
- Do not reintroduce browser extension source into the active app tree. Git
  history remains the reference for the old extension.
