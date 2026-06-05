# Pawkeeper

Pawkeeper is a desktop break reminder that uses a cat to make healthy
interruptions feel easier to accept. It nudges you to stand up, drink water,
focus, or finish a small task without turning the reminder into another cold
productivity alert.

The repository is organized around the Electron desktop app. The earlier browser
extension source has been removed from the active codebase; Git history keeps
that work available for reference.

## Features

- Stand-up, hydration, Pomodoro, and lightweight task reminders.
- Three reminder styles: system notification, transparent cat overlay, and
  fullscreen cat break.
- A lightweight onboarding path with recommended healthy-break defaults.
- Custom cat image or video support.
- Codex pet import with an animated desktop pet library.
- Optional local MCP/HTTP pet control for Cursor, hooks, and LAN devices.
- Tray/menu controls for starting, pausing, summoning the cat, and quiet time.
- Local settings storage. Custom cat media stays on your device.

## Platform Status

- macOS: supported for development and packaging with `npm run build:mac`.
- Windows: supported for development smoke testing with `npm run dev`. Windows
  installer or portable packaging is not configured yet.
- Linux: not a release target at the moment.

## Development

Install dependencies:

```bash
npm install
```

Run the desktop app:

```bash
npm run dev
```

Development runs are supported on macOS and Windows. Windows packaging is not a
release target yet; use `npm run dev` for compatibility testing on Windows.

Run syntax checks:

```bash
npm run check
```

Run unit tests:

```bash
npm test
```

Package the macOS app:

```bash
npm run build:mac
```

## Project Structure

- `src/main/` contains the Electron main process, settings normalization, IPC,
  tray/menu logic, reminder orchestration, and timer service.
- `src/renderer/` contains the settings window.
- `src/break/` contains the reminder overlay/fullscreen break window.
- `src/pet/` contains the optional draggable desktop pet.
- `src/shared.js` contains shared settings helpers used by the desktop app and
  legacy settings migration.
- `assets/` contains app icons and cat media.

For a deeper map of the runtime modules, window responsibilities, data flow, and
maintenance notes, see [docs/architecture.md](docs/architecture.md).

For pet MCP setup, Cursor config, LAN/mDNS mode, and hook examples, see
[docs/pet-mcp.md](docs/pet-mcp.md).

## Release Checklist

Before publishing a build:

- Run `npm run check`.
- Run `npm test`.
- Run the Electron UI, interaction, countdown, and Summon Cat smoke tests.
- Capture English and Chinese settings screenshots.
- Confirm the README platform status matches the artifacts being published.
- Package macOS with `npm run build:mac`.

## Contact

Questions, bug reports, and feature requests are welcome via GitHub Issues.

## Contributions

Thank you for the interest and support!

At the moment, Pawkeeper is developed and maintained by a single developer,
and I don’t currently have enough time to properly review and test external
implementation PRs.

Because of this, I’m currently not accepting feature implementation pull requests.

Bug reports, feedback, and feature suggestions through GitHub issues are still very welcome and appreciated.

## License

The source code is licensed under the MIT License. See [LICENSE](LICENSE).

Cat videos, icons, logos, images, and other visual or brand assets are not
covered by the MIT License. All rights are reserved. See
[ASSETS_LICENSE.md](ASSETS_LICENSE.md).
